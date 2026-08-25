import { en } from './en';
import { fr } from './fr';

export const catalogs = { en, fr } as const;

/** The two languages this app actually ships translations for - distinct from `UiLanguage`
 * (`services/storage/types.ts`), which also has `'system'` as a settings *choice* that resolves
 * down to one of these via `useSystemLocale.ts`. */
export type Language = keyof typeof catalogs;

export { type TranslationKey } from './en';
