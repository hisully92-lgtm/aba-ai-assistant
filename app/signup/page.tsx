"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      alert("Please complete all fields.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    // Create auth user (NO redirect callback — simplified auth flow)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      alert(error.message);
      return;
    }

    // Create profile AFTER user exists
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          email: email,
          role: "rbt",
        });

      if (profileError) {
        setLoading(false);
        alert(profileError.message);
        return;
      }
    }

    setLoading(false);

    alert("Check your email to confirm your account.");
    router.push("/login");
  };

  return (
    <div
      style={{
        padding: 40,
        maxWidth: 400,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <h1>Create Account</h1>

      <input
        placeholder="Full Name"
        type="text"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <input
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        placeholder="Confirm Password"
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      <button onClick={signUp} disabled={loading}>
        {loading ? "Creating Account..." : "Create Account"}
      </button>

      <p>Already have an account?</p>

      <button onClick={() => router.push("/login")}>
        Sign In
      </button>
    </div>
  );
}