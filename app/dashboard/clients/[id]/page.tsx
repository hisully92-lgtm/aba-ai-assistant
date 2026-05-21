"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase/client";
import ClientOverview from "@/components/clients/ClientOverview";

type Client = {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchClient() {
      setLoading(true);

      const { data, error } = await supabase
        .from("clients")
        .select("id, name, age, diagnosis")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        setClient(null);
      } else {
        setClient(data as Client);
      }

      setLoading(false);
    }

    fetchClient();
  }, [id]);

  if (loading) {
    return <p>Loading client...</p>;
  }

  if (!client) {
    return <p>Client not found</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <ClientOverview client={client} />
    </div>
  );
}