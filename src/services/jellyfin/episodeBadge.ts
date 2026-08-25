import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { translate } from '../../i18n/translate';
import type { Language } from '../../i18n/translations';

/**
 * "E5" corner badge for an episode card - lets Continue Watching/Next Up show the parent
 * series' poster (`seriesAwarePosterImageUrl`) while still telling episodes of the same show
 * apart. Undefined for anything that isn't an episode, or an episode missing its number.
 */
export function episodeBadgeLabel(item: BaseItemDto, language: Language): string | undefined {
  if (item.Type !== BaseItemKind.Episode || item.IndexNumber == null) {
    return undefined;
  }
  return translate(language, 'episode.badge', { number: item.IndexNumber });
}
