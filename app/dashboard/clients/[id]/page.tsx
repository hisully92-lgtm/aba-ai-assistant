"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { supabase } from "@/lib/supabase/client";
import ClientOverview from "@/components/clients/ClientOverview";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClient() {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
      } else {
        setClient(data);
      }

      setLoading(false);
    }

    if (id) fetchClient();
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