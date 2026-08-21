import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { jellyfinClient } from './JellyfinClient';
import type { FetchPage, PageResult } from './ItemPager';
import type { HomeRowRef } from '../../navigation/types';
import { fetchHomeRowItems, type HomeRowConfig } from './homeRows';

/** Sort fields exposed in the library sort-by control (a subset of `ItemSortBy` - mirrors the
 * handful of options Kotlin's `SortByButton.kt` actually surfaces per content type). */
export const LIBRARY_SORT_OPTIONS = [
  { value: ItemSortBy.SortName, label: 'Name' },
  { value: ItemSortBy.DateCreated, label: 'Date Added' },
  { value: ItemSortBy.PremiereDate, label: 'Release Date' },
  { value: ItemSortBy.CommunityRating, label: 'Rating' },
] as const;

export type LibrarySortField = (typeof LIBRARY_SORT_OPTIONS)[number]['value'];
export type SortDirection = 'Ascending' | 'Descending';

export interface LibraryQuery {
  parentId?: string;
  includeItemTypes?: BaseItemKind[];
  recursive?: boolean;
  isFavorite?: boolean;
  sortBy?: LibrarySortField;
  sortDirection?: SortDirection;
}

/** Ports `CollectionFolderViewModel.createPager()`'s `GetItemsRequest` case, simplified to the
 * cases Phase 1's nav params actually reach (see navigation/types.ts's `ItemGrid`/
 * `FilteredCollection` comment) - person/artist grid variants are left for a later phase. */
export function fetchLibraryPage(userId: string, query: LibraryQuery): FetchPage<BaseItemDto> {
  return async (startIndex, limit): Promise<PageResult<BaseItemDto>> => {
    const { data } = await getItemsApi(jellyfinClient.api).getItems({
      userId,
      parentId: query.parentId,
      includeItemTypes: query.includeItemTypes,
      recursive: query.recursive ?? true,
      isFavorite: query.isFavorite,
      startIndex,
      limit,
      sortBy: [query.sortBy ?? ItemSortBy.SortName],
      sortOrder: [query.sortDirection === 'Descending' ? SortOrder.Descending : SortOrder.Ascending],
      enableTotalRecordCount: true,
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
