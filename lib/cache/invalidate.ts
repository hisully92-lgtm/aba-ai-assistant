import { deleteCache } from "@/lib/cache";

// =========================
// CACHE INVALIDATION
// =========================

export async function invalidateClientCache(client_id: string): Promise<void> {
  await Promise.allSettled([
    deleteCache(`ai:client-summary:${client_id}`),
    deleteCache(`ai:client-timeline:${client_id}`),
    deleteCache(`ai:export-report:${client_id}`),
  ]);
}

export async function invalidateSessionNoteCache(
  client_id: string,
  date: string
): Promise<void> {
  await deleteCache(`ai:session-note:${client_id}:${date}`);
}