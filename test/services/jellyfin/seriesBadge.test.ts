import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { seriesUnwatchedCount } from '../../../src/services/jellyfin/seriesBadge';

describe('seriesUnwatchedCount', () => {
  it('returns the unplayed count for a series with unwatched episodes', () => {
    expect(seriesUnwatchedCount({ Type: BaseItemKind.Series, UserData: { UnplayedItemCount: 3 } })).toBe(3);
  });

  it('returns undefined for a fully watched series (UnplayedItemCount 0)', () => {
    expect(seriesUnwatchedCount({ Type: BaseItemKind.Series, UserData: { UnplayedItemCount: 0 } })).toBeUndefined();
  });

  it('returns undefined for a series with no UserData at all', () => {
    expect(seriesUnwatchedCount({ Type: BaseItemKind.Series })).toBeUndefined();
  });

  it('returns undefined for a non-series item, even with an UnplayedItemCount present', () => {
    expect(seriesUnwatchedCount({ Type: BaseItemKind.Movie, UserData: { UnplayedItemCount: 3 } })).toBeUndefined();
  });

  it('returns undefined for an episode item', () => {
    expect(seriesUnwatchedCount({ Type: BaseItemKind.Episode, UserData: { UnplayedItemCount: 3 } })).toBeUndefined();
  });
});
