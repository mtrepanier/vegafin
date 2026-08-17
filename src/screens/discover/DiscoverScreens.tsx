import React from 'react';
import { useRoute } from '@amazon-devices/react-navigation__native';
import { StubScreen } from '../../components/StubScreen';

// ui/discover/DiscoverPage.kt equivalent - Jellyseerr trending/upcoming browse.
export function DiscoverScreen() {
  return <StubScreen name="Discover" phase="Phase 3" />;
}

// ui/detail/discover/DiscoverMovieDetails.kt / DiscoverSeriesDetails.kt equivalent.
export function DiscoveredItemScreen() {
  const route = useRoute();
  return <StubScreen name="Discovered Item" phase="Phase 3" detail={JSON.stringify(route.params ?? {})} />;
}

// "See more" expansion of a discover row/search result set.
export function DiscoverMoreResultScreen() {
  const route = useRoute();
  return (
    <StubScreen name="Discover More Results" phase="Phase 3" detail={JSON.stringify(route.params ?? {})} />
  );
}
