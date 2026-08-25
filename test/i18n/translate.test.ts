import { translate } from '../../src/i18n/translate';

describe('translate', () => {
  it('returns the plain string for a key with no placeholders', () => {
    expect(translate('en', 'nav.home')).toBe('Home');
    expect(translate('fr', 'nav.home')).toBe('Accueil');
  });

  it('interpolates {placeholder} tokens from params', () => {
    expect(translate('en', 'season.numbered', { number: 3 })).toBe('Season 3');
    expect(translate('fr', 'season.numbered', { number: 3 })).toBe('Saison 3');
  });

  it('leaves an unmatched placeholder token untouched rather than throwing', () => {
    expect(translate('en', 'season.numbered', {})).toBe('Season {number}');
  });

  it('substitutes every occurrence of a repeated placeholder', () => {
    expect(translate('en', 'episode.seasonEpisode', { season: 1, episode: 5 })).toBe('S1 E5');
  });
});
