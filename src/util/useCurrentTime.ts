import { useEffect, useState } from 'react';

const DEFAULT_INTERVAL_MS = 30_000;

/** Current time, refreshed on an interval - backs the top-right clock (`Clock.tsx`). Only
 * needs to be accurate to the minute, so a 30s tick (not a per-second one) is plenty. */
export function useCurrentTime(intervalMs = DEFAULT_INTERVAL_MS): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
