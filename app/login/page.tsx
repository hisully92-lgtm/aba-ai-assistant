"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { UserRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");

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
  // OTP SIGN IN
  // -------------------------
  const signInWithEmail = async () => {
    if (!email) {
      alert("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Check your email to sign in.");
  };

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
        <section style={{ width: 420, background: "white", padding: 28 }}>
          <h2>Sign in to ABA AI</h2>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            style={{ width: "100%", marginBottom: 12 }}
          />

          <button onClick={signInWithEmail}>
            Sign in with email
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