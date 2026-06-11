import { useEffect, useRef, useState } from 'react';

/** The state returned by {@link usePolling}. */
export interface PollState<T> {
  data: T | undefined;
  error: string | undefined;
}

/**
 * Polls an async fetcher on an interval and returns the latest data or error.
 *
 * @param {() => Promise<T>} fetcher - The async function to call on each tick.
 * @param {number} intervalMs - The polling interval in milliseconds.
 * @returns {PollState<T>} The latest fetched data and the last error message, if any.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): PollState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // Keep the latest fetcher without resetting the interval on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;

    const tick = async () => {
      try {
        const result = await fetcherRef.current();
        if (active) {
          setData(result);
          setError(undefined);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
    };

    void tick();
    const id = setInterval(() => void tick(), intervalMs);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { data, error };
}
