import React from 'react';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemPerson } from '@jellyfin/sdk/lib/generated-client/models/base-item-person';
import { layout } from '../../theme/types';
import { personImageUrl } from '../../services/jellyfin/images';
import { ItemRow } from '../../components/ItemRow';
import { PosterCard } from '../../components/cards/PosterCard';
import type { AppNavigationProp, DrawerParamList } from '../../navigation/types';

interface Props {
  title?: string;
  people: BaseItemPerson[];
  navigation: AppNavigationProp<keyof DrawerParamList>;
}

/** Cast/crew row shared by Movie/Episode/SeriesOverview detail pages (`PersonRow.kt`). */
export function CastRow({ title = 'Cast & Crew', people, navigation }: Props) {
  if (people.length === 0) {
    return null;
  }
  return (
    <ItemRow
      title={title}
      items={people}
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
