/**
 * Mirrors data/model/JellyfinServer.kt's Room entities. Phase 0 persists these as a JSON
 * blob via AsyncStorage rather than a real embedded DB (see ServerRepository.ts) - revisit
 * with @amazon-devices/react-native-mmkv or SQLite if the server/user list grows large
 * enough that this becomes a real cost.
 */
export interface JellyfinServer {
  id: string;
  name: string | null;
  url: string;
  version: string | null;
  lastUsed: string | null; // ISO 8601
}

export type SubtitleModePreference = 'USE_USER_PROFILE' | 'ALWAYS' | 'ON_DIRECT_PLAY' | 'NEVER';

export interface JellyfinUserPreferences {
  preferredAudioLanguage: string;
  preferredSubtitleLanguage: string;
  subtitleMode: SubtitleModePreference;
}

export interface JellyfinUser {
  id: string;
  name: string | null;
  serverId: string;
  accessToken: string | null;
  pin: string | null;
  requireLogin: boolean;
  lastUsed: string | null; // ISO 8601
  uiLanguage: string | null;
  appPreferences: JellyfinUserPreferences;
}

export interface JellyfinServerUsers {
  server: JellyfinServer;
  users: JellyfinUser[];
}

export interface CurrentUser {
  server: JellyfinServer;
  user: JellyfinUser;
}

export const USE_USER_PROFILE = 'USE_USER_PROFILE';

export const defaultUserPreferences = (): JellyfinUserPreferences => ({
  preferredAudioLanguage: USE_USER_PROFILE,
  preferredSubtitleLanguage: USE_USER_PROFILE,
  subtitleMode: 'USE_USER_PROFILE',
});
