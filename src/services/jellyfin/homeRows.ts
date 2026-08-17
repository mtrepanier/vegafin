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
  | { key: string; kind: 'recentlyAdded'; title: string; libraryId: string };

export function homeRowRef(config: HomeRowConfig): HomeRowRef {
  return config.kind === 'continueWatching' ? { kind: 'continueWatching' } : { kind: 'recentlyAdded', libraryId: config.libraryId };
}

export async function fetchUserLibraries(userId: string): Promise<BaseItemDto[]> {
  const { data } = await getUserViewsApi(jellyfinClient.api).getUserViews({ userId });
  return data.Items ?? [];
}

/**
 * Fixed default row layout: Continue Watching + Next Up combined, then one Recently Added row
 * per movie/TV library - mirrors `HomeSettingsService.createDefault()` without the
 * user-configurable row settings UI around it (that's Phase 2 "Settings screens").
 */
export async function fetchDefaultHomeRowConfigs(userId: string): Promise<HomeRowConfig[]> {
  const libraries = await fetchUserLibraries(userId);
  const configs: HomeRowConfig[] = [{ key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' }];

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

/** Resume-in-progress items merged with "next up" episodes, mirroring `LatestNextUpService.buildCombined()`. */
async function fetchContinueWatchingRow(userId: string, limit: number): Promise<BaseItemDto[]> {
  const api = jellyfinClient.api;
  const [resume, nextUp] = await Promise.all([
    getItemsApi(api).getResumeItems({ userId, limit }),
    getTvShowsApi(api).getNextUp({ userId, limit }),
  ]);

  const resumeItems = resume.data.Items ?? [];
  const nextUpItems = nextUp.data.Items ?? [];
  const resumedSeriesIds = new Set(resumeItems.map((item) => item.SeriesId).filter(Boolean));
  const combined = [...resumeItems, ...nextUpItems.filter((item) => !resumedSeriesIds.has(item.SeriesId))];

  return combined.slice(0, limit);
}

async function fetchRecentlyAddedRow(userId: string, libraryId: string, limit: number): Promise<BaseItemDto[]> {
  const { data } = await getUserLibraryApi(jellyfinClient.api).getLatestMedia({ userId, parentId: libraryId, limit });
  return data;
}

export async function fetchHomeRowItems(userId: string, config: HomeRowConfig, limit = ROW_LIMIT): Promise<BaseItemDto[]> {
  switch (config.kind) {
    case 'continueWatching':
      return fetchContinueWatchingRow(userId, limit);
    case 'recentlyAdded':
      return fetchRecentlyAddedRow(userId, config.libraryId, limit);
  }
}
