import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { jellyfinClient } from './JellyfinClient';

const SEARCH_RESULT_LIMIT = 20;

export interface SearchResults {
  movies: BaseItemDto[];
  series: BaseItemDto[];
  episodes: BaseItemDto[];
  collections: BaseItemDto[];
  people: BaseItemDto[];
}

async function searchByType(userId: string, searchTerm: string, includeItemType: BaseItemKind): Promise<BaseItemDto[]> {
  const { data } = await getItemsApi(jellyfinClient.api).getItems({
    userId,
    searchTerm,
    includeItemTypes: [includeItemType],
    recursive: true,
    limit: SEARCH_RESULT_LIMIT,
  });
  return data.Items ?? [];
}

/** `SearchScreen.tsx` - fires one search per supported content type in parallel (mirrors
 * Wholphin's `SearchPage.kt`) rather than a single unscoped query, so results render as
 * labeled rows grouped by type instead of a flat list mixing movies, episodes, and people
 * together. Scoped to the types this app actually has a detail page/navigation target for (see
 * `navigateToItem.ts`) - Music/Audio types exist in the schema but aren't searched here, since
 * music playback isn't built (Phase 3). */
export async function fetchSearchResults(userId: string, searchTerm: string): Promise<SearchResults> {
  const [movies, series, episodes, collections, people] = await Promise.all([
    searchByType(userId, searchTerm, BaseItemKind.Movie),
    searchByType(userId, searchTerm, BaseItemKind.Series),
    searchByType(userId, searchTerm, BaseItemKind.Episode),
    searchByType(userId, searchTerm, BaseItemKind.BoxSet),
    searchByType(userId, searchTerm, BaseItemKind.Person),
  ]);
  return { movies, series, episodes, collections, people };
}
