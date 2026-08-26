import React from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { layout, type CardMetrics } from '../theme/types';
import { primaryImageUrl } from '../services/jellyfin/images';
import { seriesUnwatchedCount } from '../services/jellyfin/seriesBadge';
import { navigateToItem } from '../navigation/navigateToItem';
import type { AppNavigationProp, DrawerParamList } from '../navigation/types';
import { ItemRow } from './ItemRow';
import { PosterCard } from './cards/PosterCard';

interface Props {
  title: string;
  items: BaseItemDto[];
  navigation: AppNavigationProp<keyof DrawerParamList>;
  metrics?: CardMetrics;
  /** See `ItemRow`'s `autoFocus` doc - false on every page that already has a more authoritative initial focus target (the Play button). */
  autoFocus?: boolean;
  /** False to match the Home screen's card look (art only, no text underneath) - see
   * `MovieDetail.tsx`'s "More Like This" row. Defaults to true everywhere else, since those
   * rows have no hero showing the item's name the way Home's does. */
  showTitles?: boolean;
}

/** A row of item cards that navigates via `navigateToItem` on press - the common case reused
 * by "More Like This"/similar-items/person-credits rows across the detail pages. */
export function PosterRow({ title, items, navigation, metrics = layout.poster, autoFocus = true, showTitles = true }: Props) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ItemRow
      title={title}
      items={items}
      autoFocus={autoFocus}
      keyExtractor={(item) => item.Id ?? ''}
      renderItem={(item, _index, hasTVPreferredFocus, onFocus) => (
        <PosterCard
          uri={primaryImageUrl(item, metrics.width)}
          metrics={metrics}
          title={showTitles ? item.Name ?? undefined : undefined}
          subtitle={showTitles ? item.SeriesName ?? undefined : undefined}
          watched={item.UserData?.Played ?? false}
          favorite={item.UserData?.IsFavorite ?? false}
          progressPercent={item.UserData?.PlayedPercentage ?? undefined}
          unwatchedCount={seriesUnwatchedCount(item)}
          hasTVPreferredFocus={hasTVPreferredFocus}
          onFocus={onFocus}
          onPress={() => navigateToItem(navigation, item)}
        />
      )}
    />
  );
}
