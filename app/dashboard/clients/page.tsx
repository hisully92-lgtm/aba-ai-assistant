"use client";

import { useEffect, useState } from "react";

import ClientCard from "@/components/clients/ClientCard";
import ClientForm from "@/components/clients/ClientForm";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

import { supabase } from "@/lib/supabase/client";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  created_by?: string;
};

type Props = {
  onAdd: (client: Client) => void | Promise<void>;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    async function fetchClients() {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) return;

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false });

      if (error) { console.error(error); return; }
      setClients((data as Client[]) || []);
    }

    fetchClients();
  }, []);

  const handleAddClient: Props["onAdd"] = async (client) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) return;

    const { data, error } = await supabase
      .from("clients")
      .insert([{
        name: client.name,
        age: client.age,
        diagnosis: client.diagnosis,
        created_by: userData.user.id,
      }])
      .select()
      .single();

    if (error) { console.error(error); return; }
    if (data) setClients((prev) => [data as Client, ...prev]);
    setShowForm(false);
  };

  return (
    <div>
      <PageHeader title="Clients">
        <Button onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? "Close" : "+ Add Client"}
        </Button>
      </PageHeader>

      {showForm && (
        <Section>
          <ClientForm onAdd={handleAddClient} />
        </Section>
      )}

      <Section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {clients.length === 0 ? (
            <p className="text-gray-500">No clients yet. Add your first client.</p>
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