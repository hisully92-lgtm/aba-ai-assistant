"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signUp = async () => {
    if (!fullName || !email || !password) {
      alert("Please complete all fields.");
      return;
    }

    // Create auth user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    // Make sure user exists
    if (data.user) {
      // Create profile row
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: data.user.id,
          full_name: fullName,
          email: data.user.email,
          role: "rbt",
        });

      if (profileError) {
        alert(profileError.message);
        return;
      }
    }

    alert("Account created successfully.");

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

      <button onClick={signUp}>
        Create Account
      </button>

      <p>
        Already have an account?
      </p>

      <button onClick={() => router.push("/login")}>
        Sign In
      </button>
    </div>
  );
}