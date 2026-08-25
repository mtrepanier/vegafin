import React from 'react';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models/base-item-person';
import { layout } from '../../theme/types';
import { personImageUrl } from '../../services/jellyfin/images';
import { ItemRow } from '../../components/ItemRow';
import { PosterCard } from '../../components/cards/PosterCard';
import { useT } from '../../i18n/useTranslation';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  title?: string;
  people: BaseItemPerson[];
  navigation: AppNavigationProp<keyof DrawerParamList>;
  /** See `ItemRow`'s `autoFocus` doc - false on every page that already has a more authoritative initial focus target (the Play button). */
  autoFocus?: boolean;
}

/** Cast/crew row shared by Movie/Episode/SeriesOverview detail pages (`PersonRow.kt`). */
export function CastRow({ title, people, navigation, autoFocus = true }: Props) {
  const t = useT();
  if (people.length === 0) {
    return null;
  }
  return (
    <ItemRow
      title={title ?? t('common.castAndCrew')}
      items={people}
      autoFocus={autoFocus}
      keyExtractor={(person, index) => person.Id ?? String(index)}
      renderItem={(person, _index, hasTVPreferredFocus, onFocus) => (
        <PosterCard
          uri={personImageUrl(person, layout.square.width)}
          metrics={layout.square}
          title={person.Name ?? undefined}
          subtitle={person.Role ?? undefined}
          hasTVPreferredFocus={hasTVPreferredFocus}
          onFocus={onFocus}
          onPress={() => {
            if (person.Id) {
              navigation.navigate('MediaItem', { itemId: person.Id, type: BaseItemKind.Person });
            }
          }}
        />
      )}
    />
  );
}
