import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { jellyfinClient } from './JellyfinClient';
import type { FetchPage, PageResult } from './ItemPager';
import type { HomeRowRef } from '../../navigation/types';
import { fetchHomeRowItems, type HomeRowConfig } from './homeRows';
import type { TranslationKey } from '../../i18n/translations';
import type { LibrarySortPreference } from '../storage/types';

interface DirectionLabels {
  asc: TranslationKey;
  desc: TranslationKey;
}

/** Shared per-field direction phrasing, reused across whichever fields it fits - "A to Z" reads
 * right for a name sort but not a date one, so this is keyed by field *kind*, not repeated per
 * field. */
const ALPHA_DIRECTION: DirectionLabels = { asc: 'library.sort.direction.aToZ', desc: 'library.sort.direction.zToA' };
const DATE_DIRECTION: DirectionLabels = { asc: 'library.sort.direction.oldestFirst', desc: 'library.sort.direction.newestFirst' };
const RATING_DIRECTION: DirectionLabels = { asc: 'library.sort.direction.lowestFirst', desc: 'library.sort.direction.highestFirst' };
const FOLDER_DIRECTION: DirectionLabels = { asc: 'library.sort.direction.foldersFirst', desc: 'library.sort.direction.foldersLast' };

/** Sort fields exposed in the library sort-by control (a subset of `ItemSortBy` - mirrors the
 * handful of options Kotlin's `SortByButton.kt` actually surfaces per content type). `labelKey`
 * names the field itself ("Name", "Rating"); `direction` supplies the two field-appropriate
 * phrasings `LibraryScreens.tsx`'s sort picker shows as separate, directly-selectable rows
 * ("A to Z"/"Z to A", not a generic "Ascending"/"Descending") - both resolved via `useT()` at
 * display time, not plain strings. */
export const LIBRARY_SORT_OPTIONS = [
  { value: ItemSortBy.IsFolder, labelKey: 'library.sort.folder' as TranslationKey, direction: FOLDER_DIRECTION },
  { value: ItemSortBy.SortName, labelKey: 'library.sort.name' as TranslationKey, direction: ALPHA_DIRECTION },
  { value: ItemSortBy.DateCreated, labelKey: 'library.sort.dateAdded' as TranslationKey, direction: DATE_DIRECTION },
  { value: ItemSortBy.PremiereDate, labelKey: 'library.sort.releaseDate' as TranslationKey, direction: DATE_DIRECTION },
  { value: ItemSortBy.CommunityRating, labelKey: 'library.sort.rating' as TranslationKey, direction: RATING_DIRECTION },
] as const;

export type LibrarySortField = (typeof LIBRARY_SORT_OPTIONS)[number]['value'];
export type SortDirection = 'Ascending' | 'Descending';

/** `IsFolder` alone isn't a useful ordering (every folder ties) - Jellyfin's own clients always
 * pair it with a second field to break those ties, `SortName` here, same as the "folder" sort
 * this app's photo library browsing (`fetchLibraryPage` below) is modeled on. Every other field
 * is already a full ordering on its own. */
function sortFieldsForQuery(sortBy: LibrarySortField): ItemSortBy[] {
  return sortBy === ItemSortBy.IsFolder ? [ItemSortBy.IsFolder, ItemSortBy.SortName] : [sortBy];
}

/** Validates a persisted `JellyfinUser.librarySort[key]` entry back into a real sort choice,
 * falling back to `defaultSortBy`/Ascending for a missing entry or one whose `sortBy` no longer
 * matches any current `LIBRARY_SORT_OPTIONS` value - stored as a loose string (see that type's
 * own comment for why), so this is the one place that re-validates it against the options a
 * screen can actually render/request. `defaultSortBy` defaults to Name - the one screen that
 * wants a different first-time default (a photo library's folder-style browse, see
 * MainDrawerNavigator.tsx) passes Folder explicitly rather than this changing for everyone just
 * because Folder was added to `LIBRARY_SORT_OPTIONS`. */
export function resolveLibrarySort(
  stored: LibrarySortPreference | undefined,
  defaultSortBy: LibrarySortField = ItemSortBy.SortName,
): { sortBy: LibrarySortField; direction: SortDirection } {
  const match = stored && LIBRARY_SORT_OPTIONS.find((option) => option.value === stored.sortBy);
  return match ? { sortBy: match.value, direction: stored.direction } : { sortBy: defaultSortBy, direction: 'Ascending' };
}

export interface LibraryQuery {
  parentId?: string;
  includeItemTypes?: BaseItemKind[];
  recursive?: boolean;
  isFavorite?: boolean;
  sortBy?: LibrarySortField;
  sortDirection?: SortDirection;
}

/** The real content item type(s) a library's own full-contents grid should filter to, derived
 * from its `CollectionType` - mirrors `libraryIcons.ts`'s `ICON_BY_COLLECTION_TYPE` mapping,
 * but for `getItems`' `includeItemTypes` rather than an icon name. Without this, browsing a
 * whole library (the side nav's library row - `MainDrawerNavigator.tsx`) had no type filter at
 * all, so a plain `recursive: true` query also picked up any stray `Folder`-type entries nested
 * anywhere under it (an "extras"/miscellaneous subfolder, or just the library's own on-disk
 * folder structure showing through) - confirmed on-device as a real bug: a blank, imageless
 * tile using the physical folder's own name ("movies"/"films") showed up alongside real movies.
 * `undefined` for a `CollectionType` this app has no specific mapping for (or `null`/missing) -
 * the caller's `includeItemTypes` stays unset in that case, same as before this existed. */
const LIBRARY_ITEM_KINDS_BY_COLLECTION_TYPE: Partial<Record<string, BaseItemKind[]>> = {
  [CollectionType.Movies]: [BaseItemKind.Movie],
  [CollectionType.Tvshows]: [BaseItemKind.Series],
  [CollectionType.Music]: [BaseItemKind.MusicAlbum],
  [CollectionType.Musicvideos]: [BaseItemKind.MusicVideo],
  [CollectionType.Homevideos]: [BaseItemKind.Video, BaseItemKind.Photo],
  [CollectionType.Boxsets]: [BaseItemKind.BoxSet],
  [CollectionType.Books]: [BaseItemKind.Book],
  [CollectionType.Photos]: [BaseItemKind.Photo],
};

export function libraryItemKinds(collectionType: CollectionType | string | null | undefined): BaseItemKind[] | undefined {
  return collectionType ? LIBRARY_ITEM_KINDS_BY_COLLECTION_TYPE[collectionType] : undefined;
}

/** Side nav library row order (`MainDrawerNavigator.tsx`) - Movies, then TV Shows, then Photos,
 * then Live TV, then anything else in whatever order the server itself returned (often
 * alphabetical - `getUserViews` doesn't group by type). A type not in this list, or a library
 * with no `CollectionType` at all, sorts after everything that is. `Array.prototype.sort` is
 * spec-guaranteed stable since ES2019, so multiple libraries of the same type (two Movies
 * libraries, say) keep their original relative order rather than getting shuffled. */
const LIBRARY_ROW_ORDER: CollectionType[] = [CollectionType.Movies, CollectionType.Tvshows, CollectionType.Photos, CollectionType.Livetv];

function libraryRowPriority(library: BaseItemDto): number {
  const index = library.CollectionType ? LIBRARY_ROW_ORDER.indexOf(library.CollectionType) : -1;
  return index === -1 ? LIBRARY_ROW_ORDER.length : index;
}

export function sortLibrariesByType(libraries: BaseItemDto[]): BaseItemDto[] {
  return [...libraries].sort((a, b) => libraryRowPriority(a) - libraryRowPriority(b));
}

/** Ports `CollectionFolderViewModel.createPager()`'s `GetItemsRequest` case, simplified to the
 * cases Phase 1's nav params actually reach (see navigation/types.ts's `ItemGrid`/
 * `FilteredCollection` comment) - person/artist grid variants are left for a later phase. */
export function fetchLibraryPage(userId: string, query: LibraryQuery): FetchPage<BaseItemDto> {
  const recursive = query.recursive ?? true;
  return async (startIndex, limit): Promise<PageResult<BaseItemDto>> => {
    const { data } = await getItemsApi(jellyfinClient.api).getItems({
      userId,
      parentId: query.parentId,
      includeItemTypes: query.includeItemTypes,
      recursive,
      isFavorite: query.isFavorite,
      startIndex,
      limit,
      sortBy: sortFieldsForQuery(query.sortBy ?? ItemSortBy.SortName),
      sortOrder: [query.sortDirection === 'Descending' ? SortOrder.Descending : SortOrder.Ascending],
      enableTotalRecordCount: true,
      // A non-recursive fetch is a folder-level browse (a photo library's albums, currently the
      // only place this app sets recursive:false - see MainDrawerNavigator.tsx/navigateToItem.ts)
      // rather than a flat content grid, so it also wants the fields a folder tile needs
      // (ChildCount for an item count, Path/MediaSourceCount to tell a real album apart from a
      // leaf item) instead of the plain poster-card fields a recursive movie/show grid gets by
      // default. ParentId is also gated behind Fields (confirmed on-device: without it, every
      // Photo item came back with ParentId undefined, so navigateToItem.ts's Photo case - which
      // needs it to open SlideshowScreen - silently no-op'd on every tap, no error either).
      fields: recursive
        ? undefined
        : [ItemFields.PrimaryImageAspectRatio, ItemFields.SortName, ItemFields.Path, ItemFields.ChildCount, ItemFields.MediaSourceCount, ItemFields.ParentId],
      imageTypeLimit: recursive ? undefined : 1,
    });
    return { items: data.Items ?? [], totalCount: data.TotalRecordCount ?? 0 };
  };
}

/** Paged version of one of Phase 1's fixed home rows, for `MoreHomeRowScreen`. */
export function fetchHomeRowPage(userId: string, row: HomeRowRef): FetchPage<BaseItemDto> {
  // Continue Watching/Next Up have no server-side paging endpoint distinct from the row fetch
  // itself (Kotlin's `GetResumeItemsRequestHandler`/`GetNextUpRequestHandler` just page the
  // same call) - refetch with a larger limit sized to the requested page instead.
  const config: HomeRowConfig =
    row.kind === 'recentlyAdded'
      ? { key: `recentlyAdded:${row.libraryId}`, kind: 'recentlyAdded', title: '', libraryId: row.libraryId }
      : { key: row.kind, kind: row.kind, title: '' };

  return async (startIndex, limit): Promise<PageResult<BaseItemDto>> => {
    const items = await fetchHomeRowItems(userId, config, startIndex + limit);
    return { items: items.slice(startIndex), totalCount: items.length };
  };
}
