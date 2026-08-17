import { useCallback, useState } from 'react';

export interface FocusMemory {
  /** Index that should receive `hasTVPreferredFocus` right now. */
  focusedIndex: number;
  /** Attach to each item's `onFocus`: `onFocus={() => onItemFocus(index)}`. */
  onItemFocus: (index: number) => void;
}

/**
 * Remembers which index in a row/grid last had focus so re-entering the group (D-pad
 * navigating back into it) restores focus to the same item, mirroring Compose's
 * `focusGroup()` + `focusRestorer()` pair (ui/cards/ItemRow.kt, ui/detail/CardGrid.kt).
 *
 * There's no JS-side "redirect focus here" step: the remembered index is exposed as
 * `hasTVPreferredFocus` on that one item, and the platform's native TV focus engine takes it
 * from there once the item is mounted (see `useScrollIntoFocus` for making sure it is).
 */
export function useLastFocusedIndex(initialIndex = 0): FocusMemory {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);

  const onItemFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  return { focusedIndex, onItemFocus };
}
