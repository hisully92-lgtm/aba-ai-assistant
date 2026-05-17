"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");

  const completeOnboarding = async () => {
    if (!name) {
      alert("Please enter your name.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      alert("Please sign in again.");
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: name,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div style={{ padding: 40, maxWidth: 400, margin: "0 auto" }}>
      <h1>Complete your profile</h1>

      <label>Your name</label>
      <input
        placeholder="First and last name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div style={{ marginTop: 15 }}>
        <button onClick={completeOnboarding}>Complete</button>
      </div>
    </div>
  );
}