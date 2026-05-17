"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { UserRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  // STEP 5 — SAFE ROLE FETCH HELPER (SINGLE SOURCE OF TRUTH)
  async function getUserRole(sessionUser: any): Promise<UserRole> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .single();

    return (profile?.role as UserRole) ?? "rbt";
  }

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const role = await getUserRole(session.user);

      if (role === "admin") router.replace("/admin");
      else if (role === "supervisor") router.replace("/supervisor");
      else if (role === "student_analyst") router.replace("/student");
      else router.replace("/rbt");
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return;

      const role = await getUserRole(session.user);

      if (role === "admin") router.replace("/admin");
      else if (role === "supervisor") router.replace("/supervisor");
      else if (role === "student_analyst") router.replace("/student");
      else router.replace("/rbt");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // OTP login
  const signInWithEmail = async () => {
    if (!email) {
      alert("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}`
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
        <h1 style={{ fontSize: 52, fontWeight: 900 }}>ABA AI</h1>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <section style={{ width: 420, background: "white", padding: 28 }}>
          <h2>Sign in to ABA AI</h2>

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />

          <button onClick={signInWithEmail}>
            Sign in with email
          </button>

          <hr />

          <button onClick={createAccount}>
            Create account
          </button>
        </section>
      </div>
    </main>
  );
}
