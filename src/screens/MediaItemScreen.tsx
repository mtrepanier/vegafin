import React, { useEffect } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { MovieDetail } from './detail/MovieDetail';
import { EpisodeDetail } from './detail/EpisodeDetail';
import { CollectionDetail } from './detail/CollectionDetail';
import { PersonDetail } from './detail/PersonDetail';
import { StubScreen } from '../components/StubScreen';
import type { AppNavigationProp, DrawerParamList } from '../navigation/types';

/**
 * Generic detail router dispatching by BaseItemKind, mirroring `DestinationContent.kt`'s
 * `when (destination.type)` block. Series is the one type that doesn't get its own component
 * here: Phase 1 targets the binge-style `SeriesOverview` page instead of Kotlin's classic
 * `SeriesDetails` (see the plan's Series detail scope decision), so a Series-typed MediaItem
 * redirects there rather than being dispatched inline.
 */
export function MediaItemScreen() {
  const route = useRoute<RouteProp<DrawerParamList, 'MediaItem'>>();
  const navigation = useNavigation<AppNavigationProp<'MediaItem'>>();
  const { itemId, type } = route.params;

  useEffect(() => {
    if (type === BaseItemKind.Series) {
      // Drawer navigators don't expose replace(); navigate() is fine here since this only
      // fires once per (itemId, type) and swaps the screen body before the user sees it.
      navigation.navigate('SeriesOverview', { itemId, type });
    }
  }, [navigation, itemId, type]);

  switch (type) {
    case BaseItemKind.Movie:
    case BaseItemKind.Video:
    case BaseItemKind.MusicVideo:
      return <MovieDetail itemId={itemId} navigation={navigation} />;
    case BaseItemKind.Episode:
      return <EpisodeDetail itemId={itemId} navigation={navigation} />;
    case BaseItemKind.BoxSet:
      return <CollectionDetail itemId={itemId} navigation={navigation} />;
    case BaseItemKind.Person:
      return <PersonDetail itemId={itemId} navigation={navigation} />;
    case BaseItemKind.Series:
      return null; // redirecting, see effect above
    default:
      return <StubScreen name="Media Item" phase="Phase 1" detail={JSON.stringify(route.params)} />;
  }
}
