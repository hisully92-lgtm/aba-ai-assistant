import { supabase } from "@/lib/supabase/client";

export type ExportNote = {
  id: string;
  export_id: string;
  created_by: string;
  note: string;
  created_at: string;
};

export async function getExportNotes(exportId: string): Promise<ExportNote[]> {
  const { data, error } = await supabase
    .from("export_notes")
    .select("id, export_id, created_by, note, created_at")
    .eq("export_id", exportId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addExportNote(
  exportId: string,
  userId: string,
  note: string
): Promise<void> {
  const { error } = await supabase
    .from("export_notes")
    .insert({
      export_id: exportId,
      created_by: userId,
      note: note.trim(),
    });

  if (error) throw new Error(error.message);
}

export async function deleteExportNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from("export_notes")
    .delete()
    .eq("id", noteId);

  if (error) throw new Error(error.message);
}