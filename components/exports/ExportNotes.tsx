"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getExportNotes,
  addExportNote,
  deleteExportNote,
  type ExportNote,
} from "@/lib/exports/exportNotes";
import Button from "@/components/ui/Button";

type Props = {
  exportId: string;
  canAdd: boolean;
};

export default function ExportNotes({ exportId, canAdd }: Props) {
  const [notes, setNotes] = useState<ExportNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    async function init() {
      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) setUserId(auth.user.id);
      await loadNotes();
    }
    init();

    // Realtime updates
    subscriptionRef.current = supabase
      .channel(`export-notes-${exportId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "export_notes",
          filter: `export_id=eq.${exportId}`,
        },
        () => loadNotes()
      )
      .subscribe();

    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, [exportId]);

  async function loadNotes() {
    setLoading(true);
    try {
      const data = await getExportNotes(exportId);
      setNotes(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!userId || !noteText.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      await addExportNote(exportId, userId, noteText);
      setNoteText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await deleteExportNote(noteId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-semibold text-gray-500 mb-2">
        Supervisor Notes {notes.length > 0 && `(${notes.length})`}
      </p>

      {/* NOTES LIST */}
      {loading ? (
        <p className="text-xs text-gray-400">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-gray-400">No notes yet.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs"
            >
              <div className="flex justify-between items-start gap-2">
                <p className="text-gray-700 flex-1">{n.note}</p>
                {userId === n.created_by && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-gray-300 hover:text-red-400 text-xs shrink-0"
                  >
                    ✕
                  </button>
                )}
              </div>
              <p className="text-gray-400 mt-1">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ADD NOTE */}
      {canAdd && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Add a supervisor note..."
            className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <Button
            onClick={handleSubmit}
            loading={submitting}
            variant="secondary"
          >
            Add
          </Button>
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}