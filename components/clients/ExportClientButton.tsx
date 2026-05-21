"use client";

import Button from "@/components/ui/Button";
import { buildClientExport } from "@/lib/exports/buildClientExport";
import { generateClinicalPacketPDF } from "@/lib/pdf/generateClinicalPacketPDF";

export default function ExportClientButton({
  clientId,
}: {
  clientId: string;
}) {
  async function handleExport() {
    const data = await buildClientExport(clientId);
    generateClinicalPacketPDF(data);
  }

  return (
    <Button onClick={handleExport}>
      Export Clinical Packet
    </Button>
  );
}