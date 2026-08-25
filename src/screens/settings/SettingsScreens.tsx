import React from 'react';
import { useRoute } from '@amazon-devices/react-navigation__native';
import { StubScreen } from '../../components/StubScreen';

// Home page row/customization settings - ui/preferences equivalent.
export function HomeSettingsScreen() {
  return <StubScreen name="stub.homeSettings" phase="Phase 2" />;
}

// App preferences root (playback, subtitles, interface, advanced, etc) - real implementation,
// see SettingsScreen.tsx. Re-exported from here so RootNavigator.tsx's existing import of every
// settings-ish screen from this one module didn't need to change.
export { SettingsScreen } from './SettingsScreen';

// Subtitle style customization - ui/preferences + SubtitleDelay.kt equivalent.
export function SubtitleSettingsScreen() {
  const route = useRoute();
  return <StubScreen name="stub.subtitleSettings" phase="Phase 2" detail={JSON.stringify(route.params ?? {})} />;
}

// Per-user profile settings (PIN, require login, language).
export function UserAppPreferencesScreen() {
  return <StubScreen name="stub.userPreferences" phase="Phase 2" />;
}
