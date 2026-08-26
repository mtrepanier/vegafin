import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

/**
 * Remaining-episode-count corner badge for a Series card that isn't fully watched - lets a
 * library grid/row show "3" at a glance rather than requiring a tap into the show to see how
 * much is left. Undefined for anything that isn't a Series, or one with nothing left unwatched
 * (`UnplayedItemCount` 0 or missing) - a fully watched series shows the plain checkmark badge
 * (`PosterCard`'s `watched` prop) instead, the same way a fully watched movie does.
 */
export function seriesUnwatchedCount(item: BaseItemDto): number | undefined {
  if (item.Type !== BaseItemKind.Series) {
    return undefined;
  }
  const count = item.UserData?.UnplayedItemCount;
  return count && count > 0 ? count : undefined;
}
