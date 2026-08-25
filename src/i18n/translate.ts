import { catalogs, type Language, type TranslationKey } from './translations';

/** `{name}`-style interpolation, the common subset every catalog string actually needs (counts,
 * seconds, season numbers) - deliberately not a full ICU MessageFormat (plurals, gender, etc.),
 * since this app's two languages haven't needed real plural rules yet (French singular/plural
 * happens to match English closely enough for every string used so far). Revisit if that stops
 * holding. */
export type TranslationParams = Record<string, string | number>;

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Pure - no React dependency, so `util/format.ts`'s already-pure formatters can call this
 * directly with a resolved `Language` rather than needing a `t` callback threaded through them.
 * Screens/components use `useT()` (`useTranslation.ts`) instead, which closes over the
 * currently-resolved language for you. */
export function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  return interpolate(catalogs[language][key], params);
}
