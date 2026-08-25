import React from 'react';
import { useRoute } from '@amazon-devices/react-navigation__native';
import { StubScreen } from '../components/StubScreen';

// Live TV DVR recordings list - ui/detail/livetv/ equivalent.
export function RecordingsScreen() {
  const route = useRoute();
  return <StubScreen name="stub.recordings" phase="Phase 3" detail={JSON.stringify(route.params ?? {})} />;
}
