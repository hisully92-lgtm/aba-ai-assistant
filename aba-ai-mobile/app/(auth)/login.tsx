import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView
} from "react-native";
import { supabase } from "../../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleMagicLink() {
    if (!email.trim()) { Alert.alert("Please enter your email."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: "exp://192.168.1.160:8081/--/auth/confirm" },
    });
    setLoading(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setSent(true);
  }

  async function handlePasswordLogin() {
    if (!email.trim() || !password.trim()) { Alert.alert("Please enter your email and password."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert("Error", error.message);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.title}>ABA AI</Text>
          <Text style={styles.subtitle}>Practice Management</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === "magic" && styles.toggleActive]}
              onPress={() => setMode("magic")}>
              <Text style={[styles.toggleText, mode === "magic" && styles.toggleTextActive]}>
                ✉️ Magic Link
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === "password" && styles.toggleActive]}
              onPress={() => setMode("password")}>
              <Text style={[styles.toggleText, mode === "password" && styles.toggleTextActive]}>
                🔒 Password
              </Text>
            </TouchableOpacity>
          </View>

          {sent ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentIcon}>📧</Text>
              <Text style={styles.sentTitle}>Check your email!</Text>
              <Text style={styles.sentText}>We sent a magic link to {email}</Text>
              <TouchableOpacity onPress={() => setSent(false)}>
                <Text style={styles.link}>Use a different email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@clinic.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {mode === "password" && (
                <>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Your password"
                    secureTextEntry
                  />
                </>
              )}

              {mode === "magic" && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    We will email you a secure link — no password needed.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={mode === "magic" ? handleMagicLink : handlePasswordLogin}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {mode === "magic" ? "Send Magic Link" : "Sign In"}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.footer}>HIPAA Compliant · ABA AI Assistant</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#f9fafb", alignItems: "center", justifyContent: "center", padding: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  logo: { width: 64, height: 64, backgroundColor: "#2563eb", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  title: { fontSize: 32, fontWeight: "900", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  card: { width: "100%", backgroundColor: "#fff", borderRadius: 20, padding: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  toggle: { flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  toggleActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  toggleText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  toggleTextActive: { color: "#2563eb", fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#111827", marginBottom: 14 },
  infoBox: { backgroundColor: "#eff6ff", borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText: { fontSize: 12, color: "#3b82f6" },
  button: { backgroundColor: "#2563eb", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  sentBox: { alignItems: "center", paddingVertical: 16 },
  sentIcon: { fontSize: 40, marginBottom: 12 },
  sentTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  sentText: { fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 16 },
  link: { fontSize: 13, color: "#2563eb", textDecorationLine: "underline" },
  footer: { marginTop: 32, fontSize: 11, color: "#9ca3af" },
});