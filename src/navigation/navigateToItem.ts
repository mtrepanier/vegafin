import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { AppNavigationProp, DrawerParamList } from './types';

/**
 * Central "what happens when you press a card" dispatch, reused by every row/grid. Series
 * items go straight to the SeriesOverview binge page - Phase 1 targets that instead of the
 * classic `SeriesDetails` page Kotlin's `MediaItem(type=SERIES)` dispatch would otherwise
 * show (see MediaItemScreen.tsx); everything else goes through MediaItem's own type dispatch.
 *
 * Episode items (Home's Continue Watching/Next Up rows, a person's "Episodes" credits row) go
 * to that same SeriesOverview page rather than a standalone episode page - there's no dedicated
 * `EpisodeDetail` screen at all, since a binge-style series page already has everywhere an
 * episode press would otherwise need to go (play, season tabs, episode row). `seasonEpisode`
 * carries the episode's own `SeasonId`/`Id` through so the page opens on the right season with
 * that episode already focused, the same deep-link shape `SeriesOverviewScreen.tsx` already
 * resolves for e.g. Continue Watching before this change existed.
 */
export function navigateToItem<T extends keyof DrawerParamList>(navigation: AppNavigationProp<T>, item: BaseItemDto): void {
  if (!item.Id || !item.Type) {
    return;
  }
  if (item.Type === BaseItemKind.Series) {
    navigation.navigate('SeriesOverview', { itemId: item.Id, type: item.Type });
    return;
  }
  if (item.Type === BaseItemKind.Episode) {
    if (!item.SeriesId) {
      return;
    }
    navigation.navigate('SeriesOverview', {
      itemId: item.SeriesId,
      type: BaseItemKind.Series,
      seasonEpisode: { seasonId: item.SeasonId ?? undefined, episodeId: item.Id },
    });
    return;
  }
  if (item.Type === BaseItemKind.PhotoAlbum || item.Type === BaseItemKind.Folder) {
    // A photo library's album/folder tiles (see MainDrawerNavigator.tsx's Photos case) - open
    // one more level of the same non-recursive browse rather than a detail page, same as
    // opening the library itself.
    navigation.navigate('ItemGrid', { title: item.Name ?? '', parentId: item.Id, recursive: false });
    return;
  }
  if (item.Type === BaseItemKind.Photo) {
    if (!item.ParentId) {
      return;
    }
    // Full-screen single-photo viewer (SlideshowScreen) - it re-fetches its own containing
    // folder's item list (by parentId) to know what's next/previous, rather than this needing
    // to hand over the whole grid's already-loaded array.
    navigation.navigate('Slideshow', { parentId: item.ParentId, itemId: item.Id });
    return;
  }
  navigation.navigate('MediaItem', { itemId: item.Id, type: item.Type, collectionType: undefined });
}
