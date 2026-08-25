import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { jellyfinClient } from './JellyfinClient';

/**
 * Per-type detail data fetchers (ui/detail/{movie,episode,collection,series}/*ViewModel.kt,
 * ui/detail/PersonPage.kt) plus the favorite/watched mutations every detail page's action
 * buttons need.
 */

export async function fetchItem(userId: string, itemId: string): Promise<BaseItemDto> {
  const { data } = await getUserLibraryApi(jellyfinClient.api).getItem({ userId, itemId });
  return data;
}

export async function fetchSimilarItems(userId: string, itemId: string, limit = 20): Promise<BaseItemDto[]> {
  const { data } = await getLibraryApi(jellyfinClient.api).getSimilarItems({ itemId, userId, limit });
  return data.Items ?? [];
}

/** Locally-hosted trailer files for an item (`item.LocalTrailerCount` says whether any exist,
 * without needing this call up front) - playable through this app's own player, unlike
 * `RemoteTrailers` (external URLs), which this app has no in-app way to open. */
export async function fetchLocalTrailers(userId: string, itemId: string): Promise<BaseItemDto[]> {
  const { data } = await getUserLibraryApi(jellyfinClient.api).getLocalTrailers({ itemId, userId });
  return data;
}

/** A person's movie/series/episode credits (PersonPage.kt's three conditional rows). */
export async function fetchPersonCredits(
  userId: string,
  personId: string,
  includeItemTypes: BaseItemKind[],
  limit = 20,
): Promise<BaseItemDto[]> {
  const { data } = await getItemsApi(jellyfinClient.api).getItems({
    userId,
    personIds: [personId],
    includeItemTypes,
    recursive: true,
    limit,
    sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName],
    sortOrder: [SortOrder.Descending],
  });
  return data.Items ?? [];
}

/** A collection/box set's direct contents (mixed-type grid - see CollectionDetail.tsx). */
export async function fetchCollectionItems(userId: string, collectionId: string, limit = 200): Promise<BaseItemDto[]> {
  const { data } = await getItemsApi(jellyfinClient.api).getItems({
    userId,
    parentId: collectionId,
    recursive: false,
    limit,
    sortBy: [ItemSortBy.SortName],
  });
  return data.Items ?? [];
}

export async function fetchSeasons(userId: string, seriesId: string): Promise<BaseItemDto[]> {
  const { data } = await getItemsApi(jellyfinClient.api).getItems({
    userId,
    parentId: seriesId,
    includeItemTypes: [BaseItemKind.Season],
    recursive: false,
    sortBy: [ItemSortBy.IndexNumber],
  });
  return data.Items ?? [];
}

export async function fetchEpisodes(userId: string, seriesId: string, seasonId?: string): Promise<BaseItemDto[]> {
  const { data } = await getTvShowsApi(jellyfinClient.api).getEpisodes({ seriesId, userId, seasonId });
  return data.Items ?? [];
}

function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Flat play-all/shuffle-all playlist from a Series/Collection (`Destination.PlaybackList`,
 * `PlaylistCreator.kt`). */
export async function fetchPlaylistItems(
  userId: string,
  parentId: string,
  options: { recursive?: boolean; shuffle?: boolean } = {},
): Promise<BaseItemDto[]> {
  const { data } = await getItemsApi(jellyfinClient.api).getItems({
    userId,
    parentId,
    recursive: options.recursive ?? true,
    includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Episode, BaseItemKind.Video],
    sortBy: [ItemSortBy.SortName],
  });
  const items = data.Items ?? [];
  return options.shuffle ? shuffleArray(items) : items;
}

export async function setFavorite(userId: string, itemId: string, favorite: boolean): Promise<void> {
  const api = getUserLibraryApi(jellyfinClient.api);
  if (favorite) {
    await api.markFavoriteItem({ itemId, userId });
  } else {
    await api.unmarkFavoriteItem({ itemId, userId });
  }
}

export async function setWatched(userId: string, itemId: string, watched: boolean): Promise<void> {
  const api = getPlaystateApi(jellyfinClient.api);
  if (watched) {
    await api.markPlayedItem({ itemId, userId });
  } else {
    await api.markUnplayedItem({ itemId, userId });
  }
}
