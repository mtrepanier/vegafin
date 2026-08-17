import React from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { layout, type CardMetrics } from '../theme/types';
import { primaryImageUrl } from '../services/jellyfin/images';
import { navigateToItem } from '../navigation/navigateToItem';
import type { AppNavigationProp, DrawerParamList } from '../navigation/types';
import { ItemRow } from './ItemRow';
import { PosterCard } from './cards/PosterCard';

interface Props {
  title: string;
  items: BaseItemDto[];
  navigation: AppNavigationProp<keyof DrawerParamList>;
  metrics?: CardMetrics;
}

/** A row of item cards that navigates via `navigateToItem` on press - the common case reused
 * by "More Like This"/similar-items/person-credits rows across the detail pages. */
export function PosterRow({ title, items, navigation, metrics = layout.poster }: Props) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ItemRow
      title={title}
      items={items}
      keyExtractor={(item) => item.Id ?? ''}
      renderItem={(item, _index, hasTVPreferredFocus, onFocus) => (
        <PosterCard
          uri={primaryImageUrl(item, metrics.width)}
          metrics={metrics}
          title={item.Name ?? undefined}
          subtitle={item.SeriesName ?? undefined}
          watched={item.UserData?.Played ?? false}
          favorite={item.UserData?.IsFavorite ?? false}
          progressPercent={item.UserData?.PlayedPercentage ?? undefined}
          hasTVPreferredFocus={hasTVPreferredFocus}
          onFocus={onFocus}
          onPress={() => navigateToItem(navigation, item)}
        />
      )}
    />
  );
}
