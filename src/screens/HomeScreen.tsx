import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@amazon-devices/react-navigation__native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { fetchDefaultHomeRowConfigs, fetchHomeRowItems, homeRowRef, type HomeRowConfig } from '../services/jellyfin/homeRows';
import { primaryImageUrl, thumbImageUrl } from '../services/jellyfin/images';
import { ItemRow } from '../components/ItemRow';
import { PosterCard } from '../components/cards/PosterCard';
import { navigateToItem } from '../navigation/navigateToItem';
import type { AppNavigationProp } from '../navigation/types';

interface RowState {
  config: HomeRowConfig;
  /** null while this row's own fetch is still in flight - each row streams in independently. */
  items: BaseItemDto[] | null;
}

// ui/main/HomePage.kt equivalent - a vertical list of rows, each fetched independently.
export function HomeScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<AppNavigationProp<'Home'>>();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [rows, setRows] = useState<RowState[] | null>(null);
  const [focusedItem, setFocusedItem] = useState<BaseItemDto | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;

    fetchDefaultHomeRowConfigs(userId).then((configs) => {
      if (cancelled) {
        return;
      }
      setRows(configs.map((config) => ({ config, items: null })));

      configs.forEach((config) => {
        fetchHomeRowItems(userId, config)
          .then((items) => {
            if (cancelled) {
              return;
            }
            setRows((prev) => prev?.map((row) => (row.config.key === config.key ? { ...row, items } : row)) ?? prev);
          })
          .catch(() => {
            if (cancelled) {
              return;
            }
            setRows((prev) => prev?.map((row) => (row.config.key === config.key ? { ...row, items: [] } : row)) ?? prev);
          });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!rows) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {focusedItem ? (
        <View style={styles.header}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.onBackground }]}>
            {focusedItem.Name}
          </Text>
          {focusedItem.Overview ? (
            <Text numberOfLines={3} style={[styles.headerOverview, { color: colors.onSurfaceVariant }]}>
              {focusedItem.Overview}
            </Text>
          ) : null}
        </View>
      ) : null}

      {rows.map((row) => {
        if (row.items === null) {
          return (
            <View key={row.config.key} style={styles.rowLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          );
        }
        const isContinueWatching = row.config.kind === 'continueWatching';
        const metrics = isContinueWatching ? layout.landscape : layout.poster;

        return (
          <ItemRow
            key={row.config.key}
            title={row.config.title}
            items={row.items}
            keyExtractor={(item) => item.Id ?? ''}
            showViewMore={row.items.length >= 20}
            onViewMorePress={() =>
              navigation.navigate('MoreHomeRow', { title: row.config.title, row: homeRowRef(row.config) })
            }
            renderItem={(item, _index, hasTVPreferredFocus, onFocus) => (
              <PosterCard
                uri={
                  isContinueWatching
                    ? (thumbImageUrl(item, metrics.width) ?? primaryImageUrl(item, metrics.width))
                    : primaryImageUrl(item, metrics.width)
                }
                metrics={metrics}
                title={item.Name ?? undefined}
                subtitle={item.SeriesName ?? undefined}
                progressPercent={item.UserData?.PlayedPercentage ?? undefined}
                watched={item.UserData?.Played ?? false}
                favorite={item.UserData?.IsFavorite ?? false}
                hasTVPreferredFocus={hasTVPreferredFocus}
                onFocus={() => {
                  onFocus();
                  setFocusedItem(item);
                }}
                onPress={() => navigateToItem(navigation, item)}
              />
            )}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingVertical: layout.contentPadding,
  },
  header: {
    paddingHorizontal: layout.contentPadding,
    marginBottom: layout.rowSpacing,
    maxWidth: 640,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  headerOverview: {
    fontSize: 14,
    marginTop: 8,
  },
  rowLoading: {
    height: layout.poster.height + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
