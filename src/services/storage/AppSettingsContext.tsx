import React, { useEffect, useSyncExternalStore } from 'react';
import { appSettingsRepository } from './AppSettingsRepository';

/** Loads persisted app settings once at startup - mirrors `ServerRepositoryProvider`, but with
 * no loading gate: `getSnapshot()` already returns sensible defaults before `init()` resolves,
 * so nothing needs to wait on it the way session restore does. */
export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    appSettingsRepository.init();
  }, []);

  return <>{children}</>;
}

/** Live-updating app settings, equivalent to collecting AppSettingsRepository.settings. Mutate
 * via `appSettingsRepository.update(patch)` directly - same pattern as `serverRepository`'s own
 * methods being called straight from screens rather than through a second hook. */
export function useAppSettings() {
  return useSyncExternalStore(appSettingsRepository.subscribe, appSettingsRepository.getSnapshot);
}
