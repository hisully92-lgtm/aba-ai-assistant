"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { runExport } from "@/lib/exports/runExport";
import { canUserExport } from "@/lib/billing/canUserExport";

export default function ExportClientButton({
  clientId,
}: {
  clientId: string;
}) {
  const [canExport, setCanExport] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    check();
  }, []);

  async function check() {
    const billing = await canUserExport();
    setCanExport(billing.canExport);
  }

  async function handleExport() {
    try {
      setLoading(true);
      await runExport(clientId);
    } catch (err) {
      console.error(err);
      alert("Upgrade required to export or limit reached.");
    } finally {
      setLoading(false);
    }
  }

  if (!canExport) {
    return (
      <Button variant="outline" onClick={() => alert("Upgrade required")}>
        Upgrade to Export
      </Button>
    );
  }

  return (
    <Button onClick={handleExport}>
      {loading ? "Generating..." : "Export Clinical Packet"}
    </Button>
  );
}