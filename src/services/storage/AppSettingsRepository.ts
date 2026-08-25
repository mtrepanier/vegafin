import AsyncStorage from '@amazon-devices/react-native-async-storage__async-storage';
import { defaultAppSettings } from './types';
import type { AppSettings } from './types';

const SETTINGS_KEY = 'vegafin.appSettings.v1';

/**
 * Device-local app preferences store - same `useSyncExternalStore`-friendly shape as
 * `ServerRepository.ts` (module singleton, `subscribe`/`getSnapshot`, an `init()` the app calls
 * once at startup, a JSON blob in AsyncStorage), kept as a separate class/key rather than folded
 * into `ServerRepository` since these settings aren't tied to a signed-in server/user at all.
 */
class AppSettingsRepository {
  private settings: AppSettings = defaultAppSettings();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private notify() {
    this.listeners.forEach((l) => l());
  }

  getSnapshot = (): AppSettings => this.settings;

  /** Loads persisted settings, falling back to defaults for anything never saved (including a
   * first launch with nothing persisted yet, and any field added after a user's last save). */
  async init(): Promise<AppSettings> {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    this.settings = { ...defaultAppSettings(), ...(raw ? JSON.parse(raw) : {}) };
    this.notify();
    return this.settings;
  }

  async update(patch: Partial<AppSettings>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    this.notify();
  }
}

export const appSettingsRepository = new AppSettingsRepository();
