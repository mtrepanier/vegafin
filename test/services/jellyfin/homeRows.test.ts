const mockGetUserViews = jest.fn();
const mockGetResumeItems = jest.fn();
const mockGetNextUp = jest.fn();
const mockGetLatestMedia = jest.fn();

jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: { get api() { return {}; } },
}));

jest.mock('@jellyfin/sdk/lib/utils/api/user-views-api', () => ({
  getUserViewsApi: () => ({ getUserViews: mockGetUserViews }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/items-api', () => ({
  getItemsApi: () => ({ getResumeItems: mockGetResumeItems }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/tv-shows-api', () => ({
  getTvShowsApi: () => ({ getNextUp: mockGetNextUp }),
}));
jest.mock('@jellyfin/sdk/lib/utils/api/user-library-api', () => ({
  getUserLibraryApi: () => ({ getLatestMedia: mockGetLatestMedia }),
}));

import { homeRowRef, fetchUserLibraries, fetchDefaultHomeRowConfigs, fetchHomeRowItems } from '../../../src/services/jellyfin/homeRows';

beforeEach(() => jest.clearAllMocks());

describe('homeRowRef', () => {
  it('maps a continueWatching config with no extra fields', () => {
    expect(homeRowRef({ key: 'continueWatching', kind: 'continueWatching', title: 'x' })).toEqual({ kind: 'continueWatching' });
  });

  it('maps a recentlyAdded config carrying its libraryId', () => {
    expect(homeRowRef({ key: 'recentlyAdded:lib-1', kind: 'recentlyAdded', title: 'x', libraryId: 'lib-1' })).toEqual({
      kind: 'recentlyAdded',
      libraryId: 'lib-1',
    });
  });
});

describe('fetchUserLibraries', () => {
  it('returns the Items array', async () => {
    mockGetUserViews.mockResolvedValue({ data: { Items: [{ Id: 'a' }] } });
    expect(await fetchUserLibraries('user-1')).toEqual([{ Id: 'a' }]);
  });

  it('defaults to an empty array when Items is missing', async () => {
    mockGetUserViews.mockResolvedValue({ data: {} });
    expect(await fetchUserLibraries('user-1')).toEqual([]);
  });
});

describe('fetchDefaultHomeRowConfigs', () => {
  it('always leads with a continueWatching row', async () => {
    mockGetUserViews.mockResolvedValue({ data: { Items: [] } });
    const configs = await fetchDefaultHomeRowConfigs('user-1');
    expect(configs[0]).toEqual({ key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' });
  });

  it('adds one recentlyAdded row per movie/tvshows library, skipping other collection types', async () => {
    mockGetUserViews.mockResolvedValue({
      data: {
        Items: [
          { Id: 'movies-1', Name: 'Movies', CollectionType: 'movies' },
          { Id: 'shows-1', Name: 'TV Shows', CollectionType: 'tvshows' },
          { Id: 'music-1', Name: 'Music', CollectionType: 'music' },
        ],
      },
    });

    const configs = await fetchDefaultHomeRowConfigs('user-1');

    expect(configs).toEqual([
      { key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' },
      { key: 'recentlyAdded:movies-1', kind: 'recentlyAdded', title: 'Latest Movies', libraryId: 'movies-1' },
      { key: 'recentlyAdded:shows-1', kind: 'recentlyAdded', title: 'Latest TV Shows', libraryId: 'shows-1' },
    ]);
  });

  it('skips libraries missing an Id or a CollectionType', async () => {
    mockGetUserViews.mockResolvedValue({
      data: {
        Items: [
          { Name: 'No Id', CollectionType: 'movies' },
          { Id: 'no-type', Name: 'No Type' },
        ],
      },
    });

    const configs = await fetchDefaultHomeRowConfigs('user-1');
    expect(configs).toEqual([{ key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' }]);
  });

  it('trims the title when the library has no Name', async () => {
    mockGetUserViews.mockResolvedValue({ data: { Items: [{ Id: 'lib-1', CollectionType: 'movies' }] } });
    const configs = await fetchDefaultHomeRowConfigs('user-1');
    expect(configs[1].title).toBe('Latest');
  });
});

describe('fetchHomeRowItems - continueWatching', () => {
  it('combines resume items with next-up episodes', async () => {
    mockGetResumeItems.mockResolvedValue({ data: { Items: [{ Id: 'resume-1', SeriesId: 'series-a' }] } });
    mockGetNextUp.mockResolvedValue({ data: { Items: [{ Id: 'nextup-1', SeriesId: 'series-b' }] } });

    const items = await fetchHomeRowItems('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 20);

    expect(items).toEqual([
      { Id: 'resume-1', SeriesId: 'series-a' },
      { Id: 'nextup-1', SeriesId: 'series-b' },
    ]);
  });

  it('drops next-up episodes whose series already has a resume-in-progress item', async () => {
    mockGetResumeItems.mockResolvedValue({ data: { Items: [{ Id: 'resume-1', SeriesId: 'series-a' }] } });
    mockGetNextUp.mockResolvedValue({
      data: { Items: [{ Id: 'nextup-1', SeriesId: 'series-a' }, { Id: 'nextup-2', SeriesId: 'series-b' }] },
    });

    const items = await fetchHomeRowItems('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 20);

    expect(items.map((i) => i.Id)).toEqual(['resume-1', 'nextup-2']);
  });

  it('caps the combined list at the requested limit', async () => {
    mockGetResumeItems.mockResolvedValue({ data: { Items: [{ Id: 'r1' }, { Id: 'r2' }] } });
    mockGetNextUp.mockResolvedValue({ data: { Items: [{ Id: 'n1' }, { Id: 'n2' }] } });

    const items = await fetchHomeRowItems('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 3);
    expect(items).toHaveLength(3);
  });

  it('defaults both sources to an empty array when Items is missing', async () => {
    mockGetResumeItems.mockResolvedValue({ data: {} });
    mockGetNextUp.mockResolvedValue({ data: {} });
    const items = await fetchHomeRowItems('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 20);
    expect(items).toEqual([]);
  });
});

describe('fetchHomeRowItems - recentlyAdded', () => {
  it('returns mockGetLatestMedia data directly (not wrapped in an Items envelope)', async () => {
    mockGetLatestMedia.mockResolvedValue({ data: [{ Id: 'a' }, { Id: 'b' }] });

    const items = await fetchHomeRowItems(
      'user-1',
      { key: 'recentlyAdded:lib-1', kind: 'recentlyAdded', title: '', libraryId: 'lib-1' },
      20,
    );

    expect(items).toEqual([{ Id: 'a' }, { Id: 'b' }]);
    expect(mockGetLatestMedia).toHaveBeenCalledWith({ userId: 'user-1', parentId: 'lib-1', limit: 20 });
  });
});
