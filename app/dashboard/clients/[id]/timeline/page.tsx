"use client";

import { useEffect, useState } from "react";
import { getClientTimeline, GroupedTimeline } from "@/lib/timeline/getClientTimeline";
import { useAIStream } from "@/lib/hooks/useAIStream";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";

export default function ClientTimelinePage({ params }: { params: { id: string } }) {
  const clientId = params.id;

  const [timeline, setTimeline] = useState<GroupedTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { text, loading: streaming, error: streamError, done, stream, reset } = useAIStream();

  useEffect(() => {
    loadTimeline();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const typeColors: Record<string, string> = {
    session: "bg-blue-100 text-blue-700",
    behavior: "bg-red-100 text-red-700",
    program: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Client Timeline" />

      <Section title="AI Timeline Analysis">
        {(error || streamError) && (
          <p className="text-red-500 text-sm mb-3">{error || streamError}</p>
        )}

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
          <Button onClick={handleGenerateTimeline} loading={streaming} variant="secondary">
            {text ? "Regenerate AI Analysis" : "Generate AI Timeline"}
          </Button>
          {text && !streaming && (
            <Button variant="outline" onClick={reset}>Clear</Button>
          )}
        </div>
      </Section>

      <Section title="Clinical Timeline">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && timeline.length === 0 && (
          <p className="text-gray-400 text-sm">No records yet for this client.</p>
        )}

        {!loading && timeline.length > 0 && (
          <div className="space-y-8">
            {timeline.map((group) => (
              <div key={group.date}>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">{group.date}</h3>
                  <div className="h-px bg-gray-200 mt-1" />
                </div>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border border-gray-100 rounded-lg bg-white hover:bg-gray-50 transition"
                    >
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${typeColors[item.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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