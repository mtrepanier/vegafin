import { useCallback, useRef, useState } from 'react';

export interface FocusGroupExpanded {
  expanded: boolean;
  /** Call from a descendant's onFocus. */
  reveal: () => void;
  /** Call from a descendant's onBlur. */
  release: () => void;
}

/**
 * Tracks whether any descendant Pressable within a group currently has focus, for UI (like the
 * side nav) that should expand while focus is inside it and collapse once focus leaves -
 * neither the drawer package nor Kepler's `TVFocusGuideView` expose a built-in "focus is
 * somewhere inside this group" callback, so this has to be hand-rolled from each descendant's
 * own onFocus/onBlur.
 *
 * A Pressable's onBlur fires before the sibling it's losing focus to reports onFocus, so
 * collapsing has to wait a tick (`setTimeout(..., 0)`) to see whether focus actually left the
 * group entirely or just moved to another item within it.
 */
export function useFocusGroupExpanded(): FocusGroupExpanded {
  const [expanded, setExpanded] = useState(false);
  const focusedCountRef = useRef(0);

  const reveal = useCallback(() => {
    focusedCountRef.current += 1;
    setExpanded(true);
  }, []);

  const release = useCallback(() => {
    focusedCountRef.current -= 1;
    setTimeout(() => {
      if (focusedCountRef.current <= 0) {
        setExpanded(false);
      }
    }, 0);
  }, []);

  return { expanded, reveal, release };
}
