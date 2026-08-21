import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { usePinScrollToStart } from '../../focus/usePinScrollToStart';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { fetchItem, fetchPersonCredits, setFavorite } from '../../services/jellyfin/detail';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { IconButton } from '../../components/IconButton';
import { PosterRow } from '../../components/PosterRow';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  itemId: string;
  navigation: AppNavigationProp<keyof DrawerParamList>;
}

function formatBio(person: BaseItemDto): string | undefined {
  const parts: string[] = [];
  if (person.PremiereDate) {
    parts.push(`Born ${new Date(person.PremiereDate).toLocaleDateString()}`);
  }
  if (person.ProductionLocations?.[0]) {
    parts.push(person.ProductionLocations[0]);
  }
  if (person.EndDate) {
    parts.push(`Died ${new Date(person.EndDate).toLocaleDateString()}`);
  }
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

// ui/detail/PersonPage.kt equivalent.
export function PersonDetail({ itemId, navigation }: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  usePinScrollToStart(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const [person, setPerson] = useState<BaseItemDto | null>(null);
  const [movies, setMovies] = useState<BaseItemDto[]>([]);
  const [series, setSeries] = useState<BaseItemDto[]>([]);
  const [episodes, setEpisodes] = useState<BaseItemDto[]>([]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    fetchItem(userId, itemId).then((data) => {
      if (cancelled) return;
      setPerson(data);
      if (data.MovieCount) {
        fetchPersonCredits(userId, itemId, [BaseItemKind.Movie]).then((items) => !cancelled && setMovies(items));
      }
      if (data.SeriesCount) {
        fetchPersonCredits(userId, itemId, [BaseItemKind.Series]).then((items) => !cancelled && setSeries(items));
      }
      if (data.EpisodeCount) {
        fetchPersonCredits(userId, itemId, [BaseItemKind.Episode]).then((items) => !cancelled && setEpisodes(items));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, itemId]);

  if (!person || !userId) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const handleToggleFavorite = async () => {
    const favorite = !person.UserData?.IsFavorite;
    setPerson({ ...person, UserData: { ...person.UserData, IsFavorite: favorite } });
    await setFavorite(userId, itemId, favorite);
  };

  const photoUri = primaryImageUrl(person, layout.square.width * 2);
  const bio = formatBio(person);

  return (
    <ScrollView ref={scrollRef} focusItemAlignment="start" style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <View style={[styles.photo, { backgroundColor: colors.surfaceVariant }]}>
          {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.onBackground }]}>{person.Name}</Text>
          {bio ? <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>{bio}</Text> : null}
          <View style={styles.favoriteRow}>
            <IconButton
              icon={person.UserData?.IsFavorite ? 'favorite' : 'favorite-border'}
              active={person.UserData?.IsFavorite}
              onPress={handleToggleFavorite}
              hasTVPreferredFocus
            />
          </View>
          {person.Overview ? <Text style={[styles.overview, { color: colors.onSurface }]}>{person.Overview}</Text> : null}
        </View>
      </View>

      <PosterRow title="Movies" items={movies} navigation={navigation} autoFocus={false} />
      <PosterRow title="TV Shows" items={series} navigation={navigation} autoFocus={false} />
      <PosterRow title="Episodes" items={episodes} navigation={navigation} metrics={layout.landscape} autoFocus={false} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    padding: layout.contentPadding,
    gap: 24,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
  },
  headerText: {
    flex: 1,
    maxWidth: 700,
    gap: 8,
  },
  name: {
    fontSize: 32,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
  },
  favoriteRow: {
    marginVertical: 4,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
  },
});
