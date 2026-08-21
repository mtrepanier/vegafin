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

  it('maps a nextUp config with no extra fields', () => {
    expect(homeRowRef({ key: 'nextUp', kind: 'nextUp', title: 'x' })).toEqual({ kind: 'nextUp' });
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
  it('always leads with continueWatching then nextUp rows', async () => {
    mockGetUserViews.mockResolvedValue({ data: { Items: [] } });
    const configs = await fetchDefaultHomeRowConfigs('user-1');
    expect(configs.slice(0, 2)).toEqual([
      { key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' },
      { key: 'nextUp', kind: 'nextUp', title: 'Next Up' },
    ]);
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
      { key: 'nextUp', kind: 'nextUp', title: 'Next Up' },
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
    expect(configs).toEqual([
      { key: 'continueWatching', kind: 'continueWatching', title: 'Continue Watching' },
      { key: 'nextUp', kind: 'nextUp', title: 'Next Up' },
    ]);
  });

  it('trims the title when the library has no Name', async () => {
    mockGetUserViews.mockResolvedValue({ data: { Items: [{ Id: 'lib-1', CollectionType: 'movies' }] } });
    const configs = await fetchDefaultHomeRowConfigs('user-1');
    expect(configs[2].title).toBe('Latest');
  });
});

describe('fetchHomeRowItems - continueWatching', () => {
  it('returns resume items directly, without touching next-up', async () => {
    mockGetResumeItems.mockResolvedValue({ data: { Items: [{ Id: 'resume-1', SeriesId: 'series-a' }] } });

    const items = await fetchHomeRowItems('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 20);

    expect(items).toEqual([{ Id: 'resume-1', SeriesId: 'series-a' }]);
    expect(mockGetResumeItems).toHaveBeenCalledWith({ userId: 'user-1', limit: 20 });
    expect(mockGetNextUp).not.toHaveBeenCalled();
  });

  it('defaults to an empty array when Items is missing', async () => {
    mockGetResumeItems.mockResolvedValue({ data: {} });
    const items = await fetchHomeRowItems('user-1', { key: 'continueWatching', kind: 'continueWatching', title: '' }, 20);
    expect(items).toEqual([]);
  });
});

describe('fetchHomeRowItems - nextUp', () => {
  it('returns next-up items directly, without touching resume', async () => {
    mockGetNextUp.mockResolvedValue({ data: { Items: [{ Id: 'nextup-1', SeriesId: 'series-b' }] } });

    const items = await fetchHomeRowItems('user-1', { key: 'nextUp', kind: 'nextUp', title: '' }, 20);

    expect(items).toEqual([{ Id: 'nextup-1', SeriesId: 'series-b' }]);
    expect(mockGetNextUp).toHaveBeenCalledWith({ userId: 'user-1', limit: 20 });
    expect(mockGetResumeItems).not.toHaveBeenCalled();
  });

  it('defaults to an empty array when Items is missing', async () => {
    mockGetNextUp.mockResolvedValue({ data: {} });
    const items = await fetchHomeRowItems('user-1', { key: 'nextUp', kind: 'nextUp', title: '' }, 20);
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
