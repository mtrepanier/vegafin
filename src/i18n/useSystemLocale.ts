import { useEffect, useState } from 'react';
import { I18nManager } from 'react-native';

/** Best-effort read of Kepler's `I18nManager.getSystemLocale()` (an Amazon addition over stock
 * RN's RTL-only I18nManager - see `src/types/react-native-augmentations.d.ts`), e.g. `"fr-FR"`.
 * Wrapped in a try/catch since this is the first thing in this app to call it, on hardware this
 * hasn't been verified against yet - falls back to `getConstants().localeIdentifier`, then to
 * `null` (resolved to English by `resolveLanguage.ts`) rather than letting a platform surprise
 * here crash the whole app. */
function readSystemLocale(): string | null {
  try {
    const fromGetSystemLocale = I18nManager.getSystemLocale?.();
    if (fromGetSystemLocale) {
      return fromGetSystemLocale;
    }
    return I18nManager.getConstants().localeIdentifier ?? null;
  } catch {
    return null;
  }
}

/** Live device locale (e.g. `"fr-FR"`), re-read if Kepler reports a system locale change while
 * the app is running (its `SettingEventName.Locale` event - a platform capability stock RN's
 * I18nManager doesn't have). Used by `useLanguage.ts` to resolve the `'system'` UiLanguage
 * choice; the raw string, not yet narrowed to `Language` ('en'/'fr'). */
export function useSystemLocale(): string | null {
  const [locale, setLocale] = useState<string | null>(readSystemLocale);

  useEffect(() => {
    if (typeof I18nManager.addEventListener !== 'function' || !I18nManager.SettingEventName) {
      return;
    }
    let subscription: { remove: () => void } | undefined;
    try {
      subscription = I18nManager.addEventListener(I18nManager.SettingEventName.Locale, () => {
        setLocale(readSystemLocale());
      });
    } catch {
      // Best-effort - see readSystemLocale's own comment on why this isn't confirmed working yet.
    }
    return () => subscription?.remove();
  }, []);

  return locale;
}
