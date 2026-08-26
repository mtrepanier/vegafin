const mockStore: Record<string, string> = {};

jest.mock('@amazon-devices/react-native-async-storage__async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStore[key];
      return Promise.resolve();
    }),
  },
}));

const mockJellyfinUpdate = jest.fn((..._args: unknown[]) => ({}) as unknown);
jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: { update: (...args: unknown[]) => mockJellyfinUpdate(...args) },
}));

const mockGetPublicSystemInfo = jest.fn((..._args: unknown[]) => Promise.resolve({ data: {} }));
jest.mock('@jellyfin/sdk/lib/utils/api/system-api', () => ({
  getSystemApi: () => ({ getPublicSystemInfo: (...args: unknown[]) => mockGetPublicSystemInfo(...args) }),
}));

import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import { serverRepository } from '../../../src/services/storage/ServerRepository';
import { defaultUserPreferences } from '../../../src/services/storage/types';
import type { JellyfinServer, JellyfinUser } from '../../../src/services/storage/types';

function makeServer(overrides: Partial<JellyfinServer> = {}): JellyfinServer {
  return { id: 's1', name: 'My Server', url: 'https://jf.example.com', version: '10.9.0', lastUsed: null, ...overrides };
}

function makeUser(overrides: Partial<JellyfinUser> = {}): JellyfinUser {
  return {
    id: 'u1',
    name: 'Alice',
    serverId: 's1',
    accessToken: 'token-1',
    pin: null,
    requireLogin: false,
    lastUsed: null,
    uiLanguage: null,
    appPreferences: defaultUserPreferences(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  mockJellyfinUpdate.mockReturnValue({});
  mockGetPublicSystemInfo.mockResolvedValue({ data: {} });
  // Reset private singleton state between tests without needing a module reset per test.
  (serverRepository as unknown as { servers: unknown[] }).servers = [];
  (serverRepository as unknown as { current: unknown }).current = null;
  (serverRepository as unknown as { ready: boolean }).ready = false;
  (serverRepository as unknown as { pendingUserSwitchServerId: string | null }).pendingUserSwitchServerId = null;
});

describe('addAndChangeServer', () => {
  it('adds the server with no user logged in and points the client at it', async () => {
    const server = makeServer();
    await serverRepository.addAndChangeServer(server);

    expect(serverRepository.listServers()).toEqual([{ server, users: [] }]);
    expect(serverRepository.getSnapshot()).toBeNull();
    expect(mockJellyfinUpdate).toHaveBeenCalledWith(server.url, null);
  });

  it('persists the server list and clears any stored session pointer', async () => {
    await serverRepository.addAndChangeServer(makeServer());

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('vegafin.servers.v1', expect.any(String));
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('vegafin.current.v1');
  });

  it('updates an existing server entry in place rather than duplicating it', async () => {
    await serverRepository.addAndChangeServer(makeServer({ name: 'First' }));
    await serverRepository.addAndChangeServer(makeServer({ name: 'Second' }));

    const servers = serverRepository.listServers();
    expect(servers).toHaveLength(1);
    expect(servers[0].server.name).toBe('Second');
  });

  it('notifies subscribers', async () => {
    const listener = jest.fn();
    serverRepository.subscribe(listener);
    await serverRepository.addAndChangeServer(makeServer());
    expect(listener).toHaveBeenCalled();
  });
});

describe('changeUser', () => {
  it('throws when the user does not belong to the given server', async () => {
    const server = makeServer({ id: 's1' });
    const user = makeUser({ serverId: 's2' });
    await expect(serverRepository.changeUser(server, user)).rejects.toThrow('User is not part of the server');
  });

  it('throws when the API client could not be created', async () => {
    mockJellyfinUpdate.mockReturnValueOnce(null);
    await expect(serverRepository.changeUser(makeServer(), makeUser())).rejects.toThrow('Failed to create API client for server');
  });

  // Note: the public-system-info refresh is fetched via a dynamic import() inside changeUser().
  // Under this project's Jest config (no --experimental-vm-modules), dynamic import() always
  // throws, so that call is always caught by the best-effort try/catch below - which is in
  // fact exactly the behavior this test is asserting.
  it('keeps the existing server record when the public-system-info refresh fails', async () => {
    const result = await serverRepository.changeUser(makeServer({ name: 'Old Name', version: '1.0' }), makeUser());

    expect(result.server.name).toBe('Old Name');
    expect(result.server.version).toBe('1.0');
  });

  it('saves the server/user, sets them as current, and persists both', async () => {
    const server = makeServer();
    const user = makeUser();

    const result = await serverRepository.changeUser(server, user);

    expect(result).toEqual({ server, user });
    expect(serverRepository.getSnapshot()).toEqual({ server, user });
    expect(serverRepository.listServers()).toHaveLength(1);
    expect(serverRepository.listServers()[0].users).toEqual([user]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('vegafin.current.v1', JSON.stringify({ serverId: server.id, userId: user.id }));
  });

  it('updates an existing user entry in place rather than duplicating it', async () => {
    const server = makeServer();
    await serverRepository.changeUser(server, makeUser({ name: 'Alice' }));
    await serverRepository.changeUser(server, makeUser({ name: 'Alice Renamed' }));

    const users = serverRepository.listServers()[0].users;
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Alice Renamed');
  });
});

describe('restoreSession', () => {
  it('returns null and notifies when the server is unknown', async () => {
    const listener = jest.fn();
    serverRepository.subscribe(listener);

    const result = await serverRepository.restoreSession('missing-server', 'u1');

    expect(result).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it('returns null when the user is unknown on a known server', async () => {
    await serverRepository.addAndChangeServer(makeServer());
    const result = await serverRepository.restoreSession('s1', 'missing-user');
    expect(result).toBeNull();
  });

  it('returns null without logging in when the user has a PIN set', async () => {
    const server = makeServer();
    await serverRepository.addAndChangeServer(server);
    (serverRepository as unknown as { servers: { server: JellyfinServer; users: JellyfinUser[] }[] }).servers[0].users.push(
      makeUser({ pin: '1234' }),
    );

    const result = await serverRepository.restoreSession('s1', 'u1');

    expect(result).toBeNull();
    expect(mockJellyfinUpdate).toHaveBeenCalledTimes(1); // only the addAndChangeServer call, not a login
  });

  it('logs in and returns the CurrentUser when found with no PIN', async () => {
    const server = makeServer();
    await serverRepository.addAndChangeServer(server);
    (serverRepository as unknown as { servers: { server: JellyfinServer; users: JellyfinUser[] }[] }).servers[0].users.push(makeUser());

    const result = await serverRepository.restoreSession('s1', 'u1');

    expect(result?.user.id).toBe('u1');
    expect(serverRepository.getSnapshot()?.user.id).toBe('u1');
  });
});

describe('init', () => {
  it('marks ready and returns null with no persisted state', async () => {
    expect(serverRepository.isReady()).toBe(false);
    const result = await serverRepository.init();
    expect(result).toBeNull();
    expect(serverRepository.isReady()).toBe(true);
  });

  it('restores a persisted session from AsyncStorage, mirroring app relaunch', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    // Simulate app relaunch: re-run init() against the same (mocked) AsyncStorage backing.
    const restored = await serverRepository.init();

    expect(restored).toEqual({ server, user });
  });

  it('does not restore a session when the persisted user has a PIN', async () => {
    const server = makeServer();
    const user = makeUser({ pin: '1234' });
    await serverRepository.changeUser(server, user);
    mockJellyfinUpdate.mockClear();

    const restored = await serverRepository.init();

    expect(restored).toBeNull();
    expect(mockJellyfinUpdate).not.toHaveBeenCalled();
  });
});

describe('removeUser', () => {
  it('clears the current session and repoints the client when removing the active user', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);
    mockJellyfinUpdate.mockClear();

    await serverRepository.removeUser(user);

    expect(serverRepository.getSnapshot()).toBeNull();
    expect(mockJellyfinUpdate).toHaveBeenCalledWith(null);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('vegafin.current.v1');
  });

  it('removes the user from their server entry and persists it', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    await serverRepository.removeUser(user);

    expect(serverRepository.listServers()[0].users).toEqual([]);
  });

  it('leaves the current session untouched when removing a different user', async () => {
    const server = makeServer();
    const activeUser = makeUser({ id: 'u1' });
    const otherUser = makeUser({ id: 'u2', name: 'Bob' });
    await serverRepository.changeUser(server, activeUser);
    // Add the second user to the same server entry directly, without switching current to them
    // the way calling changeUser() again would.
    (serverRepository as unknown as { servers: { server: JellyfinServer; users: JellyfinUser[] }[] }).servers[0].users.push(otherUser);
    mockJellyfinUpdate.mockClear();

    await serverRepository.removeUser(otherUser);

    expect(serverRepository.getSnapshot()?.user.id).toBe('u1');
    expect(mockJellyfinUpdate).not.toHaveBeenCalled();
    expect(serverRepository.listServers()[0].users.map((u) => u.id)).toEqual(['u1']);
  });
});

describe('removeServer', () => {
  it('drops the server from the list and persists it', async () => {
    const server = makeServer();
    await serverRepository.addAndChangeServer(server);

    await serverRepository.removeServer(server);

    expect(serverRepository.listServers()).toEqual([]);
  });

  it('clears the current session and repoints the client when removing the active server', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);
    mockJellyfinUpdate.mockClear();

    await serverRepository.removeServer(server);

    expect(serverRepository.getSnapshot()).toBeNull();
    expect(mockJellyfinUpdate).toHaveBeenCalledWith(null);
  });

  it('leaves an unrelated current session untouched', async () => {
    const activeServer = makeServer({ id: 's1' });
    const otherServer = makeServer({ id: 's2', url: 'https://other.example.com' });
    await serverRepository.changeUser(activeServer, makeUser({ serverId: 's1' }));
    // Add the second server directly, without clearing current the way addAndChangeServer() would.
    (serverRepository as unknown as { servers: { server: JellyfinServer; users: JellyfinUser[] }[] }).servers.push({
      server: otherServer,
      users: [],
    });
    mockJellyfinUpdate.mockClear();

    await serverRepository.removeServer(otherServer);

    expect(serverRepository.getSnapshot()?.server.id).toBe('s1');
    expect(mockJellyfinUpdate).not.toHaveBeenCalled();
  });
});

describe('switchServerOrUser', () => {
  it('clears the current session without forgetting the server/user', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    await serverRepository.switchServerOrUser();

    expect(serverRepository.getSnapshot()).toBeNull();
    expect(serverRepository.listServers()[0].users).toEqual([user]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('vegafin.current.v1');
  });
});

describe('switchUser / consumePendingUserSwitchServerId', () => {
  it('clears the current session the same way switchServerOrUser does', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    await serverRepository.switchUser(server.id);

    expect(serverRepository.getSnapshot()).toBeNull();
    expect(serverRepository.listServers()[0].users).toEqual([user]);
  });

  it('remembers the given server id for one later consume, then forgets it', async () => {
    await serverRepository.switchUser('server-1');

    expect(serverRepository.consumePendingUserSwitchServerId()).toBe('server-1');
    expect(serverRepository.consumePendingUserSwitchServerId()).toBeNull();
  });

  it('returns null when nothing is pending (a genuine cold start)', () => {
    expect(serverRepository.consumePendingUserSwitchServerId()).toBeNull();
  });
});

describe('setLibrarySort', () => {
  it('does nothing when nobody is signed in', async () => {
    const listener = jest.fn();
    serverRepository.subscribe(listener);

    await serverRepository.setLibrarySort('lib-1', 'SortName', 'Ascending');

    expect(listener).not.toHaveBeenCalled();
  });

  it('saves the choice under the given key on the current user and persists it', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    await serverRepository.setLibrarySort('lib-1', 'DateCreated', 'Descending');

    expect(serverRepository.getSnapshot()?.user.librarySort).toEqual({ 'lib-1': { sortBy: 'DateCreated', direction: 'Descending' } });
    expect(serverRepository.listServers()[0].users[0].librarySort).toEqual({ 'lib-1': { sortBy: 'DateCreated', direction: 'Descending' } });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('vegafin.servers.v1', expect.any(String));
  });

  it('keeps other keys already stored for the same user', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    await serverRepository.setLibrarySort('lib-1', 'SortName', 'Ascending');
    await serverRepository.setLibrarySort('favorites', 'CommunityRating', 'Descending');

    expect(serverRepository.getSnapshot()?.user.librarySort).toEqual({
      'lib-1': { sortBy: 'SortName', direction: 'Ascending' },
      favorites: { sortBy: 'CommunityRating', direction: 'Descending' },
    });
  });

  it('overwrites a previous choice for the same key', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);

    await serverRepository.setLibrarySort('lib-1', 'SortName', 'Ascending');
    await serverRepository.setLibrarySort('lib-1', 'PremiereDate', 'Descending');

    expect(serverRepository.getSnapshot()?.user.librarySort).toEqual({ 'lib-1': { sortBy: 'PremiereDate', direction: 'Descending' } });
  });

  it('notifies subscribers', async () => {
    const server = makeServer();
    const user = makeUser();
    await serverRepository.changeUser(server, user);
    const listener = jest.fn();
    serverRepository.subscribe(listener);

    await serverRepository.setLibrarySort('lib-1', 'SortName', 'Ascending');

    expect(listener).toHaveBeenCalled();
  });
});

describe('subscribe', () => {
  it('stops notifying a listener after it unsubscribes', async () => {
    const listener = jest.fn();
    const unsubscribe = serverRepository.subscribe(listener);
    unsubscribe();

    await serverRepository.addAndChangeServer(makeServer());

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('newUser', () => {
  it('fills in sensible defaults around the given identity fields', () => {
    const ServerRepositoryClass = serverRepository.constructor as unknown as {
      newUser: (partial: Pick<JellyfinUser, 'id' | 'name' | 'serverId' | 'accessToken'>) => JellyfinUser;
    };

    const user = ServerRepositoryClass.newUser({ id: 'u9', name: 'Zed', serverId: 's9', accessToken: 'tok' });

    expect(user.id).toBe('u9');
    expect(user.name).toBe('Zed');
    expect(user.serverId).toBe('s9');
    expect(user.accessToken).toBe('tok');
    expect(user.pin).toBeNull();
    expect(user.requireLogin).toBe(false);
    expect(user.uiLanguage).toBeNull();
    expect(user.appPreferences).toEqual(defaultUserPreferences());
    expect(typeof user.lastUsed).toBe('string');
    expect(() => new Date(user.lastUsed as string).toISOString()).not.toThrow();
  });
});
