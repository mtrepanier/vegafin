import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PersonKind } from '@jellyfin/sdk/lib/generated-client/models/person-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { fetchItem, setFavorite, setWatched } from '../../services/jellyfin/detail';
import { backdropImageUrl } from '../../services/jellyfin/images';
import { formatQuickDetails, ticksToMs } from '../../util/format';
import { DetailActionButtons } from './DetailActionButtons';
import { CastRow } from './CastRow';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  itemId: string;
  navigation: AppNavigationProp<keyof DrawerParamList>;
}

function episodeSubtitle(item: BaseItemDto): string | undefined {
  if (item.ParentIndexNumber == null || item.IndexNumber == null) {
    return item.SeriesName ?? undefined;
  }
  const label = `S${item.ParentIndexNumber}:E${item.IndexNumber}`;
  return item.SeriesName ? `${item.SeriesName} - ${label}` : label;
}

// ui/detail/episode/EpisodeDetails.kt equivalent - a single header, no cast/similar rows
// beyond the episode's own guest stars (reached instead from the More Like This-style flows
// on the Movie/Series pages, which episodes don't have an equivalent of).
export function EpisodeDetail({ itemId, navigation }: Props) {
  const { colors } = useTheme();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const [item, setItem] = useState<BaseItemDto | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    fetchItem(userId, itemId).then((data) => !cancelled && setItem(data));
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

  const cast = (item.People ?? []).filter((p) => p.Type === PersonKind.Actor || p.Type === PersonKind.GuestStar).slice(0, 20);
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

  return (
    <ScrollView style={{ backgroundColor: colors.background }}>
      {backdropUri ? (
        <View style={styles.backdrop}>
          <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.45 }]} />
        </View>
      ) : null}

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.primary }]}>{episodeSubtitle(item)}</Text>
        <Text style={[styles.title, { color: colors.onBackground }]}>{item.Name}</Text>
        <Text style={[styles.quickDetails, { color: colors.onSurfaceVariant }]}>{formatQuickDetails(item)}</Text>

        <View style={styles.actions}>
          <DetailActionButtons
            item={item}
            onPlay={handlePlay}
            onToggleFavorite={handleToggleFavorite}
            onToggleWatched={handleToggleWatched}
          />
        </View>

        {item.Overview ? <Text style={[styles.overview, { color: colors.onSurface }]}>{item.Overview}</Text> : null}
      </View>

      <CastRow title="Guest Stars" people={cast} navigation={navigation} />
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
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  quickDetails: {
    fontSize: 14,
  },
  actions: {
    marginTop: 8,
    marginBottom: 8,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
  },
});
