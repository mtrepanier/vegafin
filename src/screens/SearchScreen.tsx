import React from 'react';
import { useRoute } from '@amazon-devices/react-navigation__native';
import { StubScreen } from '../components/StubScreen';

// ui/detail/search/SearchForDialog.kt equivalent.
export function SearchScreen() {
  const route = useRoute();
  return <StubScreen name="nav.search" phase="Phase 2" detail={JSON.stringify(route.params ?? {})} />;
}
