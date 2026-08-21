import React, { useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, type PressableStateCallbackType } from 'react-native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../../theme/ThemeContext';
import { layout } from '../../../theme/types';
import { usePinScrollToStart } from '../../../focus/usePinScrollToStart';

interface Props {
  seasons: BaseItemDto[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** See `ItemRow`'s `autoFocus` doc - false while the episode row below is the page's
   * intended initial focus target instead of the selected season tab. */
  autoFocus?: boolean;
}

/** Season picker tabs above the episode row (`SeriesOverview.kt`'s season tab strip). */
export function SeasonTabs({ seasons, selectedIndex, onSelect, autoFocus = true }: Props) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<BaseItemDto>>(null);
  // Skipped when selectedIndex is nonzero (e.g. deep-linking straight into a later season) -
  // pinning to 0 there would fight that deliberate initial selection.
  usePinScrollToStart(() => {
    if (selectedIndex === 0) {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
  });

  if (seasons.length === 0) {
    return null;
  }

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={seasons}
      keyExtractor={(season, index) => season.Id ?? String(index)}
      showsHorizontalScrollIndicator={false}
      focusItemAlignment="start"
      contentContainerStyle={styles.content}
      initialNumToRender={8}
      windowSize={5}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      renderItem={({ item, index }) => {
        const selected = index === selectedIndex;
        return (
          <Pressable onPress={() => onSelect(index)} hasTVPreferredFocus={autoFocus && selected}>
            {({ focused }: PressableStateCallbackType) => {
              const tabStyle = [
                styles.tab,
                {
                  borderColor: focused ? colors.border : 'transparent',
                  backgroundColor: selected ? colors.primaryContainer : colors.surfaceVariant,
                  color: selected ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                },
              ];
              return <Text style={tabStyle}>{item.Name}</Text>;
            }}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.contentPadding,
    gap: 8,
    paddingBottom: layout.rowTitleGap,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: layout.focusBorderWidth,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
