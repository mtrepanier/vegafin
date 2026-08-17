import React from 'react';
import { useRoute } from '@amazon-devices/react-navigation__native';
import { StubScreen } from '../../components/StubScreen';

// Home page row/customization settings - ui/preferences equivalent.
export function HomeSettingsScreen() {
  return <StubScreen name="Home Settings" phase="Phase 2" />;
}

// App preferences root (playback, subtitles, interface, advanced, etc).
export function SettingsScreen() {
  const route = useRoute();
  return <StubScreen name="Settings" phase="Phase 2" detail={JSON.stringify(route.params ?? {})} />;
}

// Subtitle style customization - ui/preferences + SubtitleDelay.kt equivalent.
export function SubtitleSettingsScreen() {
  const route = useRoute();
  return <StubScreen name="Subtitle Settings" phase="Phase 2" detail={JSON.stringify(route.params ?? {})} />;
}

// Per-user profile settings (PIN, require login, language).
export function UserAppPreferencesScreen() {
  return <StubScreen name="User Preferences" phase="Phase 2" />;
}
