import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../theme/ThemeContext';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { fetchEpisodes, fetchItem, fetchSeasons, setFavorite, setWatched } from '../services/jellyfin/detail';
import { ticksToMs } from '../util/format';
import { SeasonTabs } from './detail/series/SeasonTabs';
import { EpisodeRow } from './detail/series/EpisodeRow';
import { FocusedEpisodeHeader } from './detail/series/FocusedEpisodeHeader';
import { FocusedEpisodeFooter } from './detail/series/FocusedEpisodeFooter';
import { CastRow } from './detail/CastRow';
import type { AppNavigationProp, DrawerParamList } from '../navigation/types';

/**
 * ui/detail/series/SeriesOverview.kt equivalent - the binge-watch page: season tabs, an
 * episode row, and a header/footer that track whichever episode currently has focus in that
 * row. This is Phase 1's target for series browsing generally (see MediaItemScreen.tsx) - the
 * classic non-binge SeriesDetails page wasn't built.
 */
export function SeriesOverviewScreen() {
  const { colors } = useTheme();
  const route = useRoute<RouteProp<DrawerParamList, 'SeriesOverview'>>();
  const navigation = useNavigation<AppNavigationProp<'SeriesOverview'>>();
  const { itemId, seasonEpisode } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [series, setSeries] = useState<BaseItemDto | null>(null);
  const [seasons, setSeasons] = useState<BaseItemDto[] | null>(null);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [episodes, setEpisodes] = useState<BaseItemDto[] | null>(null);
  const [focusedEpisode, setFocusedEpisode] = useState<BaseItemDto | null>(null);

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
      setSeasons(seasonData);
      const deepLinkIndex = seasonEpisode?.seasonId
        ? seasonData.findIndex((season) => season.Id === seasonEpisode.seasonId)
        : -1;
      setSelectedSeasonIndex(deepLinkIndex >= 0 ? deepLinkIndex : 0);
    });
    return () => {
      cancelled = true;
    };
    // seasonEpisode is only consulted for the initial deep link, not on every param identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, itemId]);

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
  const selectedSeasonId = seasons[selectedSeasonIndex]?.Id;

  return (
    <ScrollView style={{ backgroundColor: colors.background }}>
      <FocusedEpisodeHeader series={series} episode={focusedEpisode} />
      {focusedEpisode ? (
        <FocusedEpisodeFooter
          episode={focusedEpisode}
          onPlay={handlePlay}
          onToggleFavorite={handleToggleFavorite}
          onToggleWatched={handleToggleWatched}
        />
      ) : null}

      <SeasonTabs seasons={seasons} selectedIndex={selectedSeasonIndex} onSelect={setSelectedSeasonIndex} />

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

      <CastRow people={cast} navigation={navigation} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodesLoading: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
