import { useState, useCallback, useRef } from "react";

export type StreamState = {
  text: string;
  loading: boolean;
  error: string | null;
  done: boolean;
};

export type UseAIStreamReturn = StreamState & {
  stream: (type: string, clientId: string, message?: string) => Promise<void>;
  reset: () => void;
};

export function useAIStream(): UseAIStreamReturn {
  const [state, setState] = useState<StreamState>({
    text: "",
    loading: false,
    error: null,
    done: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (type: string, clientId: string, message?: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState({ text: "", loading: true, error: null, done: false });

    try {
      const res = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, client_id: clientId, message }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          loading: false,
          error: data.error ?? "Stream failed",
        }));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        setState((prev) => ({ ...prev, loading: false, error: "No stream body" }));
        return;
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          if (payload === "[DONE]") {
            setState((prev) => ({ ...prev, loading: false, done: true }));
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              setState((prev) => ({
                ...prev,
                loading: false,
                error: parsed.error,
              }));
              return;
            }
            if (parsed.text) {
              setState((prev) => ({
                ...prev,
                text: prev.text + parsed.text,
              }));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Stream failed",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState({ text: "", loading: false, error: null, done: false });
  }, []);

  return { ...state, stream, reset };
}