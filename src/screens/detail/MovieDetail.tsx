import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { usePinScrollToStart } from '../../focus/usePinScrollToStart';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { fetchItem, fetchSimilarItems, setFavorite, setWatched } from '../../services/jellyfin/detail';
import { backdropImageUrl } from '../../services/jellyfin/images';
import { formatQuickDetails, ticksToMs } from '../../util/format';
import { PosterRow } from '../../components/PosterRow';
import { DetailActionButtons } from './DetailActionButtons';
import { CastRow } from './CastRow';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  itemId: string;
  navigation: AppNavigationProp<keyof DrawerParamList>;
}

// ui/detail/movie/MovieDetails.kt equivalent - also covers plain Video items (no dedicated
// composable for those in this port; same layout applies cleanly).
export function MovieDetail({ itemId, navigation }: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  usePinScrollToStart(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const [item, setItem] = useState<BaseItemDto | null>(null);
  const [similar, setSimilar] = useState<BaseItemDto[]>([]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    fetchItem(userId, itemId).then((data) => !cancelled && setItem(data));
    fetchSimilarItems(userId, itemId).then((data) => !cancelled && setSimilar(data));
    return () => {
      cancelled = true;
    };
  }, [userId, itemId]);

  if (!item || !userId) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const cast = (item.People ?? []).filter((p) => p.Type === PersonKind.Actor).slice(0, 20);
  const backdropUri = backdropImageUrl(item, 1280);

  const handlePlay = () => {
    const positionMs = item.UserData?.PlaybackPositionTicks ? ticksToMs(item.UserData.PlaybackPositionTicks) : 0;
    navigation.navigate('Playback', { itemId, positionMs });
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

  const scrimStyle = [StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.45 }];
  return (
    <ScrollView ref={scrollRef} focusItemAlignment="start" style={{ backgroundColor: colors.background }}>
      {backdropUri ? (
        <View style={styles.backdrop}>
          <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={scrimStyle} />
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.onBackground }]}>{item.Name}</Text>
        <Text style={[styles.quickDetails, { color: colors.onSurfaceVariant }]}>{formatQuickDetails(item)}</Text>
        {item.Genres?.length ? (
          <Text style={[styles.genres, { color: colors.onSurfaceVariant }]}>{item.Genres.join(', ')}</Text>
        ) : null}

        <View style={styles.actions}>
          <DetailActionButtons
            item={item}
            onPlay={handlePlay}
            onToggleFavorite={handleToggleFavorite}
            onToggleWatched={handleToggleWatched}
          />
        </View>

        {item.Taglines?.[0] ? (
          <Text style={[styles.tagline, { color: colors.onSurfaceVariant }]}>{item.Taglines[0]}</Text>
        ) : null}
        {item.Overview ? <Text style={[styles.overview, { color: colors.onSurface }]}>{item.Overview}</Text> : null}
      </View>

      <CastRow people={cast} navigation={navigation} autoFocus={false} />
      <PosterRow title="More Like This" items={similar} navigation={navigation} autoFocus={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  content: {
    padding: layout.contentPadding,
    maxWidth: 900,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  quickDetails: {
    fontSize: 14,
  },
  genres: {
    fontSize: 14,
  },
  actions: {
    marginTop: 8,
    marginBottom: 8,
  },
  tagline: {
    fontStyle: 'italic',
    fontSize: 14,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
  },
});
