import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { useTVEventHandler, type HWEvent } from '@amazon-devices/react-native-kepler';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { useTheme } from '../theme/ThemeContext';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { useInfiniteItemList } from '../services/jellyfin/ItemPager';
import { fetchLibraryPage, resolveLibrarySort } from '../services/jellyfin/library';
import { primaryImageUrl } from '../services/jellyfin/images';
import type { RootStackParamList } from '../navigation/types';

const KEY_EVENT_DEDUPE_MS = 350;

/**
 * ui/slideshow/SlideshowPage.kt equivalent - a full-screen single-photo viewer with
 * remote-driven Left/Right to move to the previous/next photo in the same folder. Not the
 * auto-advancing screensaver AppScreensaver.kt also covers (see Roadmap) - this is the manual
 * viewer that a screensaver mode would eventually build on top of.
 *
 * Deliberately re-fetches its own copy of the containing folder's item list (by `parentId`)
 * rather than the caller handing over whatever the grid already had loaded: the grid's list may
 * be paged/partial, and re-fetching with the same sort (`resolveLibrarySort` against the same
 * `${parentId}-` key `ItemGridScreen` persists under) keeps next/previous walking the exact
 * order the user saw there, independent of how much of it happened to be loaded already.
 */
export function SlideshowScreen() {
  const { colors } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'Slideshow'>>();
  const { parentId, itemId } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const { width } = useWindowDimensions();

  const sortKey = `${parentId}-`;
  const sort = resolveLibrarySort(currentUser?.user.librarySort?.[sortKey], ItemSortBy.IsFolder);

  const fetchPage = useCallback(
    (startIndex: number, limit: number) =>
      fetchLibraryPage(userId ?? '', { parentId, recursive: false, sortBy: sort.sortBy, sortDirection: sort.direction })(startIndex, limit),
    [userId, parentId, sort.sortBy, sort.direction],
  );
  const { items, totalCount, loading, loadMore } = useInfiniteItemList(fetchPage);

  // Folders can be mixed in with photos at this level (see MainDrawerNavigator.tsx's Photos
  // case) - only Photo-kind items are ever something to step through here.
  const photos = useMemo(() => items.filter((item) => item.Type === BaseItemKind.Photo), [items]);
  const hasMorePages = totalCount == null || items.length < totalCount;

  const [currentId, setCurrentId] = useState(itemId);
  const currentIndex = photos.findIndex((p) => p.Id === currentId);
  const pendingStepRef = useRef(false);

  // Resolves the initial deep link: the tapped photo may be several pages deep (this screen
  // pages from 0 independently of the grid), so keep loading until it turns up. Waits for the
  // pager's own first response (`totalCount !== null`) before paging further itself, so it
  // doesn't race the pager's own mount-time fetch with a redundant one of its own.
  useEffect(() => {
    if (loading || currentIndex !== -1 || totalCount === null) {
      return;
    }
    if (hasMorePages) {
      loadMore();
    }
  }, [currentIndex, hasMorePages, loading, totalCount, loadMore]);

  // Resolves a goNext() that ran past what's loaded so far, once the next page arrives.
  useEffect(() => {
    if (pendingStepRef.current && currentIndex !== -1 && currentIndex + 1 < photos.length) {
      setCurrentId(photos[currentIndex + 1].Id ?? currentId);
      pendingStepRef.current = false;
    }
  }, [photos, currentIndex, currentId]);

  const goNext = useCallback(() => {
    if (currentIndex === -1) {
      return;
    }
    if (currentIndex + 1 < photos.length) {
      setCurrentId(photos[currentIndex + 1].Id ?? currentId);
    } else if (hasMorePages) {
      pendingStepRef.current = true;
      loadMore();
    }
  }, [currentIndex, photos, hasMorePages, loadMore, currentId]);

  const goPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentId(photos[currentIndex - 1].Id ?? currentId);
    }
  }, [currentIndex, photos, currentId]);

  const lastKeyEventRef = useRef<{ type: string; time: number }>({ type: '', time: 0 });
  // No 'back' case here - confirmed on-device this screen doesn't need one. React Navigation's
  // NavigationContainer already wires its own hardware-back handling independently
  // (useBackButton.native.js: a BackHandler.addEventListener('hardwareBackPress', ...) that
  // calls goBack() itself, unrelated to Kepler's HWEvent system this hook otherwise reads from).
  // Handling 'back' here too - as PlaybackScreens.tsx/LiveTvPlayerScreen.tsx do, since they
  // need custom cleanup before exiting - gave a single physical back press two independent
  // goBack() calls: the first correctly popped Slideshow back to the folder grid, but the
  // second, with nothing left to pop on the root stack, bubbled down into the focused Drawer
  // navigator instead (which *can* still go back - backBehavior="history",
  // MainDrawerNavigator.tsx), popping its history and landing on Home instead. Since a photo
  // viewer has no exit-time cleanup to run, the fix is to just not compete with the automatic
  // handler at all, rather than trying to out-dedupe it.
  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      const type = (event.eventType ?? '').replace(/_up$/, '');
      const now = Date.now();
      if (lastKeyEventRef.current.type === type && now - lastKeyEventRef.current.time < KEY_EVENT_DEDUPE_MS) {
        return;
      }
      lastKeyEventRef.current = { type, time: now };

      switch (type) {
        case 'right':
          goNext();
          break;
        case 'left':
          goPrevious();
          break;
        default:
          break;
      }
    },
    [goNext, goPrevious],
  );
  useTVEventHandler(handleTVEvent);

  const currentPhoto = currentIndex !== -1 ? photos[currentIndex] : undefined;
  const imageUri = currentPhoto ? primaryImageUrl(currentPhoto, Math.round(width)) : undefined;

  if (!userId) {
    return null;
  }

  return (
    <View style={styles.container}>
      {imageUri ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}
      {!currentPhoto ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
      {currentPhoto?.Name ? (
        <View style={styles.captionBar}>
          <Text style={styles.captionText} numberOfLines={1}>
            {currentPhoto.Name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
  },
});
