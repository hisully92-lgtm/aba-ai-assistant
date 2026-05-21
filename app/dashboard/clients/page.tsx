"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import ClientCard from "@/components/clients/ClientCard";
import ClientForm from "@/components/clients/ClientForm";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  caregiver_name?: string;
  goals?: string;
  behaviors?: string;
  skill_programs?: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    setClients(data ?? []);
  }

  async function handleAddClient(client: any) {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("clients")
      .insert([{ ...client, created_by: user.id }])
      .select()
      .single();

    if (error) return console.error(error.message);

    if (data) setClients((prev) => [data, ...prev]);
    setShowForm(false);
  }

  return (
    <div>
      <PageHeader title="Clients">
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ Add Client"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section title="Add Client">
          <ClientForm onAdd={handleAddClient} />
        </Section>
      )}

      <Section title="Client List">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {clients.length === 0 ? (
            <p className="text-gray-500">No clients yet.</p>
          ) : (
            clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))
          )}
        </div>
      </Section>
    </div>
  );
}