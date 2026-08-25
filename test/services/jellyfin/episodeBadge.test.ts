import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { episodeBadgeLabel } from '../../../src/services/jellyfin/episodeBadge';

describe('episodeBadgeLabel', () => {
  it('formats an episode number as "E<n>"', () => {
    expect(episodeBadgeLabel({ Type: BaseItemKind.Episode, IndexNumber: 5 }, 'en')).toBe('E5');
  });

  it('formats an episode number as "É<n>" in French', () => {
    expect(episodeBadgeLabel({ Type: BaseItemKind.Episode, IndexNumber: 5 }, 'fr')).toBe('É5');
  });

  it('returns undefined for a non-episode item', () => {
    expect(episodeBadgeLabel({ Type: BaseItemKind.Movie, IndexNumber: 5 }, 'en')).toBeUndefined();
  });

  it('returns undefined for an episode with no IndexNumber', () => {
    expect(episodeBadgeLabel({ Type: BaseItemKind.Episode }, 'en')).toBeUndefined();
  });
});
