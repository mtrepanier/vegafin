import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useAppSettings } from '../../services/storage/AppSettingsContext';
import { appSettingsRepository } from '../../services/storage/AppSettingsRepository';
import type { ShowNextUpTiming, ThemeMusicVolume } from '../../services/storage/types';
import { SettingsSection } from './SettingsSection';
import { SettingsToggle } from './SettingsToggle';
import { SettingsStepper, numericStepperOptions, type StepperOption } from './SettingsStepper';
import { SettingsInertRow } from './SettingsInertRow';
import pkg from '../../../package.json';

const THEME_MUSIC_OPTIONS: StepperOption<ThemeMusicVolume>[] = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'full', label: 'Full' },
];

const SHOW_NEXT_UP_OPTIONS: StepperOption<ShowNextUpTiming>[] = [
  { value: 'atEnd', label: 'At the End of Playback' },
  { value: 'duringCredits', label: 'During End Credits' },
  { value: 'never', label: 'Never' },
];

const HIDE_CONTROLS_OPTIONS = numericStepperOptions([1, 2, 3, 4, 5, 7, 10, 15, 20, 30], 's');
const SKIP_SECONDS_OPTIONS = numericStepperOptions([5, 10, 15, 30, 45, 60, 90, 120], 's');

/**
 * App preferences root (ui/preferences equivalent) - a flat, single-screen list of sections
 * rather than a nested settings navigator, since Phase 2's first pass only has one screen's
 * worth of options; `RootStackParamList`'s `Settings` route takes no params for the same
 * reason (an earlier `{ screen: string }` shape - never actually used anywhere - implied a
 * sub-screen picker this doesn't need yet).
 *
 * All of these persist via `AppSettingsRepository` (device-local, not synced to the Jellyfin
 * server or tied to whichever user is signed in). Only "Show Clock" (`HomeHero.tsx`) and the
 * three Playback-section numeric settings (`PlaybackScreens.tsx`) are wired into real behavior
 * so far - Play Theme Music, Show Next Up, and Auto Play Next Up persist correctly but don't
 * yet drive anything, since theme-song audio and an end-of-playback Next Up prompt are their
 * own separate features, not yet built. Interface language and update checking are left as
 * inert display rows rather than fake working controls, for the same reason.
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useAppSettings();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.onBackground }]}>Settings</Text>

      <SettingsSection title="Interface">
        <SettingsToggle
          label="Show Clock"
          value={settings.showClock}
          onChange={(v) => appSettingsRepository.update({ showClock: v })}
          hasTVPreferredFocus
        />
        <SettingsStepper
          label="Play Theme Music"
          value={settings.themeMusicVolume}
          options={THEME_MUSIC_OPTIONS}
          onChange={(v) => appSettingsRepository.update({ themeMusicVolume: v })}
        />
      </SettingsSection>

      <SettingsSection title="Playback">
        <SettingsStepper
          label="Hide Playback Controls After"
          value={settings.hideControlsAfterSec}
          options={HIDE_CONTROLS_OPTIONS}
          onChange={(v) => appSettingsRepository.update({ hideControlsAfterSec: v })}
        />
        <SettingsStepper
          label="Skip Forward"
          value={settings.skipForwardSec}
          options={SKIP_SECONDS_OPTIONS}
          onChange={(v) => appSettingsRepository.update({ skipForwardSec: v })}
        />
        <SettingsStepper
          label="Skip Backward"
          value={settings.skipBackwardSec}
          options={SKIP_SECONDS_OPTIONS}
          onChange={(v) => appSettingsRepository.update({ skipBackwardSec: v })}
        />
        <SettingsStepper
          label="Show Next Up"
          value={settings.showNextUp}
          options={SHOW_NEXT_UP_OPTIONS}
          onChange={(v) => appSettingsRepository.update({ showNextUp: v })}
        />
        <SettingsToggle
          label="Auto Play Next Up"
          value={settings.autoPlayNextUp}
          onChange={(v) => appSettingsRepository.update({ autoPlayNextUp: v })}
        />
      </SettingsSection>

      <SettingsSection title="User Settings">
        <SettingsInertRow label="Interface Language" value="English" note="Coming soon" />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsInertRow label="Version" value={pkg.version} />
        <SettingsInertRow label="Updates" value="Not available yet" />
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.contentPadding,
    paddingTop: 64,
    paddingBottom: layout.contentPadding,
    maxWidth: 720,
    gap: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
});
