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

import { fetchLibraryPage, fetchHomeRowPage } from '../../../src/services/jellyfin/library';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';

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
