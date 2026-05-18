"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { UserRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // -------------------------
  // ROLE FETCH (SINGLE SOURCE OF TRUTH)
  // -------------------------
  async function getUserRole(sessionUser: any): Promise<UserRole> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .single();

    return (profile?.role as UserRole) ?? "rbt";
  }

  // -------------------------
  // SIGN IN (EMAIL + PASSWORD)
  // -------------------------
  const signIn = async () => {
    if (!email || !password) {
      alert("Enter email and password.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    if (data.user) {
      const role = await getUserRole(data.user);

      if (role === "admin") router.replace("/admin");
      else if (role === "supervisor") router.replace("/supervisor");
      else if (role === "student_analyst") router.replace("/student");
      else router.replace("/rbt");
    }
  };

  // -------------------------
  // CREATE ACCOUNT NAVIGATION
  // -------------------------
  const createAccount = () => {
    router.push("/signup");
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <main style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      <div
        style={{
          height: 240,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/login-banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <h1 style={{ fontSize: 52, fontWeight: 900 }}>
          ABA AI
        </h1>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <section
          style={{
            width: 420,
            background: "white",
            padding: 28,
            borderRadius: 12,
          }}
        >
          <h2>Sign in to ABA AI</h2>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            style={{ width: "100%", marginBottom: 12 }}
          />

          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            style={{ width: "100%", marginBottom: 12 }}
          />

          <button onClick={signIn} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <hr style={{ margin: "20px 0" }} />

          <button onClick={createAccount}>
            Create account
          </button>
        </section>
      </div>
    </main>
  );
}