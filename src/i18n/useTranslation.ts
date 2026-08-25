import { useCallback } from 'react';
import { useLanguage } from './useLanguage';
import { translate, type TranslationParams } from './translate';
import type { TranslationKey } from './translations';

export type TFunction = (key: TranslationKey, params?: TranslationParams) => string;

/** `const t = useT()` in any component - resolves the current language once per render and
 * returns a stable `t(key, params?)` closed over it, the same shape most i18n libraries use. */
export function useT(): TFunction {
  const language = useLanguage();
  return useCallback((key: TranslationKey, params?: TranslationParams) => translate(language, key, params), [language]);
}
