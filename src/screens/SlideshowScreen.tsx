import React from 'react';
import { useRoute } from '@amazon-devices/react-navigation__native';
import { StubScreen } from '../components/StubScreen';

// ui/slideshow/SlideshowPage.kt + AppScreensaver.kt equivalent (photo albums, screensaver).
export function SlideshowScreen() {
  const route = useRoute();
  return <StubScreen name="stub.slideshow" phase="Phase 3" detail={JSON.stringify(route.params ?? {})} />;
}
