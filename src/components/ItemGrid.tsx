import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, type ListRenderItem } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { useLastFocusedIndex } from '../focus/useLastFocusedIndex';
import { usePinScrollToStart } from '../focus/usePinScrollToStart';
import { FocusGroup } from '../focus/FocusGroup';

interface Props<T> {
  items: T[];
  numColumns?: number;
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number, hasTVPreferredFocus: boolean, onFocus: () => void) => React.ReactElement;
  onEndReached?: () => void;
  loading?: boolean;
  header?: React.ReactElement | null;
  /**
   * Whether this grid claims `hasTVPreferredFocus` for its remembered card at all - see
   * `ItemRow`'s `autoFocus` doc for why this matters: leave the default `true` only when
   * nothing else on the same screen (e.g. a header Play button) already owns initial focus.
   */
  autoFocus?: boolean;
}

/**
 * Vertical grid (ui/detail/CardGrid.kt). Same focus-restore approach as `ItemRow` - the
 * remembered index just claims `hasTVPreferredFocus` rather than this component redirecting
 * focus itself.
 */
export function ItemGrid<T>({
  items,
  numColumns = 6,
  keyExtractor,
  renderItem,
  onEndReached,
  loading,
  header,
  autoFocus = true,
}: Props<T>) {
  const { colors } = useTheme();
  const { focusedIndex, onItemFocus } = useLastFocusedIndex(0);
  const listRef = useRef<FlatList<T>>(null);
  usePinScrollToStart(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }));

  const handleFocus = useCallback((index: number) => onItemFocus(index), [onItemFocus]);

  const renderRow: ListRenderItem<T> = ({ item, index }) =>
    renderItem(item, index, autoFocus && index === focusedIndex, () => handleFocus(index));

  return (
    <FocusGroup style={styles.group} trapFocusLeft trapFocusRight>
      <FlatList
        ref={listRef}
        data={items}
        key={numColumns}
        numColumns={numColumns}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        focusItemAlignment="start"
        contentContainerStyle={{ padding: layout.contentPadding, gap: layout.cardSpacing }}
        columnWrapperStyle={numColumns > 1 ? { gap: layout.cardSpacing } : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        initialNumToRender={numColumns * 3}
        windowSize={5}
        maxToRenderPerBatch={numColumns * 3}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        ListHeaderComponent={header}
        ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 50);
        }}
        renderItem={renderRow}
      />
    </FocusGroup>
  );
}

const styles = StyleSheet.create({
  group: {
    flex: 1,
  },
  footer: {
    margin: layout.cardSpacing,
  },
});
