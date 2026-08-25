import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { usePinScrollToStart } from '../focus/usePinScrollToStart';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { useScreenBackdrop } from '../navigation/screenBackdropContext';
import { fetchEpisodes, fetchItem, fetchSeasons, fetchSimilarItems, setFavorite, setWatched } from '../services/jellyfin/detail';
import { ticksToMs } from '../util/format';
import { PosterRow } from '../components/PosterRow';
import { DetailHero } from './detail/DetailHero';
import { SeasonTabs } from './detail/series/SeasonTabs';
import { EpisodeRow } from './detail/series/EpisodeRow';
import { FocusedEpisodeFooter } from './detail/series/FocusedEpisodeFooter';
import { CastRow } from './detail/CastRow';
import type { AppNavigationProp, DrawerParamList } from '../navigation/types';

/**
 * ui/detail/series/SeriesOverview.kt equivalent - the binge-watch page: a Home/Movie-style
 * hero for the series itself, season tabs, an episode row, and action buttons for whichever
 * episode currently has focus in that row. This is Phase 1's target for series browsing
 * generally (see MediaItemScreen.tsx) - the classic non-binge SeriesDetails page wasn't built.
 */
export function SeriesOverviewScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'SeriesOverview'>>();
  const navigation = useNavigation<AppNavigationProp<'SeriesOverview'>>();
  // Keyed by itemId (see MediaItemScreen.tsx's key comment for why): navigating from one
  // series to another calls navigate() with new params on this same route, which would
  // otherwise reuse this body's ScrollView/focus state instead of starting fresh.
  return <SeriesOverviewBody key={route.params.itemId} route={route} navigation={navigation} />;
}

function SeriesOverviewBody({
  route,
  navigation,
}: {
  route: RouteProp<DrawerParamList, 'SeriesOverview'>;
  navigation: AppNavigationProp<'SeriesOverview'>;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  usePinScrollToStart(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  const { itemId, seasonEpisode } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const { setItem: setBackdropItem } = useScreenBackdrop();

  const [series, setSeries] = useState<BaseItemDto | null>(null);
  const [seasons, setSeasons] = useState<BaseItemDto[] | null>(null);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [episodes, setEpisodes] = useState<BaseItemDto[] | null>(null);
  const [focusedEpisode, setFocusedEpisode] = useState<BaseItemDto | null>(null);
  const [similar, setSimilar] = useState<BaseItemDto[]>([]);

  // Load the series and its seasons, then resolve the initial season from a deep link if given.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    Promise.all([fetchItem(userId, itemId), fetchSeasons(userId, itemId)]).then(([seriesData, seasonData]) => {
      if (cancelled) {
        return;
      }
      setSeries(seriesData);
      setBackdropItem(seriesData);
      setSeasons(seasonData);
      const deepLinkIndex = seasonEpisode?.seasonId
        ? seasonData.findIndex((season) => season.Id === seasonEpisode.seasonId)
        : -1;
      setSelectedSeasonIndex(deepLinkIndex >= 0 ? deepLinkIndex : 0);
    });
    fetchSimilarItems(userId, itemId).then((data) => !cancelled && setSimilar(data));
    return () => {
      cancelled = true;
    };
    // seasonEpisode is only consulted for the initial deep link, not on every param identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, itemId, setBackdropItem]);

  // Same reasoning as HomeScreen.tsx/MovieDetail.tsx: the backdrop lives outside this screen
  // (rendered at MainDrawerNavigator level so it can go full-bleed behind the side nav), and
  // Kepler's drawer keeps inactive screens frozen rather than unmounted, so nothing here would
  // otherwise clear it on navigating away.
  useFocusEffect(
    useCallback(() => {
      return () => setBackdropItem(null);
    }, [setBackdropItem]),
  );

  // Load the selected season's episodes.
  useEffect(() => {
    if (!userId || !seasons?.[selectedSeasonIndex]?.Id) {
      return;
    }
    let cancelled = false;
    setEpisodes(null);
    fetchEpisodes(userId, itemId, seasons[selectedSeasonIndex].Id).then((data) => {
      if (cancelled) {
        return;
      }
      setEpisodes(data);
      const initial = seasonEpisode?.episodeId ? data.find((e) => e.Id === seasonEpisode.episodeId) : undefined;
      setFocusedEpisode(initial ?? data[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, itemId, seasons, selectedSeasonIndex]);

  if (!series || !seasons || !userId) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const handlePlay = (episode: BaseItemDto) => {
    const positionMs = episode.UserData?.PlaybackPositionTicks ? ticksToMs(episode.UserData.PlaybackPositionTicks) : 0;
    if (episode.Id) {
      navigation.navigate('Playback', { itemId: episode.Id, positionMs });
    }
  };

  const updateEpisode = (episodeId: string, patch: Partial<BaseItemDto['UserData']>) => {
    setEpisodes((prev) => prev?.map((e) => (e.Id === episodeId ? { ...e, UserData: { ...e.UserData, ...patch } } : e)) ?? prev);
    setFocusedEpisode((prev) => (prev?.Id === episodeId ? { ...prev, UserData: { ...prev.UserData, ...patch } } : prev));
  };

  const handleToggleFavorite = async (episode: BaseItemDto) => {
    if (!episode.Id) return;
    const favorite = !episode.UserData?.IsFavorite;
    updateEpisode(episode.Id, { IsFavorite: favorite });
    await setFavorite(userId, episode.Id, favorite);
  };

  const handleToggleWatched = async (episode: BaseItemDto) => {
    if (!episode.Id) return;
    const watched = !episode.UserData?.Played;
    updateEpisode(episode.Id, { Played: watched });
    await setWatched(userId, episode.Id, watched);
  };

  const cast = (series.People ?? []).filter((p) => p.Type === PersonKind.Actor).slice(0, 20);
  const guestStars = (focusedEpisode?.People ?? []).filter((p) => p.Type === PersonKind.GuestStar).slice(0, 20);
  const selectedSeasonId = seasons[selectedSeasonIndex]?.Id;

  return (
    // No background color here, and no local backdrop image - same reasoning as
    // MovieDetail.tsx: ScreenBackdrop.tsx (driven by the useScreenBackdrop() call above) already
    // covers the whole screen behind this content.
    <ScrollView ref={scrollRef} focusItemAlignment="start">
      <View style={styles.content}>
        <DetailHero item={series} detailItem={focusedEpisode ?? series} />
        {/* Fixed height, not just numberOfLines - reserved regardless of whether the focused
            episode's synopsis is 1 line, 2 lines, or missing entirely, so everything below
            (season tabs, episode row, buttons) doesn't shift up/down as focus moves between
            episodes with different synopsis lengths. */}
        <View style={styles.overviewBox}>
          {focusedEpisode?.Overview ? (
            <Text numberOfLines={2} style={[styles.overview, { color: colors.onSurface }]}>
              {focusedEpisode.Overview}
            </Text>
          ) : null}
        </View>
      </View>

      <SeasonTabs seasons={seasons} selectedIndex={selectedSeasonIndex} onSelect={setSelectedSeasonIndex} autoFocus={false} />

      {episodes === null ? (
        <View style={styles.episodesLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <EpisodeRow
          key={selectedSeasonId}
          episodes={episodes}
          initialFocusEpisodeId={seasonEpisode?.episodeId}
          onFocusEpisode={setFocusedEpisode}
          onPressEpisode={handlePlay}
        />
      )}

      {focusedEpisode ? (
        <View style={styles.actions}>
          <FocusedEpisodeFooter
            episode={focusedEpisode}
            onPlay={handlePlay}
            onToggleFavorite={handleToggleFavorite}
            onToggleWatched={handleToggleWatched}
          />
        </View>
      ) : null}

      <CastRow people={cast} navigation={navigation} autoFocus={false} />
      <CastRow title="Guest Stars" people={guestStars} navigation={navigation} autoFocus={false} />
      <PosterRow title="More Like This" items={similar} navigation={navigation} autoFocus={false} showTitles={false} />
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
    paddingHorizontal: layout.contentPadding,
    paddingTop: 64,
    paddingBottom: layout.rowSpacing,
    maxWidth: 900,
    gap: 8,
  },
  overviewBox: {
    // 2 lines' worth of styles.overview's own lineHeight - see the comment above where this is
    // used for why a fixed height, not just numberOfLines, is what actually prevents the shift.
    height: 44,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 540,
  },
  actions: {
    // No paddingHorizontal here - FocusedEpisodeFooter already applies
    // layout.contentPadding itself; adding it again here doubled the button row's left offset
    // to 80px instead of 40, visibly out of alignment with the season tabs/episode row above
    // it. No marginTop either - EpisodeRow (via ItemRow) already trails with its own
    // marginBottom: layout.rowSpacing, and stacking a second gap on top of that read as too
    // much space between the episode row and these buttons.
    marginBottom: layout.rowTitleGap,
  },
  episodesLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
