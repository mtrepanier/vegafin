import React, { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { useLastFocusedIndex } from '../focus/useLastFocusedIndex';
import { usePinScrollToStart } from '../focus/usePinScrollToStart';
import { FocusGroup } from '../focus/FocusGroup';
import { ViewMoreCard } from './cards/ViewMoreCard';

interface Props<T> {
  title?: string;
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number, hasTVPreferredFocus: boolean, onFocus: () => void) => React.ReactElement;
  onEndReached?: () => void;
  showViewMore?: boolean;
  onViewMorePress?: () => void;
  /** Index that should start focused, e.g. resolved from a deep-linked episode id. */
  initialFocusedIndex?: number;
  /**
   * Whether this row claims `hasTVPreferredFocus` for its (remembered/initial) card at all.
   * Every `ItemRow`/`ItemGrid` on a screen independently defaults its own focus memory to
   * index 0, so with this left on everywhere, multiple rows end up simultaneously claiming
   * `hasTVPreferredFocus` - the platform's TV focus engine resolves that ambiguity to some
   * element that isn't necessarily the intended one, which is what was actually causing pages
   * to open scrolled away from their true starting position (not a scroll-position bug at
   * all). Exactly one focusable region per screen should leave this at the default `true`;
   * every other row/section on that same screen must pass `false`.
   */
  autoFocus?: boolean;
}

/**
 * Horizontal scroller with a title above it (ui/cards/ItemRow.kt). Focus restore is handled by
 * `useLastFocusedIndex` + `hasTVPreferredFocus` on the remembered card; keeping that card
 * scrolled into view as focus moves is left entirely to the platform's own
 * `focusItemAlignment="start"` (below) - an earlier version also drove an explicit
 * `scrollToIndex` from this component's own `onFocus`, and the two scroll computations
 * disagreeing slightly left the newly-focused card only partially in view instead of flush.
 */
export function ItemRow<T>({
  title,
  items,
  keyExtractor,
  renderItem,
  onEndReached,
  showViewMore,
  onViewMorePress,
  initialFocusedIndex = 0,
  autoFocus = true,
}: Props<T>) {
  const { colors } = useTheme();
  const { focusedIndex, onItemFocus } = useLastFocusedIndex(initialFocusedIndex);
  const listRef = useRef<FlatList<T>>(null);
  // Skipped when initialFocusedIndex is nonzero (e.g. EpisodeRow deep-linking straight to a
  // specific episode) - pinning to 0 there would fight that deliberate initial scroll.
  usePinScrollToStart(() => {
    if (initialFocusedIndex === 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  });

  const handleFocus = useCallback((index: number) => onItemFocus(index), [onItemFocus]);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {title ? <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text> : null}
      <FocusGroup trapFocusUp trapFocusDown>
        <FlatList
          ref={listRef}
          horizontal
          data={items}
          keyExtractor={keyExtractor}
          showsHorizontalScrollIndicator={false}
          focusItemAlignment="start"
          contentContainerStyle={styles.content}
          onEndReached={onEndReached}
          onEndReachedThreshold={2}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          renderItem={({ item, index }) =>
            renderItem(item, index, autoFocus && index === focusedIndex, () => handleFocus(index))
          }
          ListFooterComponent={showViewMore ? <ViewMoreCard onPress={onViewMorePress ?? (() => {})} /> : null}
        />
      </FocusGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: layout.rowSpacing,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: layout.rowTitleGap,
    paddingHorizontal: layout.contentPadding,
  },
  content: {
    paddingHorizontal: layout.contentPadding,
    // PosterCard grows by layout.focusScale on focus, rendered via a transform rather than a
    // layout size change - without headroom above and below the row, that growth's top and
    // bottom halves get clipped by the FlatList's own bounds instead of drawing past the
    // card's normal box.
    paddingTop: 12,
    paddingBottom: 12,
    gap: layout.cardSpacing,
  },
});
