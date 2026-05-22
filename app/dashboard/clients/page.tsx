"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

import ClientCard from "@/components/clients/ClientCard";
import ClientForm from "@/components/clients/ClientForm";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

import { usePlan } from "@/lib/hooks/usePlan";
import { useFeatureAccess } from "@/lib/hooks/useFeatureAccess";

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

  const { isPro } = usePlan();
  const { hasAccess } = useFeatureAccess("clients");

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

    if (error) {
      console.error(error.message);
      return;
    }

    if (data) {
      setClients((prev) => [data, ...prev]);
    }

    setShowForm(false);
  }

  // 🔒 GATE
  if (hasAccess === false) {
    return (
      <div style={{ padding: 20 }}>
        <h2>Clients Locked</h2>
        <p>Upgrade to Pro to access client management.</p>
      </div>
    );
  }

  const isLimitReached = !isPro && clients.length >= 5;

  return (
    <div>
      <PageHeader title="Clients">
        <Button
          onClick={() => setShowForm((v) => !v)}
          disabled={isLimitReached}
        >
          {showForm ? "Close" : "+ Add Client"}
        </Button>
      </PageHeader>

      {isLimitReached && (
        <div style={{ padding: 10, color: "red" }}>
          Free plan limit reached. Upgrade to Pro to add more clients.
        </div>
      )}

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