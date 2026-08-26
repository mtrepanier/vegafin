/**
 * Pure scroll-offset math, factored out so it's testable without a real `ScrollView` - used by
 * `LiveTvGuideScreen.tsx`'s guide grid to keep a newly-focused cell in view on both axes.
 * `ItemRow`/`ItemGrid` get this for free from `FlatList`'s own `focusItemAlignment` prop; a
 * hand-rolled synced-scroll grid (two axes, many independently-widthed cells, no FlatList
 * involved) has no such built-in, and this platform's focus engine auto-scrolling a plain
 * `ScrollView` to follow focus is not something to assume without seeing it confirmed on-device
 * - explicit `onFocus`-driven scrolling here doesn't depend on that assumption either way.
 */

/** Returns the scroll offset needed to bring `[targetStart, targetEnd)` fully into a viewport of
 * size `viewportSize` currently scrolled to `current` - or `null` if it's already fully visible,
 * so the caller can skip an unnecessary `scrollTo` call (and its animation). */
export function scrollOffsetToReveal(current: number, targetStart: number, targetEnd: number, viewportSize: number): number | null {
  if (targetStart < current) {
    return targetStart;
  }
  if (targetEnd > current + viewportSize) {
    return targetEnd - viewportSize;
  }
  return null;
}
