import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import Icon from '../../components/Icon';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { useAppSettings } from '../../services/storage/AppSettingsContext';
import { Clock } from '../../components/Clock';
import { useInfiniteItemList } from '../../services/jellyfin/ItemPager';
import { fetchHomeRowPage, fetchLibraryPage, resolveLibrarySort, LIBRARY_SORT_OPTIONS, type LibrarySortField, type SortDirection } from '../../services/jellyfin/library';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { seriesUnwatchedCount } from '../../services/jellyfin/seriesBadge';
import { ItemGrid } from '../../components/ItemGrid';
import { PosterCard } from '../../components/cards/PosterCard';
import { navigateToItem } from '../../navigation/navigateToItem';
import { useT } from '../../i18n/useTranslation';
import { serverRepository } from '../../services/storage/ServerRepository';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

const GRID_COLUMNS = 6;
const LANDSCAPE_GRID_COLUMNS = 4;
const LIST_COLUMNS = 1;

export type LibrarySort = { sortBy: LibrarySortField; direction: SortDirection };

interface LibraryGridProps {
  title: string;
  fetchPage: ReturnType<typeof fetchLibraryPage>;
  /** Omitted entirely (not just a falsy value) for screens with nothing to sort - a fixed Home
   * row's "see more" expansion (MoreHomeRowScreen) keeps whatever order the row itself already
   * has, the same reason it never passed a `sortable` boolean before this component was
   * rewritten to take the sort value itself instead of just a flag. */
  sort?: LibrarySort;
  onSortChange?: (sortBy: LibrarySortField, direction: SortDirection) => void;
  /** Card shape for this grid's "grid" view mode - defaults to the portrait movie-poster shape
   * (`layout.poster`, ~2:3) every other library uses. A photo library's folder browse
   * (`ItemGridScreen` with `recursive: false`) passes 'landscape' instead, for both album
   * folders and individual photos, since a tall poster shape doesn't suit either - 16:9
   * (`layout.landscape`) reads as a photo/folder thumbnail the way 2:3 reads as a movie poster.
   * "List" view mode already used `layout.landscape` regardless, so this only changes "grid". */
  gridAspect?: 'poster' | 'landscape';
}

/** One field's two rows in the sort picker below - "A to Z"/"Z to A", not a field name plus a
 * generic Ascending/Descending, so each row is a complete, directly-selectable choice on its
 * own (see the SortPicker component's own comment for why this replaced a cycle-through-once
 * toggle). */
function SortPickerRow({ label, selected, hasTVPreferredFocus, onPress }: { label: string; selected: boolean; hasTVPreferredFocus?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const rowStyle = [
          styles.sortPickerRow,
          {
            color: selected ? colors.primary : colors.onSurface,
            backgroundColor: focused ? colors.primaryContainer : 'transparent',
          },
        ];
        return (
          <Text style={rowStyle}>
            {selected ? '✓ ' : ''}
            {label}
          </Text>
        );
      }}
    </Pressable>
  );
}

/** Every sort field's both directions, laid out as directly-selectable rows grouped under a
 * field heading each - replaces an earlier "click the sort button to cycle to the next option,
 * always ascending" toggle, which needed as many presses as there were options (and couldn't
 * reach descending at all) to land on the one you actually wanted. Mirrors PlaybackScreens.tsx's
 * TrackPicker in shape (a floating panel, grouped headings + rows, a Close row rather than
 * intercepting the remote's back button - see that component's own comment for why back doesn't
 * close it either) without importing from it, since it's a different screen's overlay entirely. */
function SortPicker({ current, onSelect, onClose }: { current: LibrarySort; onSelect: (sortBy: LibrarySortField, direction: SortDirection) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={[styles.sortPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {LIBRARY_SORT_OPTIONS.map((option) => (
        <View key={option.value}>
          <Text style={[styles.sortPickerHeading, { color: colors.onSurfaceVariant }]}>{t(option.labelKey)}</Text>
          <SortPickerRow
            label={t(option.direction.asc)}
            selected={current.sortBy === option.value && current.direction === 'Ascending'}
            hasTVPreferredFocus={current.sortBy === option.value && current.direction === 'Ascending'}
            onPress={() => {
              onSelect(option.value, 'Ascending');
              onClose();
            }}
          />
          <SortPickerRow
            label={t(option.direction.desc)}
            selected={current.sortBy === option.value && current.direction === 'Descending'}
            hasTVPreferredFocus={current.sortBy === option.value && current.direction === 'Descending'}
            onPress={() => {
              onSelect(option.value, 'Descending');
              onClose();
            }}
          />
        </View>
      ))}
      <Pressable onPress={onClose} style={styles.sortPickerClose}>
        <Text style={{ color: colors.primary }}>{t('common.close')}</Text>
      </Pressable>
    </View>
  );
}

/** Shared grid body, reused by every library-browsing screen (this file's three plus
 * FavoritesScreen.tsx) - mirrors `CollectionFolderView.kt` / `ItemGrid.kt`, simplified per
 * navigation/types.ts's `ItemGrid`/`FilteredCollection` comment: sort + a grid/list toggle, no
 * persisted per-user view preferences (Phase 2 territory). */
export function LibraryGrid({ title, fetchPage, sort, onSortChange, gridAspect = 'poster' }: LibraryGridProps) {
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation<AppNavigationProp<keyof DrawerParamList>>();
  const { items, loading, loadMore } = useInfiniteItemList(fetchPage);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortPickerOpen, setSortPickerOpen] = useState(false);

  const currentSortOption = sort ? LIBRARY_SORT_OPTIONS.find((o) => o.value === sort.sortBy) : undefined;

  const numColumns = viewMode === 'grid' ? (gridAspect === 'landscape' ? LANDSCAPE_GRID_COLUMNS : GRID_COLUMNS) : LIST_COLUMNS;
  const metrics = viewMode === 'grid' ? (gridAspect === 'landscape' ? layout.landscape : layout.poster) : layout.landscape;

  const { showClock } = useAppSettings();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
        {showClock ? <Clock /> : null}
      </View>
      <View style={styles.toolbar}>
        <View style={styles.toolbarButtons}>
          {sort && currentSortOption ? (
            <Pressable onPress={() => setSortPickerOpen((v) => !v)} style={[styles.toolbarButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.onSurfaceVariant }}>{t('library.sortPrefix', { label: t(currentSortOption.labelKey) })}</Text>
              <Icon
                name={sort.direction === 'Ascending' ? 'arrow-upward' : 'arrow-downward'}
                size={14}
                color={colors.onSurfaceVariant}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
            style={[styles.toolbarButton, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.onSurfaceVariant }}>{viewMode === 'grid' ? t('library.grid') : t('library.list')}</Text>
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
            unwatchedCount={seriesUnwatchedCount(item)}
            hasTVPreferredFocus={hasTVPreferredFocus}
            onFocus={onFocus}
            onPress={() => navigateToItem(navigation, item)}
          />
        )}
      />
      {sortPickerOpen && sort ? (
        <SortPicker current={sort} onSelect={(sortBy, direction) => onSortChange?.(sortBy, direction)} onClose={() => setSortPickerOpen(false)} />
      ) : null}
    </View>
  );
}

// ui/components/CollectionFolderView.kt equivalent - genre/studio filtered browse.
export function FilteredCollectionScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'FilteredCollection'>>();
  const { itemId, parentType } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const t = useT();

  // Also doubles as the key `serverRepository.setLibrarySort` remembers this grid's sort
  // under, and the one `LibraryGrid` itself remounts on below - "which grid this is" is the
  // same identity either way.
  const sortKey = `${itemId}-${parentType}`;
  const [sort, setSort] = useState(() => resolveLibrarySort(currentUser?.user.librarySort?.[sortKey]));
  // React Navigation reuses this same screen instance across different FilteredCollection
  // params rather than remounting it - navigating from one filtered collection to another
  // updates route.params in place, so a lazy useState initializer alone (which only runs once,
  // at first mount) never re-fires for the new collection. Without this effect, the sort picked
  // for the *previous* collection kept being used as-is for whichever one you navigated to next,
  // instead of restoring that collection's own remembered choice. `LibraryGrid`'s `key={sortKey}`
  // below already remounts *its* own local state the same way; this is the parent-level
  // equivalent for state that lives up here instead.
  useEffect(() => {
    setSort(resolveLibrarySort(currentUser?.user.librarySort?.[sortKey]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey]);

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
  // Keyed by the params that identify this grid's content (see MediaItemScreen.tsx's key
  // comment for why): without it, navigating from one filtered collection to another reuses
  // this component instance and its scroll/focus state instead of starting fresh.
  return (
    <LibraryGrid
      key={sortKey}
      title={t('library.browse')}
      fetchPage={fetchPage}
      sort={sort}
      onSortChange={(sortBy, direction) => {
        setSort({ sortBy, direction });
        serverRepository.setLibrarySort(sortKey, sortBy, direction);
      }}
    />
  );
}

// ui/components/ItemGrid.kt equivalent - generic paged grid (a library's full contents, a
// genre/studio's items - see navigation/types.ts's ItemGrid comment for the scope this covers).
export function ItemGridScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'ItemGrid'>>();
  const { title, parentId, includeItemTypes, recursive = true } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  // A folder-style browse (recursive: false - currently only a photo library's albums, see
  // MainDrawerNavigator.tsx) defaults to Folder sort so albums group above loose photos the
  // first time you open it; every other grid keeps defaulting to Name, same as before Folder
  // sort existed.
  const defaultSortBy = recursive ? undefined : ItemSortBy.IsFolder;

  // See FilteredCollectionScreen's own sortKey comment above - same dual role here.
  const sortKey = `${parentId ?? ''}-${(includeItemTypes ?? []).join(',')}`;
  const [sort, setSort] = useState(() => resolveLibrarySort(currentUser?.user.librarySort?.[sortKey], defaultSortBy));
  // Same reset-on-identity-change need as FilteredCollectionScreen above: clicking a different
  // library in the side nav while already on this screen updates route.params on the *same*
  // mounted instance rather than remounting it, so without this effect the sort just picked for
  // the previous library kept being reused for whichever one you clicked next.
  useEffect(() => {
    setSort(resolveLibrarySort(currentUser?.user.librarySort?.[sortKey], defaultSortBy));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortKey]);

  const fetchPage = useCallback(
    (startIndex: number, limit: number) =>
      fetchLibraryPage(userId ?? '', {
        parentId,
        includeItemTypes,
        recursive,
        sortBy: sort.sortBy,
        sortDirection: sort.direction,
      })(startIndex, limit),
    [userId, parentId, includeItemTypes, recursive, sort],
  );

  if (!userId) {
    return null;
  }
  return (
    <LibraryGrid
      key={sortKey}
      title={title}
      fetchPage={fetchPage}
      sort={sort}
      onSortChange={(sortBy, direction) => {
        setSort({ sortBy, direction });
        serverRepository.setLibrarySort(sortKey, sortBy, direction);
      }}
      gridAspect={recursive ? 'poster' : 'landscape'}
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
  const rowKey = row.kind === 'recentlyAdded' ? `${row.kind}-${row.libraryId}` : row.kind;
  return <LibraryGrid key={rowKey} title={title} fetchPage={fetchPage} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: layout.contentPadding,
    paddingTop: 24,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: layout.contentPadding,
    paddingTop: 12,
  },
  toolbarButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  sortPicker: {
    position: 'absolute',
    top: 64,
    right: layout.contentPadding,
    minWidth: 240,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  sortPickerHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sortPickerRow: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  sortPickerClose: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
});
