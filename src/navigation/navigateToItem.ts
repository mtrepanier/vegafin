import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { AppNavigationProp, DrawerParamList } from './types';

/**
 * Central "what happens when you press a card" dispatch, reused by every row/grid. Series
 * items go straight to the SeriesOverview binge page - Phase 1 targets that instead of the
 * classic `SeriesDetails` page Kotlin's `MediaItem(type=SERIES)` dispatch would otherwise
 * show (see MediaItemScreen.tsx); everything else goes through MediaItem's own type dispatch.
 */
export function navigateToItem<T extends keyof DrawerParamList>(navigation: AppNavigationProp<T>, item: BaseItemDto): void {
  if (!item.Id || !item.Type) {
    return;
  }
  if (item.Type === BaseItemKind.Series) {
    navigation.navigate('SeriesOverview', { itemId: item.Id, type: item.Type });
    return;
  }
  navigation.navigate('MediaItem', { itemId: item.Id, type: item.Type, collectionType: undefined });
}
