import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Switch
} from "react-native";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";

type Profile = {
  full_name: string;
  role: string;
  email: string;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [notifyHighSeverity, setNotifyHighSeverity] = useState(true);
  const [notifySessionSubmitted, setNotifySessionSubmitted] = useState(true);
  const [notifyTargetMastered, setNotifyTargetMastered] = useState(true);
  const [notifyChat, setNotifyChat] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [prefsId, setPrefsId] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: profileData }, { data: companyUser }, { data: prefData }] = await Promise.all([
      supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
      supabase.from("company_users").select("role, company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("notification_preferences").select("*").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

    setProfile({
      full_name: profileData?.full_name ?? "",
      role: companyUser?.role ?? profileData?.role ?? "",
      email: user.email ?? "",
    });

    if (prefData) {
      setPrefsId(prefData.id);
      setPushEnabled(prefData.push_enabled ?? true);
      setNotifyHighSeverity(prefData.notify_high_severity ?? true);
      setNotifySessionSubmitted(prefData.notify_session_submitted ?? true);
      setNotifyTargetMastered(prefData.notify_target_mastered ?? true);
      setNotifyChat(prefData.notify_team_chat ?? true);
      setQuietHours(prefData.quiet_hours_enabled ?? false);
    }

    setLoading(false);
  }

  async function savePrefs() {
    setSavingPrefs(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const updates = {
      push_enabled: pushEnabled,
      notify_high_severity: notifyHighSeverity,
      notify_session_submitted: notifySessionSubmitted,
      notify_target_mastered: notifyTargetMastered,
      notify_team_chat: notifyChat,
      quiet_hours_enabled: quietHours,
    };

    if (prefsId) {
      await supabase.from("notification_preferences").update(updates).eq("id", prefsId);
    } else {
      const { data: companyUser } = await supabase.from("company_users").select("company_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      const { data } = await supabase.from("notification_preferences").insert({
        ...updates, user_id: user.id, company_id: companyUser?.company_id,
      }).select().single();
      if (data) setPrefsId(data.id);
    }

    setSavingPrefs(false);
    Alert.alert("Saved", "Notification preferences updated.");
  }

  async function handleLogout() {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out", style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        }
      }
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.full_name || "Clinician"}</Text>
            <Text style={styles.profileEmail}>{profile?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{profile?.role?.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* NOTIFICATION SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          <Text style={styles.sectionSubtitle}>Control which alerts you receive on this device.</Text>

          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Enable all push notifications</Text>
              </View>
              <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: "#2563eb" }} />
            </View>

            {pushEnabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>🔴 High Severity Behaviors</Text>
                    <Text style={styles.settingDesc}>Alert when serious behaviors are recorded</Text>
                  </View>
                  <Switch value={notifyHighSeverity} onValueChange={setNotifyHighSeverity} trackColor={{ true: "#dc2626" }} />
                </View>
                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>📋 Session Submitted</Text>
                    <Text style={styles.settingDesc}>When staff submit session notes</Text>
                  </View>
                  <Switch value={notifySessionSubmitted} onValueChange={setNotifySessionSubmitted} trackColor={{ true: "#2563eb" }} />
                </View>
                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>🎯 Target Mastered</Text>
                    <Text style={styles.settingDesc}>When a client reaches mastery</Text>
                  </View>
                  <Switch value={notifyTargetMastered} onValueChange={setNotifyTargetMastered} trackColor={{ true: "#16a34a" }} />
                </View>
                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>💬 Team Chat</Text>
                    <Text style={styles.settingDesc}>New messages in client team chats</Text>
                  </View>
                  <Switch value={notifyChat} onValueChange={setNotifyChat} trackColor={{ true: "#2563eb" }} />
                </View>
                <View style={styles.divider} />
                <View style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>🌙 Quiet Hours</Text>
                    <Text style={styles.settingDesc}>Silence notifications at night</Text>
                  </View>
                  <Switch value={quietHours} onValueChange={setQuietHours} trackColor={{ true: "#7c3aed" }} />
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, savingPrefs && styles.saveBtnDisabled]}
            onPress={savePrefs}
            disabled={savingPrefs}>
            {savingPrefs ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Preferences</Text>}
          </TouchableOpacity>
        </View>

        {/* APP INFO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App</Text>
              <Text style={styles.infoValue}>ABA AI Assistant</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Website</Text>
              <Text style={styles.infoValue}>aba-ai-assistant.com</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Support</Text>
              <Text style={styles.infoValue}>support@aba-ai-assistant.com</Text>
            </View>
          </View>
        </View>

        {/* LOGOUT */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
            {loggingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.logoutText}>Log Out</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1a2234", paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 16, margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  profileName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  profileEmail: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  roleBadge: { marginTop: 6, backgroundColor: "#eff6ff", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  roleText: { color: "#2563eb", fontSize: 11, fontWeight: "700" },
  section: { padding: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: "#9ca3af", marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 4, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  settingRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  settingLabel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  settingDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 14 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  infoLabel: { fontSize: 13, color: "#6b7280" },
  infoValue: { fontSize: 13, color: "#374151", fontWeight: "500" },
  saveBtn: { backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 12 },
  saveBtnDisabled: { backgroundColor: "#93c5fd" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  logoutBtn: { backgroundColor: "#dc2626", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});