const mockGetItems = jest.fn();
const mockFetchHomeRowItems = jest.fn();

jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: { get api() { return {}; } },
}));
jest.mock('@jellyfin/sdk/lib/utils/api/items-api', () => ({
  getItemsApi: () => ({ getItems: mockGetItems }),
}));
jest.mock('../../../src/services/jellyfin/homeRows', () => ({
  fetchHomeRowItems: (...args: unknown[]) => mockFetchHomeRowItems(...args),
}));

import {
  fetchLibraryPage,
  fetchHomeRowPage,
  resolveLibrarySort,
  libraryItemKinds,
  sortLibrariesByType,
} from '../../../src/services/jellyfin/library';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';

beforeEach(() => jest.clearAllMocks());

describe('fetchLibraryPage', () => {
  it('requests recursive+ascending sort-by-name by default', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [{ Id: 'a' }], TotalRecordCount: 1 } });

    const page = fetchLibraryPage('user-1', { parentId: 'lib-1' });
    const result = await page(0, 50);

    expect(mockGetItems).toHaveBeenCalledWith({
      userId: 'user-1',
      parentId: 'lib-1',
      includeItemTypes: undefined,
      recursive: true,
      isFavorite: undefined,
      startIndex: 0,
      limit: 50,
      sortBy: [ItemSortBy.SortName],
      sortOrder: [SortOrder.Ascending],
      enableTotalRecordCount: true,
    });
    expect(result).toEqual({ items: [{ Id: 'a' }], totalCount: 1 });
  });

  it('honors an explicit sortBy and Descending sortDirection', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });

    const page = fetchLibraryPage('user-1', { sortBy: ItemSortBy.DateCreated, sortDirection: 'Descending' });
    await page(10, 20);

    const call = mockGetItems.mock.calls[0][0];
    expect(call.sortBy).toEqual([ItemSortBy.DateCreated]);
    expect(call.sortOrder).toEqual([SortOrder.Descending]);
    expect(call.startIndex).toBe(10);
    expect(call.limit).toBe(20);
  });

  it('honors recursive:false and isFavorite overrides', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });
    const page = fetchLibraryPage('user-1', { recursive: false, isFavorite: true });
    await page(0, 10);
    const call = mockGetItems.mock.calls[0][0];
    expect(call.recursive).toBe(false);
    expect(call.isFavorite).toBe(true);
  });

  it('expands a Folder sort into IsFolder+SortName so ties break alphabetically', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });
    const page = fetchLibraryPage('user-1', { sortBy: ItemSortBy.IsFolder });
    await page(0, 10);
    const call = mockGetItems.mock.calls[0][0];
    expect(call.sortBy).toEqual([ItemSortBy.IsFolder, ItemSortBy.SortName]);
  });

  it('requests folder-tile fields and an imageTypeLimit for a non-recursive (folder) browse', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });
    const page = fetchLibraryPage('user-1', { recursive: false });
    await page(0, 10);
    const call = mockGetItems.mock.calls[0][0];
    expect(call.fields).toEqual(['PrimaryImageAspectRatio', 'SortName', 'Path', 'ChildCount', 'MediaSourceCount', 'ParentId']);
    expect(call.imageTypeLimit).toBe(1);
  });

  it('omits fields and imageTypeLimit for a recursive browse', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [], TotalRecordCount: 0 } });
    const page = fetchLibraryPage('user-1', {});
    await page(0, 10);
    const call = mockGetItems.mock.calls[0][0];
    expect(call.fields).toBeUndefined();
    expect(call.imageTypeLimit).toBeUndefined();
  });

  it('defaults items/totalCount to empty/zero when the response omits them', async () => {
    mockGetItems.mockResolvedValue({ data: {} });
    const page = fetchLibraryPage('user-1', {});
    const result = await page(0, 10);
    expect(result).toEqual({ items: [], totalCount: 0 });
  });
});

describe('fetchHomeRowPage', () => {
  it('builds a continueWatching config and slices the refetched window', async () => {
    mockFetchHomeRowItems.mockResolvedValue(Array.from({ length: 15 }, (_, i) => ({ Id: `item-${i}` })));

    const page = fetchHomeRowPage('user-1', { kind: 'continueWatching' });
    const result = await page(10, 10);

    expect(mockFetchHomeRowItems).toHaveBeenCalledWith('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 20);
    expect(result.items).toHaveLength(5);
    expect(result.items[0]).toEqual({ Id: 'item-10' });
    expect(result.totalCount).toBe(15);
  });

  it('builds a nextUp config', async () => {
    mockFetchHomeRowItems.mockResolvedValue([{ Id: 'a' }]);

    const page = fetchHomeRowPage('user-1', { kind: 'nextUp' });
    await page(0, 5);

    expect(mockFetchHomeRowItems).toHaveBeenCalledWith('user-1', { key: 'nextUp', kind: 'nextUp', title: '' }, 5);
  });

  it('builds a recentlyAdded config carrying the libraryId', async () => {
    mockFetchHomeRowItems.mockResolvedValue([{ Id: 'a' }, { Id: 'b' }]);

    const page = fetchHomeRowPage('user-1', { kind: 'recentlyAdded', libraryId: 'lib-9' });
    await page(0, 5);

    expect(mockFetchHomeRowItems).toHaveBeenCalledWith(
      'user-1',
      { key: 'recentlyAdded:lib-9', kind: 'recentlyAdded', title: '', libraryId: 'lib-9' },
      5,
    );
  });

  it('returns an empty page and zero total when startIndex is beyond what came back', async () => {
    mockFetchHomeRowItems.mockResolvedValue([{ Id: 'a' }]);
    const page = fetchHomeRowPage('user-1', { kind: 'continueWatching' });
    const result = await page(5, 10);
    expect(result).toEqual({ items: [], totalCount: 1 });
  });
});

describe('resolveLibrarySort', () => {
  it('defaults to Name/Ascending when nothing is stored', () => {
    expect(resolveLibrarySort(undefined)).toEqual({ sortBy: ItemSortBy.SortName, direction: 'Ascending' });
  });

  it('returns the stored field/direction when the field still exists', () => {
    expect(resolveLibrarySort({ sortBy: ItemSortBy.CommunityRating, direction: 'Descending' })).toEqual({
      sortBy: ItemSortBy.CommunityRating,
      direction: 'Descending',
    });
  });

  it('falls back to the default when the stored sortBy no longer matches a known option', () => {
    expect(resolveLibrarySort({ sortBy: 'SomeRemovedField', direction: 'Descending' })).toEqual({
      sortBy: ItemSortBy.SortName,
      direction: 'Ascending',
    });
  });

  it('falls back to a caller-supplied default (e.g. Folder for a photo library) when nothing is stored', () => {
    expect(resolveLibrarySort(undefined, ItemSortBy.IsFolder)).toEqual({ sortBy: ItemSortBy.IsFolder, direction: 'Ascending' });
  });

  it('still prefers a stored value over a caller-supplied default', () => {
    expect(resolveLibrarySort({ sortBy: ItemSortBy.DateCreated, direction: 'Descending' }, ItemSortBy.IsFolder)).toEqual({
      sortBy: ItemSortBy.DateCreated,
      direction: 'Descending',
    });
  });
});

describe('libraryItemKinds', () => {
  it('maps Movies to just Movie', () => {
    expect(libraryItemKinds(CollectionType.Movies)).toEqual([BaseItemKind.Movie]);
  });

  it('maps Tvshows to just Series', () => {
    expect(libraryItemKinds(CollectionType.Tvshows)).toEqual([BaseItemKind.Series]);
  });

  it('returns undefined for a CollectionType with no mapping', () => {
    expect(libraryItemKinds(CollectionType.Livetv)).toBeUndefined();
  });

  it('returns undefined for null/undefined', () => {
    expect(libraryItemKinds(null)).toBeUndefined();
    expect(libraryItemKinds(undefined)).toBeUndefined();
  });
});

describe('sortLibrariesByType', () => {
  it('orders Movies, then Tvshows, then Photos, then Livetv, then everything else', () => {
    const music = { Id: 'music', CollectionType: CollectionType.Music };
    const photos = { Id: 'photos', CollectionType: CollectionType.Photos };
    const liveTv = { Id: 'livetv', CollectionType: CollectionType.Livetv };
    const tvShows = { Id: 'tv', CollectionType: CollectionType.Tvshows };
    const movies = { Id: 'movies', CollectionType: CollectionType.Movies };

    const result = sortLibrariesByType([music, photos, liveTv, tvShows, movies]);

    expect(result.map((l) => l.Id)).toEqual(['movies', 'tv', 'photos', 'livetv', 'music']);
  });

  it('keeps the original relative order for libraries of the same type (stable sort)', () => {
    const moviesA = { Id: 'movies-a', CollectionType: CollectionType.Movies };
    const moviesB = { Id: 'movies-b', CollectionType: CollectionType.Movies };

    expect(sortLibrariesByType([moviesB, moviesA]).map((l) => l.Id)).toEqual(['movies-b', 'movies-a']);
  });

  it('keeps the original relative order among libraries with no mapped priority', () => {
    const books = { Id: 'books', CollectionType: CollectionType.Books };
    const music = { Id: 'music', CollectionType: CollectionType.Music };

    expect(sortLibrariesByType([music, books]).map((l) => l.Id)).toEqual(['music', 'books']);
  });

  it('sorts a library with no CollectionType at all after everything mapped', () => {
    const unknown = { Id: 'unknown' };
    const movies = { Id: 'movies', CollectionType: CollectionType.Movies };

    expect(sortLibrariesByType([unknown, movies]).map((l) => l.Id)).toEqual(['movies', 'unknown']);
  });

  it('does not mutate the input array', () => {
    const input = [{ Id: 'photos', CollectionType: CollectionType.Photos }, { Id: 'movies', CollectionType: CollectionType.Movies }];
    const original = [...input];

    sortLibrariesByType(input);

    expect(input).toEqual(original);
  });
});
