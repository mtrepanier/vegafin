import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { useInfiniteItemList } from '../../services/jellyfin/ItemPager';
import { fetchHomeRowPage, fetchLibraryPage, LIBRARY_SORT_OPTIONS, type LibrarySortField, type SortDirection } from '../../services/jellyfin/library';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { ItemGrid } from '../../components/ItemGrid';
import { PosterCard } from '../../components/cards/PosterCard';
import { navigateToItem } from '../../navigation/navigateToItem';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

const GRID_COLUMNS = 6;
const LIST_COLUMNS = 1;

interface LibraryGridProps {
  title: string;
  fetchPage: ReturnType<typeof fetchLibraryPage>;
  sortable?: boolean;
  onSortChange?: (sortBy: LibrarySortField, direction: SortDirection) => void;
}

/** Shared grid body, reused by every library-browsing screen (this file's three plus
 * FavoritesScreen.tsx) - mirrors `CollectionFolderView.kt` / `ItemGrid.kt`, simplified per
 * navigation/types.ts's `ItemGrid`/`FilteredCollection` comment: sort + a grid/list toggle, no
 * persisted per-user view preferences (Phase 2 territory). */
export function LibraryGrid({ title, fetchPage, sortable, onSortChange }: LibraryGridProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<AppNavigationProp<keyof DrawerParamList>>();
  const { items, loading, loadMore } = useInfiniteItemList(fetchPage);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortIndex, setSortIndex] = useState(0);

  const cycleSort = () => {
    const next = (sortIndex + 1) % LIBRARY_SORT_OPTIONS.length;
    setSortIndex(next);
    onSortChange?.(LIBRARY_SORT_OPTIONS[next].value, 'Ascending');
  };

  const numColumns = viewMode === 'grid' ? GRID_COLUMNS : LIST_COLUMNS;
  const metrics = viewMode === 'grid' ? layout.poster : layout.landscape;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
        <View style={styles.toolbarButtons}>
          {sortable ? (
            <Pressable onPress={cycleSort} style={[styles.toolbarButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.onSurfaceVariant }}>Sort: {LIBRARY_SORT_OPTIONS[sortIndex].label}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
            style={[styles.toolbarButton, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.onSurfaceVariant }}>{viewMode === 'grid' ? 'Grid' : 'List'}</Text>
          </Pressable>
        </View>
      </View>
      <ItemGrid
        items={items}
        numColumns={numColumns}
        loading={loading}
        onEndReached={loadMore}
        keyExtractor={(item: BaseItemDto) => item.Id ?? ''}
        renderItem={(item, _index, hasTVPreferredFocus, onFocus) => (
          <PosterCard
            uri={primaryImageUrl(item, metrics.width)}
            metrics={metrics}
            title={item.Name ?? undefined}
            subtitle={viewMode === 'list' ? (item.ProductionYear?.toString() ?? undefined) : undefined}
            watched={item.UserData?.Played ?? false}
            favorite={item.UserData?.IsFavorite ?? false}
            progressPercent={item.UserData?.PlayedPercentage ?? undefined}
            hasTVPreferredFocus={hasTVPreferredFocus}
            onFocus={onFocus}
            onPress={() => navigateToItem(navigation, item)}
          />
        )}
      />
    </View>
  );
}

// ui/components/CollectionFolderView.kt equivalent - genre/studio filtered browse.
export function FilteredCollectionScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'FilteredCollection'>>();
  const { itemId, parentType } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [sort, setSort] = useState<{ sortBy: LibrarySortField; direction: SortDirection }>({
    sortBy: LIBRARY_SORT_OPTIONS[0].value,
    direction: 'Ascending',
  });

  const fetchPage = useCallback(
    (startIndex: number, limit: number) =>
      fetchLibraryPage(userId ?? '', {
        parentId: itemId,
        includeItemTypes: [parentType],
        recursive: true,
        sortBy: sort.sortBy,
        sortDirection: sort.direction,
      })(startIndex, limit),
    [userId, itemId, parentType, sort],
  );

  if (!userId) {
    return null;
  }
  return (
    <LibraryGrid
      title="Browse"
      fetchPage={fetchPage}
      sortable
      onSortChange={(sortBy, direction) => setSort({ sortBy, direction })}
    />
  );
}

// ui/components/ItemGrid.kt equivalent - generic paged grid (a library's full contents, a
// genre/studio's items - see navigation/types.ts's ItemGrid comment for the scope this covers).
export function ItemGridScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'ItemGrid'>>();
  const { title, parentId, includeItemTypes } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [sort, setSort] = useState<{ sortBy: LibrarySortField; direction: SortDirection }>({
    sortBy: LIBRARY_SORT_OPTIONS[0].value,
    direction: 'Ascending',
  });

  const fetchPage = useCallback(
    (startIndex: number, limit: number) =>
      fetchLibraryPage(userId ?? '', {
        parentId,
        includeItemTypes,
        recursive: true,
        sortBy: sort.sortBy,
        sortDirection: sort.direction,
      })(startIndex, limit),
    [userId, parentId, includeItemTypes, sort],
  );

  if (!userId) {
    return null;
  }
  return (
    <LibraryGrid
      title={title}
      fetchPage={fetchPage}
      sortable
      onSortChange={(sortBy, direction) => setSort({ sortBy, direction })}
    />
  );
}

// "See more" expansion of a single Home row (see services/jellyfin/homeRows.ts).
export function MoreHomeRowScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'MoreHomeRow'>>();
  const { title, row } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const fetchPage = useCallback(
    (startIndex: number, limit: number) => fetchHomeRowPage(userId ?? '', row)(startIndex, limit),
    [userId, row],
  );

  if (!userId) {
    return null;
  }
  return <LibraryGrid title={title} fetchPage={fetchPage} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.contentPadding,
    paddingTop: layout.contentPadding,
  },
  toolbarButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  toolbarButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
});
