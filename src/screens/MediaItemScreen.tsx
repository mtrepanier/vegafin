import React, { useEffect } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { MovieDetail } from './detail/MovieDetail';
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
 *
 * There's no Episode case at all, and no equivalent redirect effect for it either: unlike
 * Series (whose itemId already *is* the id this route would redirect to), an episode's itemId
 * is the episode's own id, not its series' - redirecting would need the series id, which isn't
 * in this route's params and would need a fetch to find. `navigateToItem.ts` (the only place
 * that builds `MediaItem` params) already has the full episode `BaseItemDto` in hand and sends
 * Episode presses straight to `SeriesOverview` with the right series id, without ever routing
 * through here - so this route is never actually asked to show an Episode.
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

  // Every case below is keyed by itemId: navigating from one MediaItem (e.g. a "More Like
  // This" poster) to another calls navigation.navigate() with new params on this same route,
  // which React Navigation resolves by updating this screen's params in place rather than
  // pushing a new one - without a key tied to itemId, these detail components would stay
  // mounted across that change, carrying over their previous ScrollView offset and focus
  // memory onto the new item's content instead of starting at the top.
  switch (type) {
    case BaseItemKind.Movie:
    case BaseItemKind.Video:
    case BaseItemKind.MusicVideo:
      return <MovieDetail key={itemId} itemId={itemId} navigation={navigation} />;
    case BaseItemKind.BoxSet:
      return <CollectionDetail key={itemId} itemId={itemId} navigation={navigation} />;
    case BaseItemKind.Person:
      return <PersonDetail key={itemId} itemId={itemId} navigation={navigation} />;
    case BaseItemKind.Series:
      return null; // redirecting, see effect above
    default:
      return <StubScreen name="Media Item" phase="Phase 1" detail={JSON.stringify(route.params)} />;
  }
}
