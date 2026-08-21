import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api';
import { getUserLibraryApi } from '@jellyfin/sdk/lib/utils/api/user-library-api';
import { getUserViewsApi } from '@jellyfin/sdk/lib/utils/api/user-views-api';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { jellyfinClient } from './JellyfinClient';
import type { HomeRowRef } from '../../navigation/types';

const ROW_LIMIT = 20;

/** Library types Phase 1's fixed home rows cover (matches Kotlin's `createDefault()`). */
const RECENTLY_ADDED_COLLECTION_TYPES = new Set<string>([CollectionType.Movies, CollectionType.Tvshows]);

export type HomeRowConfig =
  | { key: string; kind: 'continueWatching'; title: string }
  | { key: string; kind: 'nextUp'; title: string }
  | { key: string; kind: 'recentlyAdded'; title: string; libraryId: string };

export function homeRowRef(config: HomeRowConfig): HomeRowRef {
  switch (config.kind) {
    case 'continueWatching':
      return { kind: 'continueWatching' };
    case 'nextUp':
      return { kind: 'nextUp' };
    case 'recentlyAdded':
      return { kind: 'recentlyAdded', libraryId: config.libraryId };
  }
}

export async function fetchUserLibraries(userId: string): Promise<BaseItemDto[]> {
  const { data } = await getUserViewsApi(jellyfinClient.api).getUserViews({ userId });
  return data.Items ?? [];
}

/**
 * Fixed default row layout: Continue Watching, then Next Up, then one Recently Added row per
 * movie/TV library - mirrors `HomeSettingsService.createDefault()` without the
 * user-configurable row settings UI around it (that's Phase 2 "Settings screens"). Kept as two
 * separate rows (matching AmbientFlare/astra-tv, a separate Jellyfin-for-Vega client tested on
 * real Fire TV hardware) rather than merged into one - an earlier version combined them via a
 * client-side SeriesId dedup, but that just meant genuinely in-progress items got crowded out
 * whenever a same-series "next up" entry happened to load first.
 */
export async function fetchDefaultHomeRowConfigs(userId: string): Promise<HomeRowConfig[]> {
  const libraries = await fetchUserLibraries(userId);
  const configs: HomeRowConfig[] = [
    { key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' },
    { key: 'nextUp', kind: 'nextUp', title: 'Next Up' },
  ];

  for (const library of libraries) {
    if (!library.Id || !library.CollectionType || !RECENTLY_ADDED_COLLECTION_TYPES.has(library.CollectionType)) {
      continue;
    }
    configs.push({
      key: `recentlyAdded:${library.Id}`,
      kind: 'recentlyAdded',
      title: `Latest ${library.Name ?? ''}`.trim(),
      libraryId: library.Id,
    });
  }

  return configs;
}

/** In-progress (resumable) items - movies/episodes with a saved playback position. */
async function fetchResumeRow(userId: string, limit: number): Promise<BaseItemDto[]> {
  const { data } = await getItemsApi(jellyfinClient.api).getResumeItems({ userId, limit });
  return data.Items ?? [];
}

/** The next unwatched episode for each in-progress series - not filtered against Continue
 * Watching's own results, matching AmbientFlare/astra-tv (a separate Jellyfin-for-Vega client
 * tested on real Fire TV hardware): the server's own `/Shows/NextUp` already excludes a series
 * whose next episode is the one actively being resumed. */
async function fetchNextUpRow(userId: string, limit: number): Promise<BaseItemDto[]> {
  const { data } = await getTvShowsApi(jellyfinClient.api).getNextUp({ userId, limit });
  return data.Items ?? [];
}

async function fetchRecentlyAddedRow(userId: string, libraryId: string, limit: number): Promise<BaseItemDto[]> {
  const { data } = await getUserLibraryApi(jellyfinClient.api).getLatestMedia({ userId, parentId: libraryId, limit });
  return data;
}

export async function fetchHomeRowItems(userId: string, config: HomeRowConfig, limit = ROW_LIMIT): Promise<BaseItemDto[]> {
  switch (config.kind) {
    case 'continueWatching':
      return fetchResumeRow(userId, limit);
    case 'nextUp':
      return fetchNextUpRow(userId, limit);
    case 'recentlyAdded':
      return fetchRecentlyAddedRow(userId, config.libraryId, limit);
  }
}
