import React, { useCallback, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { useLastFocusedIndex } from '../focus/useLastFocusedIndex';
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
}

/**
 * Horizontal scroller with a title above it (ui/cards/ItemRow.kt). Focus restore is handled by
 * `useLastFocusedIndex` + `hasTVPreferredFocus` on the remembered card; this component's own
 * job is keeping that card scrolled into view.
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
}: Props<T>) {
  const { colors } = useTheme();
  const { focusedIndex, onItemFocus } = useLastFocusedIndex(initialFocusedIndex);
  const listRef = useRef<FlatList<T>>(null);

  const handleFocus = useCallback(
    (index: number) => {
      onItemFocus(index);
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    },
    [onItemFocus],
  );

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
          contentContainerStyle={styles.content}
          onEndReached={onEndReached}
          onEndReachedThreshold={2}
          initialNumToRender={8}
          windowSize={5}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onScrollToIndexFailed={(info) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 50);
          }}
          renderItem={({ item, index }) => renderItem(item, index, index === focusedIndex, () => handleFocus(index))}
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
    gap: layout.cardSpacing,
  },
});
