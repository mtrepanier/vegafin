import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { formatClockTime, formatFullDate, remainingRuntimeMs, formatHeroInfoLine, formatSeasonLabel } from '../../src/util/format';

describe('formatClockTime', () => {
  it('formats as h:mm AM/PM', () => {
    expect(formatClockTime(new Date(2026, 5, 19, 13, 7), 'en')).toBe('1:07 PM');
  });

  it('pads single-digit minutes', () => {
    expect(formatClockTime(new Date(2026, 5, 19, 9, 2), 'en')).toBe('9:02 AM');
  });
});

describe('formatFullDate', () => {
  it('formats an ISO date as "Mon D, YYYY"', () => {
    expect(formatFullDate(new Date(2026, 5, 19).toISOString(), 'en')).toBe('Jun 19, 2026');
  });
});

describe('remainingRuntimeMs', () => {
  it('prefers PlayedPercentage - Items/Resume carries it reliably even when PlaybackPositionTicks is missing', () => {
    // 44 minutes total, 50% played - 22 minutes left.
    const ms = remainingRuntimeMs({ RunTimeTicks: 44 * 60 * 10_000_000, UserData: { PlayedPercentage: 50 } });
    expect(ms).toBe(22 * 60 * 1000);
  });

  it('falls back to PlaybackPositionTicks when PlayedPercentage is absent', () => {
    // 44 minutes total, 38 minutes in - 6 minutes left.
    const ms = remainingRuntimeMs({ RunTimeTicks: 44 * 60 * 10_000_000, UserData: { PlaybackPositionTicks: 38 * 60 * 10_000_000 } });
    expect(ms).toBe(6 * 60 * 1000);
  });

  it('returns undefined when there is no saved position at all', () => {
    expect(remainingRuntimeMs({ RunTimeTicks: 44 * 60 * 10_000_000, UserData: { PlaybackPositionTicks: 0 } })).toBeUndefined();
  });

  it('returns undefined when there is no runtime at all', () => {
    expect(remainingRuntimeMs({ UserData: { PlaybackPositionTicks: 1000 } })).toBeUndefined();
  });
});

describe('formatHeroInfoLine', () => {
  it('leads with season/episode and the full air date for an episode', () => {
    const item = {
      Type: BaseItemKind.Episode,
      ParentIndexNumber: 1,
      IndexNumber: 5,
      PremiereDate: new Date(2026, 5, 19).toISOString(),
    };
    expect(formatHeroInfoLine(item, 'en')).toEqual([
      { kind: 'text', value: 'S1 E5' },
      { kind: 'text', value: 'Jun 19, 2026' },
    ]);
  });

  it('leads with year, runtime, and official rating for a movie', () => {
    const item = {
      Type: BaseItemKind.Movie,
      ProductionYear: 2026,
      RunTimeTicks: 90 * 60 * 10_000_000,
      OfficialRating: 'CA-G',
    };
    expect(formatHeroInfoLine(item, 'en')).toEqual([
      { kind: 'text', value: '2026' },
      { kind: 'text', value: '1h 30m' },
      { kind: 'text', value: 'CA-G' },
    ]);
  });

  it('tags community and critic ratings separately, so they can be styled differently', () => {
    const item = {
      Type: BaseItemKind.Movie,
      ProductionYear: 2026,
      CommunityRating: 7.6,
      CriticRating: 92,
    };
    expect(formatHeroInfoLine(item, 'en')).toEqual([
      { kind: 'text', value: '2026' },
      { kind: 'communityRating', value: '7.6' },
      { kind: 'criticRating', value: '🍅 92%' },
    ]);
  });

  it('includes community and critic ratings for an episode too, when present', () => {
    const item = {
      Type: BaseItemKind.Episode,
      ParentIndexNumber: 1,
      IndexNumber: 5,
      CommunityRating: 8.1,
      CriticRating: 88,
    };
    expect(formatHeroInfoLine(item, 'en')).toEqual([
      { kind: 'text', value: 'S1 E5' },
      { kind: 'communityRating', value: '8.1' },
      { kind: 'criticRating', value: '🍅 88%' },
    ]);
  });

  it('appends the remaining time (not a clock time) for an in-progress item, computed from PlayedPercentage', () => {
    const item = {
      Type: BaseItemKind.Episode,
      ParentIndexNumber: 1,
      IndexNumber: 5,
      RunTimeTicks: 44 * 60 * 10_000_000,
      UserData: { PlayedPercentage: 50 },
    };
    expect(formatHeroInfoLine(item, 'en')).toEqual([
      { kind: 'text', value: 'S1 E5' },
      { kind: 'text', value: '22m left' },
    ]);
  });

  it('omits the remaining-time section for an item with no saved position', () => {
    const item = { Type: BaseItemKind.Movie, ProductionYear: 2026, UserData: {} };
    expect(formatHeroInfoLine(item, 'en')).toEqual([{ kind: 'text', value: '2026' }]);
  });

  it('renders in French when given the fr language', () => {
    const item = {
      Type: BaseItemKind.Episode,
      ParentIndexNumber: 1,
      IndexNumber: 5,
      RunTimeTicks: 44 * 60 * 10_000_000,
      UserData: { PlayedPercentage: 50 },
    };
    expect(formatHeroInfoLine(item, 'fr')).toEqual([
      { kind: 'text', value: 'S1 É5' },
      { kind: 'text', value: 'Il reste 22 min' },
    ]);
  });
});

describe('formatSeasonLabel', () => {
  it('builds "Season N" from IndexNumber', () => {
    expect(formatSeasonLabel({ IndexNumber: 1 }, 'en')).toBe('Season 1');
    expect(formatSeasonLabel({ IndexNumber: 12 }, 'en')).toBe('Season 12');
  });

  it('labels season 0 "Specials"', () => {
    expect(formatSeasonLabel({ IndexNumber: 0 }, 'en')).toBe('Specials');
  });

  it('falls back to Name when there is no IndexNumber', () => {
    expect(formatSeasonLabel({ Name: 'Bonus Content' }, 'en')).toBe('Bonus Content');
  });

  it('falls back to a plain "Season" when neither is present', () => {
    expect(formatSeasonLabel({}, 'en')).toBe('Season');
  });

  it('builds "Saison N" in French', () => {
    expect(formatSeasonLabel({ IndexNumber: 1 }, 'fr')).toBe('Saison 1');
    expect(formatSeasonLabel({ IndexNumber: 0 }, 'fr')).toBe('Spéciaux');
  });
});
