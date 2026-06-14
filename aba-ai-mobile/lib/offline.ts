import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./supabase";

const KEYS = {
  CLIENTS: "offline_clients",
  BEHAVIORS: "offline_behaviors",
  TARGETS: "offline_targets",
  SCHEDULE: "offline_schedule",
  QUEUE: "offline_queue",
  LAST_SYNC: "offline_last_sync",
};

export type QueuedEntry = {
  id: string;
  type: "behavior_data" | "skill_trial_data" | "sessions" | "session_timers";
  payload: any;
  created_at: string;
};

// CHECK CONNECTION
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable === true;
}

// SAVE TO CACHE
export async function cacheClients(data: any[]) {
  await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(data));
}

export async function cacheBehaviors(clientId: string, data: any[]) {
  await AsyncStorage.setItem(`${KEYS.BEHAVIORS}_${clientId}`, JSON.stringify(data));
}

export async function cacheTargets(clientId: string, data: any[]) {
  await AsyncStorage.setItem(`${KEYS.TARGETS}_${clientId}`, JSON.stringify(data));
}

export async function cacheSchedule(userId: string, data: any[]) {
  await AsyncStorage.setItem(`${KEYS.SCHEDULE}_${userId}`, JSON.stringify(data));
}

// READ FROM CACHE
export async function getCachedClients(): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CLIENTS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getCachedBehaviors(clientId: string): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(`${KEYS.BEHAVIORS}_${clientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getCachedTargets(clientId: string): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(`${KEYS.TARGETS}_${clientId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function getCachedSchedule(userId: string): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(`${KEYS.SCHEDULE}_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// QUEUE MANAGEMENT
export async function addToQueue(entry: Omit<QueuedEntry, "id" | "created_at">) {
  try {
    const raw = await AsyncStorage.getItem(KEYS.QUEUE);
    const queue: QueuedEntry[] = raw ? JSON.parse(raw) : [];
    const newEntry: QueuedEntry = {
      ...entry,
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    queue.push(newEntry);
    await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(queue));
    return newEntry.id;
  } catch (e) {
    console.log("Queue error:", e);
  }
}

export async function getQueue(): Promise<QueuedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function removeFromQueue(id: string) {
  try {
    const queue = await getQueue();
    const filtered = queue.filter(e => e.id !== id);
    await AsyncStorage.setItem(KEYS.QUEUE, JSON.stringify(filtered));
  } catch {}
}

export async function getQueueCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

// SYNC QUEUE TO SUPABASE
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      const { error } = await supabase.from(entry.type).insert(entry.payload);
      if (error) {
        console.log("Sync error:", error.message);
        failed++;
      } else {
        await removeFromQueue(entry.id);
        synced++;
      }
    } catch (e) {
      failed++;
    }
  }

  if (synced > 0) {
    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  }

  return { synced, failed };
}

// PREFETCH ALL DATA FOR OFFLINE USE
export async function prefetchForOffline(companyId: string, userId: string) {
  const online = await isOnline();
  if (!online) return;

  try {
    // Cache clients
    const { data: clients } = await supabase
      .from("clients").select("id, full_name")
      .eq("company_id", companyId).order("full_name");
    if (clients) await cacheClients(clients);

    // Cache schedule
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    const { data: schedule } = await supabase
      .from("schedule_entries").select("*")
      .eq("assigned_to", userId)
      .gte("date", today.toISOString().split("T")[0])
      .lte("date", nextWeek.toISOString().split("T")[0]);
    if (schedule) await cacheSchedule(userId, schedule);

    // Cache behaviors and targets for each client
    if (clients) {
      for (const client of clients.slice(0, 10)) {
        const [{ data: behaviors }, { data: targets }] = await Promise.all([
          supabase.from("custom_behaviors")
            .select("*, severity_levels:behavior_severity_levels(*)")
            .eq("company_id", companyId).eq("client_id", client.id).eq("is_active", true),
          supabase.from("skill_targets")
            .select("*, prompt_levels(*)")
            .eq("company_id", companyId).eq("client_id", client.id).eq("is_active", true),
        ]);
        if (behaviors) await cacheBehaviors(client.id, behaviors);
        if (targets) await cacheTargets(client.id, targets);
      }
    }

    await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch (e) {
    console.log("Prefetch error:", e);
  }
}

export async function getLastSync(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.LAST_SYNC);
}