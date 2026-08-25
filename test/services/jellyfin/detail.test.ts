const mockGetItems = jest.fn();
const mockGetSimilarItems = jest.fn();
const mockGetItem = jest.fn();
const mockGetLocalTrailers = jest.fn();
const mockGetEpisodes = jest.fn();
const mockMarkFavoriteItem = jest.fn();
const mockUnmarkFavoriteItem = jest.fn();
const mockMarkPlayedItem = jest.fn();
const mockMarkUnplayedItem = jest.fn();

jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: { get api() { return {}; } },
}));
jest.mock('@jellyfin/sdk/lib/utils/api/items-api', () => ({
  getItemsApi: () => ({ getItems: mockGetItems }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
  getLibraryApi: () => ({ getSimilarItems: mockGetSimilarItems }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/user-library-api', () => ({
  getUserLibraryApi: () => ({
    getItem: mockGetItem,
    getLocalTrailers: mockGetLocalTrailers,
    markFavoriteItem: mockMarkFavoriteItem,
    unmarkFavoriteItem: mockUnmarkFavoriteItem,
  }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/tv-shows-api', () => ({
  getTvShowsApi: () => ({ getEpisodes: mockGetEpisodes }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/playstate-api', () => ({
  getPlaystateApi: () => ({ markPlayedItem: mockMarkPlayedItem, markUnplayedItem: mockMarkUnplayedItem }),
}));

import {
  fetchItem,
  fetchSimilarItems,
  fetchLocalTrailers,
  fetchPersonCredits,
  fetchCollectionItems,
  fetchSeasons,
  fetchEpisodes,
  fetchPlaylistItems,
  setFavorite,
  setWatched,
} from '../../../src/services/jellyfin/detail';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';

beforeEach(() => jest.clearAllMocks());

describe('fetchItem', () => {
  it('returns the item data directly', async () => {
    mockGetItem.mockResolvedValue({ data: { Id: 'item-1' } });
    expect(await fetchItem('user-1', 'item-1')).toEqual({ Id: 'item-1' });
    expect(mockGetItem).toHaveBeenCalledWith({ userId: 'user-1', itemId: 'item-1' });
  });
});

describe('fetchSimilarItems', () => {
  it('defaults the limit to 20 and unwraps Items', async () => {
    mockGetSimilarItems.mockResolvedValue({ data: { Items: [{ Id: 'a' }] } });
    expect(await fetchSimilarItems('user-1', 'item-1')).toEqual([{ Id: 'a' }]);
    expect(mockGetSimilarItems).toHaveBeenCalledWith({ itemId: 'item-1', userId: 'user-1', limit: 20 });
  });

  it('defaults to an empty array when Items is missing', async () => {
    mockGetSimilarItems.mockResolvedValue({ data: {} });
    expect(await fetchSimilarItems('user-1', 'item-1')).toEqual([]);
  });
});

describe('fetchLocalTrailers', () => {
  it('returns the trailer items directly (not wrapped in an Items envelope)', async () => {
    mockGetLocalTrailers.mockResolvedValue({ data: [{ Id: 'trailer-1' }] });
    expect(await fetchLocalTrailers('user-1', 'item-1')).toEqual([{ Id: 'trailer-1' }]);
    expect(mockGetLocalTrailers).toHaveBeenCalledWith({ itemId: 'item-1', userId: 'user-1' });
  });
});

describe('fetchPersonCredits', () => {
  it('sorts by premiere date/production year/name, descending', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [{ Id: 'a' }] } });
    await fetchPersonCredits('user-1', 'person-1', [BaseItemKind.Movie]);

    expect(mockGetItems).toHaveBeenCalledWith({
      userId: 'user-1',
      personIds: ['person-1'],
      includeItemTypes: [BaseItemKind.Movie],
      recursive: true,
      limit: 20,
      sortBy: [ItemSortBy.PremiereDate, ItemSortBy.ProductionYear, ItemSortBy.SortName],
      sortOrder: [SortOrder.Descending],
    });
  });
});

describe('fetchCollectionItems', () => {
  it('is non-recursive with a default limit of 200', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [] } });
    await fetchCollectionItems('user-1', 'coll-1');
    expect(mockGetItems).toHaveBeenCalledWith({ userId: 'user-1', parentId: 'coll-1', recursive: false, limit: 200, sortBy: [ItemSortBy.SortName] });
  });
});

describe('fetchSeasons', () => {
  it('requests only Season items, sorted by IndexNumber', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [] } });
    await fetchSeasons('user-1', 'series-1');
    expect(mockGetItems).toHaveBeenCalledWith({
      userId: 'user-1',
      parentId: 'series-1',
      includeItemTypes: [BaseItemKind.Season],
      recursive: false,
      sortBy: [ItemSortBy.IndexNumber],
    });
  });
});

describe('fetchEpisodes', () => {
  it('passes an undefined seasonId through when none is given', async () => {
    mockGetEpisodes.mockResolvedValue({ data: { Items: [] } });
    await fetchEpisodes('user-1', 'series-1');
    expect(mockGetEpisodes).toHaveBeenCalledWith({
      seriesId: 'series-1',
      userId: 'user-1',
      seasonId: undefined,
      fields: ['People', 'Overview'],
      enableUserData: true,
    });
  });

  it('passes a given seasonId through', async () => {
    mockGetEpisodes.mockResolvedValue({ data: { Items: [{ Id: 'ep-1' }] } });
    const result = await fetchEpisodes('user-1', 'series-1', 'season-1');
    expect(mockGetEpisodes).toHaveBeenCalledWith({
      seriesId: 'series-1',
      userId: 'user-1',
      seasonId: 'season-1',
      fields: ['People', 'Overview'],
      enableUserData: true,
    });
    expect(result).toEqual([{ Id: 'ep-1' }]);
  });
});

describe('fetchPlaylistItems', () => {
  it('defaults to recursive movie/episode/video items sorted by name, unshuffled', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [{ Id: 'a' }, { Id: 'b' }, { Id: 'c' }] } });
    const result = await fetchPlaylistItems('user-1', 'parent-1');

    expect(mockGetItems).toHaveBeenCalledWith({
      userId: 'user-1',
      parentId: 'parent-1',
      recursive: true,
      includeItemTypes: [BaseItemKind.Movie, BaseItemKind.Episode, BaseItemKind.Video],
      sortBy: [ItemSortBy.SortName],
    });
    expect(result.map((i) => i.Id)).toEqual(['a', 'b', 'c']);
  });

  it('honors recursive:false', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [] } });
    await fetchPlaylistItems('user-1', 'parent-1', { recursive: false });
    expect(mockGetItems.mock.calls[0][0].recursive).toBe(false);
  });

  it('shuffles the returned items when shuffle:true, preserving the same set of ids', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [{ Id: 'a' }, { Id: 'b' }, { Id: 'c' }, { Id: 'd' }] } });
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const result = await fetchPlaylistItems('user-1', 'parent-1', { shuffle: true });

    expect(result.map((i) => i.Id)).toEqual(['b', 'c', 'd', 'a']);
    jest.spyOn(Math, 'random').mockRestore();
  });

  it('returns an empty array unshuffled without error', async () => {
    mockGetItems.mockResolvedValue({ data: {} });
    const result = await fetchPlaylistItems('user-1', 'parent-1', { shuffle: true });
    expect(result).toEqual([]);
  });
});

describe('setFavorite', () => {
  it('marks favorite when true', async () => {
    await setFavorite('user-1', 'item-1', true);
    expect(mockMarkFavoriteItem).toHaveBeenCalledWith({ itemId: 'item-1', userId: 'user-1' });
    expect(mockUnmarkFavoriteItem).not.toHaveBeenCalled();
  });

  it('unmarks favorite when false', async () => {
    await setFavorite('user-1', 'item-1', false);
    expect(mockUnmarkFavoriteItem).toHaveBeenCalledWith({ itemId: 'item-1', userId: 'user-1' });
    expect(mockMarkFavoriteItem).not.toHaveBeenCalled();
  });
});

describe('setWatched', () => {
  it('marks played when true', async () => {
    await setWatched('user-1', 'item-1', true);
    expect(mockMarkPlayedItem).toHaveBeenCalledWith({ itemId: 'item-1', userId: 'user-1' });
    expect(mockMarkUnplayedItem).not.toHaveBeenCalled();
  });

  it('marks unplayed when false', async () => {
    await setWatched('user-1', 'item-1', false);
    expect(mockMarkUnplayedItem).toHaveBeenCalledWith({ itemId: 'item-1', userId: 'user-1' });
    expect(mockMarkPlayedItem).not.toHaveBeenCalled();
  });
});
