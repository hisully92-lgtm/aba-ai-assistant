"use client";

import { useState } from "react";

import ClientCard from "../../components/client/ClientCard";
import ClientForm from "../../components/client/ClientForm";

import Button from "../../components/ui/Button";
import Section from "../../components/ui/Section";
import PageHeader from "../../components/layout/PageHeader";

import { supabase } from "@/lib/supabase/client";

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

useEffect(() => {
  async function fetchClients() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setClients(data || []);
  }

  fetchClients();
}, []);
  
  async function handleAddClient(client: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data, error } = await supabase
    .from("clients")
    .insert([
      {
        name: client.name,
        age: client.age,
        diagnosis: client.diagnosis,
        created_by: user.id,
      },
    ])
    .select();

  if (error) {
    console.error(error);
    return;
  }

  if (data) {
    setClients((prev) => [data[0], ...prev]);
  }
}

  return (
    <div>
      {/* Page Header */}
      <PageHeader title="Clients">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Close" : "+ Add Client"}
        </Button>
      </PageHeader>

      {/* Client Form */}
      {showForm && (
        <Section title="Add Client">
          <ClientForm onAdd={handleAddClient} />
        </Section>
      )}

      {/* Client List */}
      <Section title="Client List">
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(250px, 1fr))",
            gap: 20,
          }}
        >
          {clients.length === 0 ? (
            <p style={{ color: "#666" }}>
              No clients yet. Add your first client.
            </p>
          ) : (
            clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
              />
            ))
          )}
        </div>
      </Section>
    </div>
  );
}