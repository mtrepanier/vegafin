import React from 'react';
import type { ViewProps } from 'react-native';
// TVFocusGuideView is a TV-fork-only component: it's not part of stock `react-native`'s public
// types, so (unlike core primitives) it's imported from the real Kepler package by name -
// Metro resolves plain 'react-native' to this same package at bundle time regardless (see
// README's "How Vega package resolution actually works"), so this is the same component either
// import path would give at runtime.
import { TVFocusGuideView } from '@amazon-devices/react-native-kepler';

interface FocusGroupProps extends ViewProps {
  children: React.ReactNode;
  /** Prevent D-pad up/down/left/right from leaving this group in that direction. */
  trapFocusUp?: boolean;
  trapFocusDown?: boolean;
  trapFocusLeft?: boolean;
  trapFocusRight?: boolean;
  /** Redirect *any* entry into this group (D-pad navigation from outside it, or the initial
   * focus resolution if nothing else on screen has already claimed it) to a specific descendant,
   * regardless of spatial position - takes precedence over `autoFocus` and, unlike
   * `hasTVPreferredFocus`, is a passive rule ("if entered, land here") rather than a proactive
   * claim, so setting it doesn't yank focus away from wherever it currently is. See
   * `DetailActionButtons.tsx` for why that distinction matters here. */
  destinations?: (null | number | React.Component<any, any> | React.ComponentClass<any>)[];
}

/**
 * Thin wrapper around the native `TVFocusGuideView` (react-native-kepler's
 * ui/cards/ItemRow.kt-equivalent `Modifier.focusGroup()`), used to bound a row/grid so D-pad
 * traversal treats it as one unit. Restoring focus to a remembered item within the group is
 * handled separately by `hasTVPreferredFocus` (see `useLastFocusedIndex`) rather than through
 * this component - `autoFocus` here only picks *some* focusable descendant if nothing else
 * claims preferred focus.
 */
export function FocusGroup({
  children,
  trapFocusUp,
  trapFocusDown,
  trapFocusLeft,
  trapFocusRight,
  destinations,
  ...viewProps
}: FocusGroupProps) {
  return (
    <TVFocusGuideView
      autoFocus
      trapFocusUp={trapFocusUp}
      trapFocusDown={trapFocusDown}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      destinations={destinations}
      {...viewProps}
    >
      {children}
    </TVFocusGuideView>
  );
}
