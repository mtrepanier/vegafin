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
  ...viewProps
}: FocusGroupProps) {
  return (
    <TVFocusGuideView
      autoFocus
      trapFocusUp={trapFocusUp}
      trapFocusDown={trapFocusDown}
      trapFocusLeft={trapFocusLeft}
      trapFocusRight={trapFocusRight}
      {...viewProps}
    >
      {children}
    </TVFocusGuideView>
  );
}
