import { resolveLanguage } from '../../src/i18n/resolveLanguage';

describe('resolveLanguage', () => {
  it('passes an explicit en/fr choice straight through regardless of device locale', () => {
    expect(resolveLanguage('en', 'fr-FR')).toBe('en');
    expect(resolveLanguage('fr', 'en-US')).toBe('fr');
  });

  it('resolves "system" to fr for a French-tagged locale', () => {
    expect(resolveLanguage('system', 'fr-FR')).toBe('fr');
    expect(resolveLanguage('system', 'fr-CA')).toBe('fr');
    expect(resolveLanguage('system', 'fr')).toBe('fr');
  });

  it('resolves "system" to en for anything not French, including null', () => {
    expect(resolveLanguage('system', 'en-US')).toBe('en');
    expect(resolveLanguage('system', 'de-DE')).toBe('en');
    expect(resolveLanguage('system', null)).toBe('en');
  });

  it('is case-insensitive on the locale tag', () => {
    expect(resolveLanguage('system', 'FR-fr')).toBe('fr');
  });
});
