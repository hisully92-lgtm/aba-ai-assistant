"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getClientTimeline,
  GroupedTimeline,
} from "@/lib/timeline/getClientTimeline";
import { useAIStream } from "@/lib/hooks/useAIStream";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";

export default function ClientTimelinePage({
  params,
}: {
  params: { id: string };
}) {
  const clientId = params.id;

  const [timeline, setTimeline] = useState<GroupedTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { text, loading: streaming, error: streamError, done, stream, reset } = useAIStream();

  useEffect(() => {
    loadTimeline();
  }, [clientId]);

  async function loadTimeline() {
    setLoading(true);
    setError(null);
    try {
      const data = await getClientTimeline(clientId);
      setTimeline(data);
    } catch {
      setError("Failed to load timeline.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateTimeline() {
    reset();
    await stream("summary", clientId);
  }

  return (
    <div className="space-y-6">

      {/* AI TIMELINE — STREAMING */}
      <Section title="AI Timeline Analysis">
        {(error || streamError) && (
          <p className="text-red-500 text-sm mb-3">{error || streamError}</p>
        )}

        {/* STREAMING OUTPUT */}
        {(text || streaming) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-3 whitespace-pre-wrap min-h-[60px]">
            {text}
            {streaming && !done && (
              <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse rounded-sm" />
            )}
          </div>
        )}

        {done && (
          <p className="text-xs text-green-600 mb-3">✓ Analysis complete</p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleGenerateTimeline}
            loading={streaming}
            variant="secondary"
          >
            {text ? "Regenerate AI Analysis" : "Generate AI Timeline"}
          </Button>
          {text && !streaming && (
            <Button variant="outline" onClick={reset}>
              Clear
            </Button>
          )}
        </div>
      </Section>

      {/* CLINICAL TIMELINE */}
      <Section title="Clinical Timeline">
        {loading && <p className="text-gray-500">Loading timeline...</p>}

        {!loading && timeline.length === 0 && (
          <p className="text-gray-500">No records yet.</p>
        )}

        {!loading && timeline.length > 0 && (
          <div className="space-y-8">
            {timeline.map((group) => (
              <div key={group.date}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    {group.date}
                  </h3>
                  <div className="h-px bg-gray-200 mt-1" />
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex justify-between items-start">
                        <p className="font-medium">{item.title}</p>
                        <span className="text-xs px-2 py-1 rounded-full bg-white border capitalize">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(item.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}