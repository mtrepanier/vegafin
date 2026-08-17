import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, type PressableStateCallbackType } from 'react-native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../../theme/ThemeContext';
import { layout } from '../../../theme/types';

interface Props {
  seasons: BaseItemDto[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/** Season picker tabs above the episode row (`SeriesOverview.kt`'s season tab strip). */
export function SeasonTabs({ seasons, selectedIndex, onSelect }: Props) {
  const { colors } = useTheme();

  if (seasons.length === 0) {
    return null;
  }

  return (
    <FlatList
      horizontal
      data={seasons}
      keyExtractor={(season, index) => season.Id ?? String(index)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      renderItem={({ item, index }) => {
        const selected = index === selectedIndex;
        return (
          <Pressable onPress={() => onSelect(index)} hasTVPreferredFocus={selected}>
            {({ focused }: PressableStateCallbackType) => (
              <Text
                style={[
                  styles.tab,
                  {
                    borderColor: focused ? colors.border : 'transparent',
                    backgroundColor: selected ? colors.primaryContainer : colors.surfaceVariant,
                    color: selected ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                  },
                ]}
              >
                {item.Name}
              </Text>
            )}
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
