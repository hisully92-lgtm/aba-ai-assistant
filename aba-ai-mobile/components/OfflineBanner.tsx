import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { syncQueue, getQueueCount } from "../lib/offline";

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      setIsOnline(online);
      if (online) {
        checkQueue();
        autoSync();
      }
    });

    checkQueue();
    return () => unsubscribe();
  }, []);

  async function checkQueue() {
    const count = await getQueueCount();
    setQueueCount(count);
  }

  async function autoSync() {
    const count = await getQueueCount();
    if (count === 0) return;
    setSyncing(true);
    const result = await syncQueue();
    setSyncing(false);
    if (result.synced > 0) {
      setSyncResult(`✓ ${result.synced} entries synced`);
      setQueueCount(0);
      setTimeout(() => setSyncResult(null), 3000);
    }
  }

  async function handleManualSync() {
    setSyncing(true);
    const result = await syncQueue();
    setSyncing(false);
    const count = await getQueueCount();
    setQueueCount(count);
    if (result.synced > 0) {
      setSyncResult(`✓ ${result.synced} entries synced`);
      setTimeout(() => setSyncResult(null), 3000);
    } else if (result.failed > 0) {
      setSyncResult(`⚠️ ${result.failed} failed to sync`);
      setTimeout(() => setSyncResult(null), 3000);
    }
  }

  if (syncResult) {
    return (
      <View style={styles.syncSuccess}>
        <Text style={styles.syncSuccessText}>{syncResult}</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={styles.offlineBanner}>
        <Text style={styles.offlineIcon}>📵</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.offlineText}>You are offline</Text>
          <Text style={styles.offlineSubText}>Data will sync when connection returns</Text>
        </View>
        {queueCount > 0 && (
          <View style={styles.queueBadge}>
            <Text style={styles.queueBadgeText}>{queueCount} queued</Text>
          </View>
        )}
      </View>
    );
  }

  if (queueCount > 0 && isOnline) {
    return (
      <TouchableOpacity style={styles.syncBanner} onPress={handleManualSync} disabled={syncing}>
        {syncing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Text style={styles.syncIcon}>🔄</Text>
            <Text style={styles.syncText}>{queueCount} entries waiting to sync — tap to sync now</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  offlineBanner: { backgroundColor: "#1f2937", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  offlineIcon: { fontSize: 16 },
  offlineText: { fontSize: 13, fontWeight: "700", color: "#f9fafb" },
  offlineSubText: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  queueBadge: { backgroundColor: "#f59e0b", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  queueBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  syncBanner: { backgroundColor: "#2563eb", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  syncIcon: { fontSize: 16 },
  syncText: { fontSize: 12, color: "#fff", fontWeight: "600", flex: 1 },
  syncSuccess: { backgroundColor: "#16a34a", paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
  syncSuccessText: { fontSize: 13, color: "#fff", fontWeight: "700" },
});