import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@amazon-devices/react-navigation__native';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { usePinScrollToStart } from '../../focus/usePinScrollToStart';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { useScreenBackdrop } from '../../navigation/screenBackdropContext';
import { fetchItem, fetchLocalTrailers, fetchSimilarItems, setFavorite, setWatched } from '../../services/jellyfin/detail';
import { ticksToMs } from '../../util/format';
import { PosterRow } from '../../components/PosterRow';
import { DetailActionButtons } from './DetailActionButtons';
import { DetailHero } from './DetailHero';
import { CastRow } from './CastRow';
import { TrailerListOverlay } from './TrailerListOverlay';
import { useT } from '../../i18n/useTranslation';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  itemId: string;
  navigation: AppNavigationProp<keyof DrawerParamList>;
}

// ui/detail/movie/MovieDetails.kt equivalent - also covers plain Video items (no dedicated
// composable for those in this port; same layout applies cleanly).
export function MovieDetail({ itemId, navigation }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const scrollRef = useRef<ScrollView>(null);
  usePinScrollToStart(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const [item, setItem] = useState<BaseItemDto | null>(null);
  const [similar, setSimilar] = useState<BaseItemDto[]>([]);
  const [trailersOpen, setTrailersOpen] = useState(false);
  const { setItem: setBackdropItem } = useScreenBackdrop();

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    fetchItem(userId, itemId).then((data) => {
      if (!cancelled) {
        setItem(data);
        setBackdropItem(data);
      }
    });
    fetchSimilarItems(userId, itemId).then((data) => !cancelled && setSimilar(data));
    return () => {
      cancelled = true;
    };
  }, [userId, itemId, setBackdropItem]);

  // Same reasoning as HomeScreen.tsx: the backdrop lives outside this screen (rendered at
  // MainDrawerNavigator level so it can go full-bleed behind the side nav), and Kepler's
  // drawer keeps inactive screens frozen rather than unmounted, so nothing here would
  // otherwise clear it on navigating away.
  useFocusEffect(
    useCallback(() => {
      return () => setBackdropItem(null);
    }, [setBackdropItem]),
  );

  if (!item || !userId) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const cast = (item.People ?? []).filter((p) => p.Type === PersonKind.Actor).slice(0, 20);
  const hasTrailer = (item.LocalTrailerCount ?? 0) > 0;
  const remoteTrailers = item.RemoteTrailers ?? [];

  const handlePlay = () => {
    const positionMs = item.UserData?.PlaybackPositionTicks ? ticksToMs(item.UserData.PlaybackPositionTicks) : 0;
    navigation.navigate('Playback', { itemId, positionMs });
  };

  const handlePlayTrailer = async () => {
    const trailers = await fetchLocalTrailers(userId, itemId);
    const trailer = trailers[0];
    if (trailer?.Id) {
      navigation.navigate('Playback', { itemId: trailer.Id, positionMs: 0 });
    }
  };

  const handleToggleFavorite = async () => {
    const favorite = !item.UserData?.IsFavorite;
    setItem({ ...item, UserData: { ...item.UserData, IsFavorite: favorite } });
    await setFavorite(userId, itemId, favorite);
  };

  const handleToggleWatched = async () => {
    const watched = !item.UserData?.Played;
    setItem({ ...item, UserData: { ...item.UserData, Played: watched } });
    await setWatched(userId, itemId, watched);
  };

  return (
    // No background color here, and no local backdrop image - ScreenBackdrop.tsx (rendered
    // full-bleed at MainDrawerNavigator level, driven by the useScreenBackdrop() call above)
    // already covers the whole screen behind this content: its fade for the header area below,
    // then a solid colors.background fill for everything past that, the same way Home's rows
    // rely on it rather than painting their own background - see the README's Home screen
    // section for why a screen's own background would just cover the backdrop back up.
    <View style={styles.root}>
      <ScrollView ref={scrollRef} focusItemAlignment="start">
        <View style={styles.content}>
          <DetailHero item={item} />

          <View style={styles.actions}>
            <DetailActionButtons
              item={item}
              onPlay={handlePlay}
              onToggleFavorite={handleToggleFavorite}
              onToggleWatched={handleToggleWatched}
              onPlayTrailer={hasTrailer ? handlePlayTrailer : undefined}
              onOpenTrailers={remoteTrailers.length > 0 ? () => setTrailersOpen(true) : undefined}
            />
          </View>

          {item.Taglines?.[0] ? (
            <Text style={[styles.tagline, { color: colors.onSurfaceVariant }]}>{item.Taglines[0]}</Text>
          ) : null}
          {item.Overview ? <Text style={[styles.overview, { color: colors.onSurface }]}>{item.Overview}</Text> : null}
        </View>

        <CastRow people={cast} navigation={navigation} autoFocus={false} />
        <PosterRow title={t('common.moreLikeThis')} items={similar} navigation={navigation} autoFocus={false} showTitles={false} />
      </ScrollView>

      {trailersOpen ? <TrailerListOverlay trailers={remoteTrailers} onClose={() => setTrailersOpen(false)} /> : null}
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
  content: {
    paddingHorizontal: layout.contentPadding,
    paddingTop: 64,
    paddingBottom: layout.contentPadding,
    maxWidth: 900,
    gap: 8,
  },
  actions: {
    marginTop: 8,
    marginBottom: 8,
  },
  tagline: {
    fontStyle: 'italic',
    fontSize: 14,
    maxWidth: 540,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 540,
  },
});
