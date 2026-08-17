import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import { jellyfinClient } from '../jellyfin/JellyfinClient';
import { defaultUserPreferences } from './types';
import type { CurrentUser, JellyfinServer, JellyfinServerUsers, JellyfinUser } from './types';

const SERVERS_KEY = 'vegafin.servers.v1';
const CURRENT_POINTER_KEY = 'vegafin.current.v1';

interface CurrentPointer {
  serverId: string;
  userId: string;
}

/**
 * Ports data/ServerRepository.kt: owns the list of known servers/users and the currently
 * active one, and repoints JellyfinClient at the right server/token on every change.
 *
 * Room + a StateFlow become a JSON blob in AsyncStorage plus a plain subscriber list here -
 * intentionally simple for Phase 0. `useServerRepository()` (ServerRepositoryContext.tsx)
 * binds this to React via useSyncExternalStore.
 */
class ServerRepository {
  private servers: JellyfinServerUsers[] = [];
  private current: CurrentUser | null = null;
  private ready = false;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify() {
    this.listeners.forEach((l) => l());
  }

  getSnapshot = (): CurrentUser | null => this.current;

  isReady(): boolean {
    return this.ready;
  }

  /** Loads persisted state and attempts to restore the last active session. */
  async init(): Promise<CurrentUser | null> {
    const [serversRaw, pointerRaw] = await Promise.all([
      AsyncStorage.getItem(SERVERS_KEY),
      AsyncStorage.getItem(CURRENT_POINTER_KEY),
    ]);
    this.servers = serversRaw ? JSON.parse(serversRaw) : [];
    const pointer: CurrentPointer | null = pointerRaw ? JSON.parse(pointerRaw) : null;
    this.ready = true;

    if (pointer) {
      return this.restoreSession(pointer.serverId, pointer.userId);
    }
    this.notify();
    return null;
  }

  private async persistServers() {
    await AsyncStorage.setItem(SERVERS_KEY, JSON.stringify(this.servers));
  }

  private async persistCurrentPointer(pointer: CurrentPointer | null) {
    if (pointer) {
      await AsyncStorage.setItem(CURRENT_POINTER_KEY, JSON.stringify(pointer));
    } else {
      await AsyncStorage.removeItem(CURRENT_POINTER_KEY);
    }
  }

  private findServerEntry(serverId: string): JellyfinServerUsers | undefined {
    return this.servers.find((s) => s.server.id === serverId);
  }

  private upsertServer(server: JellyfinServer): JellyfinServerUsers {
    let entry = this.findServerEntry(server.id);
    if (!entry) {
      entry = { server, users: [] };
      this.servers.push(entry);
    } else {
      entry.server = { ...entry.server, ...server };
    }
    return entry;
  }

  private upsertUser(serverId: string, user: JellyfinUser): JellyfinUser {
    const entry = this.findServerEntry(serverId);
    if (!entry) {
      throw new Error(`Unknown server ${serverId}`);
    }
    const idx = entry.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      entry.users[idx] = { ...entry.users[idx], ...user };
      return entry.users[idx];
    }
    entry.users.push(user);
    return user;
  }

  listServers(): JellyfinServerUsers[] {
    return this.servers;
  }

  /** Adds/updates a server and points the API client at it, with no user logged in yet. */
  async addAndChangeServer(server: JellyfinServer): Promise<void> {
    this.upsertServer(server);
    await this.persistServers();
    jellyfinClient.update(server.url, null);
    this.current = null;
    await this.persistCurrentPointer(null);
    this.notify();
  }

  /** Saves the server & user and makes them the active session, mirroring changeUser(). */
  async changeUser(server: JellyfinServer, user: JellyfinUser): Promise<CurrentUser> {
    if (server.id !== user.serverId) {
      throw new Error('User is not part of the server');
    }
    const api = jellyfinClient.update(server.url, user.accessToken);
    if (!api) {
      throw new Error('Failed to create API client for server');
    }

    let updatedServer = server;
    try {
      const { getSystemApi } = await import('@jellyfin/sdk/lib/utils/api/system-api');
      const { data } = await getSystemApi(api).getPublicSystemInfo();
      updatedServer = { ...server, name: data.ServerName ?? server.name, version: data.Version ?? server.version };
    } catch {
      // Public system info is best-effort; keep the existing server record on failure.
    }

    this.upsertServer(updatedServer);
    const savedUser = this.upsertUser(server.id, user);
    await this.persistServers();

    this.current = { server: updatedServer, user: savedUser };
    await this.persistCurrentPointer({ serverId: updatedServer.id, userId: savedUser.id });
    this.notify();
    return this.current;
  }

  /** Restores a session on app launch, mirroring restoreSession(). Returns null if the
   * user has a PIN set (caller should route to the PIN entry screen instead). */
  async restoreSession(serverId: string, userId: string): Promise<CurrentUser | null> {
    const entry = this.findServerEntry(serverId);
    const user = entry?.users.find((u) => u.id === userId);
    if (!entry || !user) {
      this.notify();
      return null;
    }
    if (user.pin) {
      // Caller is responsible for routing to PIN entry before calling changeUser again.
      this.notify();
      return null;
    }
    return this.changeUser(entry.server, user);
  }

  async removeUser(user: JellyfinUser): Promise<void> {
    if (this.current?.user.id === user.id) {
      this.current = null;
      await this.persistCurrentPointer(null);
      jellyfinClient.update(null);
    }
    const entry = this.findServerEntry(user.serverId);
    if (entry) {
      entry.users = entry.users.filter((u) => u.id !== user.id);
      await this.persistServers();
    }
    this.notify();
  }

  async removeServer(server: JellyfinServer): Promise<void> {
    if (this.current?.server.id === server.id) {
      this.current = null;
      await this.persistCurrentPointer(null);
      jellyfinClient.update(null);
    }
    this.servers = this.servers.filter((s) => s.server.id !== server.id);
    await this.persistServers();
    this.notify();
  }

  /** Logs out to the setup flow without forgetting the server/user (e.g. "switch user"). */
  async switchServerOrUser(): Promise<void> {
    this.current = null;
    await this.persistCurrentPointer(null);
    this.notify();
  }

  static newUser(partial: Pick<JellyfinUser, 'id' | 'name' | 'serverId' | 'accessToken'>): JellyfinUser {
    return {
      pin: null,
      requireLogin: false,
      lastUsed: new Date().toISOString(),
      uiLanguage: null,
      appPreferences: defaultUserPreferences(),
      ...partial,
    };
  }
}

export const serverRepository = new ServerRepository();
