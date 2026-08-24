import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { libraryIconName } from '../../../src/services/jellyfin/libraryIcons';

describe('libraryIconName', () => {
  it.each([
    [CollectionType.Movies, 'movie'],
    [CollectionType.Tvshows, 'live-tv'],
    [CollectionType.Music, 'library-music'],
    [CollectionType.Musicvideos, 'music-video'],
    [CollectionType.Homevideos, 'photo-camera-back'],
    [CollectionType.Boxsets, 'video-library'],
    [CollectionType.Books, 'menu-book'],
    [CollectionType.Photos, 'photo-library'],
    [CollectionType.Livetv, 'live-tv'],
    [CollectionType.Playlists, 'queue-music'],
  ])('maps CollectionType %s to icon %s', (collectionType, expectedIcon) => {
    expect(libraryIconName({ CollectionType: collectionType })).toBe(expectedIcon);
  });

  it('falls back to "folder" for a CollectionType with no mapping', () => {
    expect(libraryIconName({ CollectionType: CollectionType.Unknown })).toBe('folder');
  });

  it('falls back to "folder" when CollectionType is missing entirely', () => {
    expect(libraryIconName({})).toBe('folder');
  });
});
