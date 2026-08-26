const mockGetItems = jest.fn();

jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: { get api() { return {}; } },
}));
jest.mock('@jellyfin/sdk/lib/utils/api/items-api', () => ({
  getItemsApi: () => ({ getItems: mockGetItems }),
}));

import { fetchSearchResults } from '../../../src/services/jellyfin/search';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';

beforeEach(() => jest.clearAllMocks());

describe('fetchSearchResults', () => {
  it('fires one search per supported type and groups the results', async () => {
    mockGetItems.mockImplementation(({ includeItemTypes }: { includeItemTypes: BaseItemKind[] }) => {
      const type = includeItemTypes[0];
      return Promise.resolve({ data: { Items: [{ Id: `${type}-1`, Type: type }] } });
    });

    const result = await fetchSearchResults('user-1', 'matrix');

    expect(result).toEqual({
      movies: [{ Id: 'Movie-1', Type: BaseItemKind.Movie }],
      series: [{ Id: 'Series-1', Type: BaseItemKind.Series }],
      episodes: [{ Id: 'Episode-1', Type: BaseItemKind.Episode }],
      collections: [{ Id: 'BoxSet-1', Type: BaseItemKind.BoxSet }],
      people: [{ Id: 'Person-1', Type: BaseItemKind.Person }],
    });
  });

  it('scopes each request to the search term, one item type, and a result limit', async () => {
    mockGetItems.mockResolvedValue({ data: { Items: [] } });

    await fetchSearchResults('user-1', 'matrix');

    expect(mockGetItems).toHaveBeenCalledTimes(5);
    const call = mockGetItems.mock.calls[0][0];
    expect(call.userId).toBe('user-1');
    expect(call.searchTerm).toBe('matrix');
    expect(call.includeItemTypes).toHaveLength(1);
    expect(call.recursive).toBe(true);
    expect(call.limit).toBe(20);
  });

  it('defaults a type to an empty array when the server returns no items', async () => {
    mockGetItems.mockResolvedValue({ data: {} });

    const result = await fetchSearchResults('user-1', 'nothing');

    expect(result).toEqual({ movies: [], series: [], episodes: [], collections: [], people: [] });
  });
});
