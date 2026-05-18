import { useCallback, useEffect, useRef, useState } from 'react';

export interface PollingState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Generic polling hook.
 *
 * Calls `fetcher` on mount, then every `intervalMs` ms.
 * Exposes loading/error/data + manual refresh.
 *
 * Cleans up timers on unmount and pauses while a request is in flight
 * to avoid stacking requests on slow networks.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Use refs so the polling loop always calls the latest fetcher
  // without needing to re-create the timer on every render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const tick = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current) return;
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [intervalMs, tick]);

  return { data, error, loading, lastUpdated, refresh: () => void tick() };
}
