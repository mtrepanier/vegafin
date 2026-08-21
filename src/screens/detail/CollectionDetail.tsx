import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { fetchCollectionItems, fetchItem, setFavorite } from '../../services/jellyfin/detail';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { IconButton } from '../../components/IconButton';
import { ItemGrid } from '../../components/ItemGrid';
import { PosterCard } from '../../components/cards/PosterCard';
import { navigateToItem } from '../../navigation/navigateToItem';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  itemId: string;
  navigation: AppNavigationProp<keyof DrawerParamList>;
}

// ui/detail/collection/CollectionDetails.kt equivalent - mixed grid only (no separate-row-per-
// type toggle - see the plan's Collection detail scope note).
export function CollectionDetail({ itemId, navigation }: Props) {
  const { colors } = useTheme();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const [item, setItem] = useState<BaseItemDto | null>(null);
  const [items, setItems] = useState<BaseItemDto[]>([]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    fetchItem(userId, itemId).then((data) => !cancelled && setItem(data));
    fetchCollectionItems(userId, itemId).then((data) => !cancelled && setItems(data));
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

  const handleToggleFavorite = async () => {
    const favorite = !item.UserData?.IsFavorite;
    setItem({ ...item, UserData: { ...item.UserData, IsFavorite: favorite } });
    await setFavorite(userId, itemId, favorite);
  };

  const header = (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{item.Name}</Text>
      {item.Overview ? <Text style={[styles.overview, { color: colors.onSurface }]}>{item.Overview}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={() => navigation.navigate('PlaybackList', { itemId, recursive: true })} hasTVPreferredFocus>
          {({ focused }: PressableStateCallbackType) => {
            const primaryButtonStyle = [styles.primaryButton, { backgroundColor: colors.primary, borderColor: focused ? colors.border : 'transparent' }];
            return (
              <View style={primaryButtonStyle}>
                <Icon name="play-arrow" size={22} color={colors.onPrimary} />
                <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>Play All</Text>
              </View>
            );
          }}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('PlaybackList', { itemId, recursive: true, shuffle: true })}>
          {({ focused }: PressableStateCallbackType) => (
            <View style={[styles.secondaryButton, { borderColor: focused ? colors.border : colors.surfaceVariant }]}>
              <Icon name="shuffle" size={20} color={colors.onSurfaceVariant} />
              <Text style={[styles.secondaryLabel, { color: colors.onSurfaceVariant }]}>Shuffle</Text>
            </View>
          )}
        </Pressable>
        <IconButton
          icon={item.UserData?.IsFavorite ? 'favorite' : 'favorite-border'}
          active={item.UserData?.IsFavorite}
          onPress={handleToggleFavorite}
        />
      </View>
    </View>
  );

  const containerStyle = [styles.container, { backgroundColor: colors.background }];
  return (
    <View style={containerStyle}>
      <ItemGrid
        items={items}
        numColumns={6}
        header={header}
        keyExtractor={(collectionItem) => collectionItem.Id ?? ''}
        renderItem={(collectionItem, _index, hasTVPreferredFocus, onFocus) => (
          <PosterCard
            uri={primaryImageUrl(collectionItem, layout.poster.width)}
            title={collectionItem.Name ?? undefined}
            watched={collectionItem.UserData?.Played ?? false}
            favorite={collectionItem.UserData?.IsFavorite ?? false}
            progressPercent={collectionItem.UserData?.PlayedPercentage ?? undefined}
            hasTVPreferredFocus={hasTVPreferredFocus}
            onFocus={onFocus}
            onPress={() => navigateToItem(navigation, collectionItem)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: layout.contentPadding,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 900,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: layout.focusBorderWidth,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: layout.focusBorderWidth,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
