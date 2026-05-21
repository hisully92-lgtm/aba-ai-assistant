"use client";

import { useState } from "react";

import Section from "@/components/ui/Section";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SessionsPage() {
   
  const [showForm, setShowForm] = useState(false);

  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");

    
    useEffect(() => {
  async function fetchSessions() {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setSessions(data || []);
  }

  fetchSessions();
}, []);

async function handleAddSession() {
  if (!clientName || !notes) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("No user logged in");
    return;
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert([
      {
        client_name: clientName,
        notes,
        created_by: user.id,
      },
    ])
    .select();

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    setSessions((prev) => [...data, ...prev]);
  }

  setClientName("");
  setNotes("");
  setShowForm(false);
}