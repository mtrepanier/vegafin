import { useEffect } from 'react';

const PIN_DURATION_MS = 1000;
const PIN_INTERVAL_MS = 100;

/**
 * Repeatedly forces a scrollable back to its start for a short window after mount.
 *
 * Vega's native TV focus engine auto-scrolls the nearest scrollable ancestor to reveal
 * whichever element first receives `hasTVPreferredFocus`, and does so more than once as layout
 * settles (e.g. as poster images load in and the focused card's real position shifts) - both a
 * single delayed correction and the platform's own `focusItemAlignment="start"` prop (which
 * controls where the *focused descendant* lands, not where the scrollable itself rests, so it
 * doesn't help when that descendant sits below other content on a freshly-mounted screen) lost
 * the race against a later native pass. Reasserting on an interval for a short window, rather
 * than once, guarantees this is the last word regardless of how many native passes run or when
 * they land, while a screen this recently mounted couldn't have real user scroll input yet to
 * preserve.
 */
export function usePinScrollToStart(scrollToStart: () => void) {
  useEffect(() => {
    const interval = setInterval(scrollToStart, PIN_INTERVAL_MS);
    const stop = setTimeout(() => clearInterval(interval), PIN_DURATION_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
