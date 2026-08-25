import type { UiLanguage } from '../services/storage/types';
import type { Language } from './translations';

/**
 * `'system'` resolves to French only for an actual French-tagged locale (`fr`, `fr-FR`,
 * `fr-CA`, ...) - anything else, including a `null` read (see `useSystemLocale.ts`'s own
 * fallback comment), lands on English rather than guessing. `'en'`/`'fr'` pass straight
 * through regardless of the device's own locale, since they're an explicit override.
 */
export function resolveLanguage(uiLanguage: UiLanguage, systemLocale: string | null): Language {
  if (uiLanguage === 'en' || uiLanguage === 'fr') {
    return uiLanguage;
  }
  return systemLocale?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
