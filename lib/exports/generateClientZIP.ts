import JSZip from "jszip";
import { ClientExport } from "./buildClientExport";

export async function generateClientZIP(data: ClientExport) {
  const zip = new JSZip();

  zip.file(
    "summary.json",
    JSON.stringify(data.summary, null, 2)
  );

  zip.file(
    "sessions.json",
    JSON.stringify(data.sections.sessions, null, 2)
  );

  zip.file(
    "behaviors.json",
    JSON.stringify(data.sections.behaviors, null, 2)
  );

  zip.file(
    "programs.json",
    JSON.stringify(data.sections.programs, null, 2)
  );

  zip.file(
    "timeline.json",
    JSON.stringify(data.timeline, null, 2)
  );

  const blob = await zip.generateAsync({ type: "blob" });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `client-${data.clientId}-dossier.zip`;
  a.click();
}