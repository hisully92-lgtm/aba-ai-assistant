import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export type UseAsyncReturn<T> = AsyncState<T> & {
  execute: (...args: any[]) => Promise<void>;
  reset: () => void;
};

export function useAsync<T>(
  asyncFn: (...args: any[]) => Promise<T>,
  options?: {
    immediate?: boolean;
    initialArgs?: any[];
  }
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: any[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFn(...args);
        if (mountedRef.current) {
          setState({ data: result, loading: false, error: null });
        }
      } catch (err: unknown) {
        if (mountedRef.current) {
          setState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Something went wrong",
          });
        }
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    if (options?.immediate) {
      execute(...(options.initialArgs ?? []));
    }
  }, []);

  return { ...state, execute, reset };
}