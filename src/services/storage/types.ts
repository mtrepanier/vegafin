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

export type ThemeMusicVolume = 'disabled' | 'low' | 'medium' | 'high' | 'full';
export type ShowNextUpTiming = 'atEnd' | 'duringCredits' | 'never';

/**
 * `'system'` follows the device's own locale (`src/i18n/useSystemLocale.ts`) rather than
 * pinning a language outright - see `src/i18n/`. Distinct from `JellyfinUser.uiLanguage`
 * above, which is an existing per-signed-in-user field that isn't wired to anything yet; this
 * one drives the app's actual UI language and lives on `AppSettings` instead, matching every
 * other Settings-screen preference being device-local rather than per-profile.
 */
export type UiLanguage = 'system' | 'en' | 'fr';

/**
 * Device-local app preferences (ui/preferences equivalent) - distinct from
 * `JellyfinUserPreferences` above, which is per-Jellyfin-user audio/subtitle language
 * preference synced as part of that user's own record. These are global to the device/app
 * install, not tied to whichever user is currently signed in, matching the side nav's Settings
 * entry being a fixed menu item rather than per-profile. See `AppSettingsRepository.ts`.
 */
export interface AppSettings {
  showClock: boolean;
  themeMusicVolume: ThemeMusicVolume;
  hideControlsAfterSec: number;
  skipForwardSec: number;
  skipBackwardSec: number;
  showNextUp: ShowNextUpTiming;
  autoPlayNextUp: boolean;
  uiLanguage: UiLanguage;
}

// Matches this app's own previously-hardcoded playback constants (PlaybackScreens.tsx's
// CONTROLS_HIDE_DELAY_MS/SEEK_FORWARD_SECONDS/SEEK_BACK_SECONDS) so wiring the settings screen
// up to them didn't change anyone's actual playback behavior on the day this was added.
export const defaultAppSettings = (): AppSettings => ({
  showClock: true,
  themeMusicVolume: 'medium',
  hideControlsAfterSec: 5,
  skipForwardSec: 30,
  skipBackwardSec: 10,
  showNextUp: 'duringCredits',
  autoPlayNextUp: true,
  uiLanguage: 'system',
});
