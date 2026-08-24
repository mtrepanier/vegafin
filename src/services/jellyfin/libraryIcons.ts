import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

const ICON_BY_COLLECTION_TYPE: Partial<Record<string, string>> = {
  [CollectionType.Movies]: 'movie',
  [CollectionType.Tvshows]: 'live-tv',
  [CollectionType.Music]: 'library-music',
  [CollectionType.Musicvideos]: 'music-video',
  [CollectionType.Homevideos]: 'photo-camera-back',
  [CollectionType.Boxsets]: 'video-library',
  [CollectionType.Books]: 'menu-book',
  [CollectionType.Photos]: 'photo-library',
  [CollectionType.Livetv]: 'live-tv',
  [CollectionType.Playlists]: 'queue-music',
};

/** MaterialIcons name for a library, keyed off its CollectionType - used by the side nav's
 * library section. */
export function libraryIconName(library: BaseItemDto): string {
  return (library.CollectionType && ICON_BY_COLLECTION_TYPE[library.CollectionType]) || 'folder';
}
