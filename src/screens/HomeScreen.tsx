import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@amazon-devices/react-navigation__native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { usePinScrollToStart } from '../focus/usePinScrollToStart';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { useHomeBackdrop } from '../navigation/homeBackdropContext';
import { fetchDefaultHomeRowConfigs, fetchHomeRowItems, homeRowRef, type HomeRowConfig } from '../services/jellyfin/homeRows';
import { primaryImageUrl, seriesAwarePosterImageUrl } from '../services/jellyfin/images';
import { episodeBadgeLabel } from '../services/jellyfin/episodeBadge';
import { ItemRow } from '../components/ItemRow';
import { PosterCard } from '../components/cards/PosterCard';
import { HomeHero } from './HomeHero';
import { HOME_HERO_CONTENT_HEIGHT } from './homeHeroLayout';
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
  const scrollRef = useRef<ScrollView>(null);
  usePinScrollToStart(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  const navigation = useNavigation<AppNavigationProp<'Home'>>();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [rows, setRows] = useState<RowState[] | null>(null);
  const { item: focusedItem, setItem: setFocusedItem } = useHomeBackdrop();
  // Each row's own y-offset within the ScrollView's content, captured via onLayout below, and
  // used to scroll a row's title fully into view when a card inside it takes focus - see the
  // comment above the ScrollView for why this replaces focusItemAlignment here. Only acts on
  // an actual row change (lastRowKeyRef), not every card focus - a card's onFocus fires for
  // horizontal moves within the same row too, and those don't need a vertical scroll at all.
  const rowOffsetsRef = useRef<Map<string, number>>(new Map());
  const lastRowKeyRef = useRef<string | null>(null);
  const scrollRowIntoView = useCallback((key: string) => {
    if (lastRowKeyRef.current === key) {
      return;
    }
    lastRowKeyRef.current = key;
    const y = rowOffsetsRef.current.get(key);
    if (y != null) {
      scrollRef.current?.scrollTo({ y, animated: true });
    }
  }, []);

  // The hero/backdrop lives outside this screen (MainDrawerNavigator.tsx, so it can render
  // full-bleed behind the side nav) and Kepler's drawer keeps inactive screens frozen rather
  // than unmounted, so nothing here would otherwise clear it on navigating away - it'd linger
  // behind whatever screen comes next.
  useFocusEffect(
    useCallback(() => {
      return () => setFocusedItem(null);
    }, [setFocusedItem]),
  );

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
    <View style={styles.root}>
      {/* A real flex sibling above the rows ScrollView, not scrolled content or an absolute
          overlay - reserves its own height unconditionally (even before a card has taken
          focus) so the rows below never have to guess where they start. Sharing one
          scrollable between the two (an earlier version placed the hero as absolutely-
          positioned content sat above an empty spacer inside the same ScrollView) meant
          Kepler's native focus-driven auto-scroll - which aligns whichever row just claimed
          hasTVPreferredFocus to the *start* of that ScrollView's own viewport - could scroll
          straight past the spacer, pulling the rows up underneath the pinned hero instead of
          stopping below it. Two independent scroll containers can't fight over the same
          offset. */}
      <View style={styles.heroContainer}>{focusedItem ? <HomeHero item={focusedItem} /> : null}</View>

      {/* No focusItemAlignment here - it aligns whichever card actually took focus to the
          viewport's start, not that card's whole row, so a row's own title (rendered above its
          card list) could end up scrolled just past the top edge and clipped. Scroll position
          is driven entirely manually instead (rowOffsetsRef/scrollRowIntoView below), the same
          "pick one authority, not two" fix as ItemRow.tsx's own removed manual scrollToIndex -
          just the opposite direction, since here native alignment is the one giving the wrong
          answer for a compound (title + cards) element. */}
      <ScrollView ref={scrollRef} style={styles.rowsScroll} contentContainerStyle={styles.rowsContent}>
        {rows.map((row, rowIndex) => {
          if (row.items === null) {
            return (
              <View
                key={row.config.key}
                style={styles.rowLoading}
                onLayout={(e) => rowOffsetsRef.current.set(row.config.key, e.nativeEvent.layout.y)}
              >
                <ActivityIndicator color={colors.primary} />
              </View>
            );
          }
          // Continue Watching/Next Up show the parent series' own poster rather than the
          // episode's landscape still - see seriesAwarePosterImageUrl.
          const isEpisodeRow = row.config.kind === 'continueWatching' || row.config.kind === 'nextUp';
          const metrics = layout.poster;

          return (
            <View key={row.config.key} onLayout={(e) => rowOffsetsRef.current.set(row.config.key, e.nativeEvent.layout.y)}>
              <ItemRow
                title={row.config.title}
                items={row.items}
                autoFocus={rowIndex === 0}
                keyExtractor={(item) => item.Id ?? ''}
                showViewMore={row.items.length >= 20}
                onViewMorePress={() =>
                  navigation.navigate('MoreHomeRow', { title: row.config.title, row: homeRowRef(row.config) })
                }
                renderItem={(item, _index, hasTVPreferredFocus, onFocus) => (
                  <PosterCard
                    uri={isEpisodeRow ? seriesAwarePosterImageUrl(item, metrics.width) : primaryImageUrl(item, metrics.width)}
                    metrics={metrics}
                    progressPercent={item.UserData?.PlayedPercentage ?? undefined}
                    watched={item.UserData?.Played ?? false}
                    favorite={item.UserData?.IsFavorite ?? false}
                    episodeBadge={episodeBadgeLabel(item)}
                    hasTVPreferredFocus={hasTVPreferredFocus}
                    onFocus={() => {
                      onFocus();
                      setFocusedItem(item);
                      scrollRowIntoView(row.config.key);
                    }}
                    onPress={() => navigateToItem(navigation, item)}
                  />
                )}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContainer: {
    height: HOME_HERO_CONTENT_HEIGHT,
  },
  rowsScroll: {
    flex: 1,
  },
  rowsContent: {
    paddingBottom: layout.contentPadding,
  },
  rowLoading: {
    height: layout.poster.height + 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
