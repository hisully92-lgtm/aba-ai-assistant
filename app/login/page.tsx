"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { UserRole } from "@/lib/roles";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getUserRole(sessionUser: any): Promise<UserRole> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", sessionUser.id)
      .single();

    return (profile?.role as UserRole) ?? "rbt";
  }

  // -------------------------
  // AUTO REDIRECT IF LOGGED IN
  // -------------------------
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

    return () => subscription.unsubscribe();
  }, [router]);

  // -------------------------
  // STEP 1 → EMAIL
  // -------------------------
  const continueStep = () => {
    setError(null);

    if (!email) {
      setError("Please enter your email.");
      return;
    }

    setStep(2);
  };

  // -------------------------
  // STEP 2 → AUTH FLOW
  // -------------------------
  const handleAuth = async () => {
    setError(null);

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      // -------------------------
      // SIGN IN ATTEMPT
      // -------------------------
      if (mode === "signin") {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          setError(error.message);
          return;
        }

        if (data.user) return;
      }

      // -------------------------
      // SIGN UP FLOW (EXPLICIT ONLY)
      // -------------------------
      const { data: signupData, error: signupError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      if (signupData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: signupData.user.id,
            full_name: fullName || "User",
            email: signupData.user.email,
            role: "rbt",
          });

        if (profileError) {
          setError(profileError.message);
          return;
        }
      }

      setError("Check your email to confirm your account.");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <main style={{ minHeight: "100vh", background: "#f3f4f6" }}>
      {/* HEADER */}
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

      {/* CARD */}
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

          {/* ERROR */}
          {error && (
            <p style={{ color: "red", marginTop: 10 }}>
              {error}
            </p>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <label>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                style={{ width: "100%", marginBottom: 12 }}
              />

              <button onClick={continueStep}>
                Continue
              </button>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <p style={{ marginBottom: 10 }}>{email}</p>

              {/* MODE TOGGLE */}
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={() => setMode("signin")}
                  style={{
                    marginRight: 10,
                    fontWeight: mode === "signin" ? "bold" : "normal",
                  }}
                >
                  Sign in
                </button>

                <button
                  onClick={() => setMode("signup")}
                  style={{
                    fontWeight: mode === "signup" ? "bold" : "normal",
                  }}
                >
                  Create account
                </button>
              </div>

              {/* FULL NAME ONLY FOR SIGNUP */}
              {mode === "signup" && (
                <>
                  <label>Full Name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    type="text"
                    style={{ width: "100%", marginBottom: 12 }}
                  />
                </>
              )}

              <label>Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                style={{ width: "100%", marginBottom: 12 }}
              />

              <button onClick={handleAuth} disabled={loading}>
                {loading
                  ? "Loading..."
                  : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              </button>

              {/* OPTIONAL FUTURE HOOK */}
              {mode === "signin" && (
                <p style={{ marginTop: 10, fontSize: 12 }}>
                  Forgot password (hook coming next)
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}