import { useAppSettings } from '../services/storage/AppSettingsContext';
import { useSystemLocale } from './useSystemLocale';
import { resolveLanguage } from './resolveLanguage';
import type { Language } from './translations';

/** The app's actual current language - resolves the Settings screen's `uiLanguage` choice
 * ('system'/'en'/'fr') down to one of the two languages this app ships. Re-renders when either
 * the setting changes or (for 'system') the device's own locale changes live. */
export function useLanguage(): Language {
  const { uiLanguage } = useAppSettings();
  const systemLocale = useSystemLocale();
  return resolveLanguage(uiLanguage, systemLocale);
}
