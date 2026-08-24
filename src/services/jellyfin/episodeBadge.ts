import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

/**
 * "E5" corner badge for an episode card - lets Continue Watching/Next Up show the parent
 * series' poster (`seriesAwarePosterImageUrl`) while still telling episodes of the same show
 * apart. Undefined for anything that isn't an episode, or an episode missing its number.
 */
export function episodeBadgeLabel(item: BaseItemDto): string | undefined {
  if (item.Type !== BaseItemKind.Episode || item.IndexNumber == null) {
    return undefined;
  }
  return `E${item.IndexNumber}`;
}
