import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useAppSettings } from '../../services/storage/AppSettingsContext';
import { appSettingsRepository } from '../../services/storage/AppSettingsRepository';
import type { ShowNextUpTiming, SkipSegmentBehavior, ThemeMusicVolume, UiLanguage } from '../../services/storage/types';
import { useT } from '../../i18n/useTranslation';
import type { TFunction } from '../../i18n/useTranslation';
import { SettingsSection } from './SettingsSection';
import { SettingsToggle } from './SettingsToggle';
import { SettingsStepper, secondsStepperOptions, type StepperOption } from './SettingsStepper';
import { SettingsInertRow } from './SettingsInertRow';
import pkg from '../../../package.json';

function themeMusicOptions(t: TFunction): StepperOption<ThemeMusicVolume>[] {
  return [
    { value: 'disabled', label: t('settings.themeMusic.disabled') },
    { value: 'low', label: t('settings.themeMusic.low') },
    { value: 'medium', label: t('settings.themeMusic.medium') },
    { value: 'high', label: t('settings.themeMusic.high') },
    { value: 'full', label: t('settings.themeMusic.full') },
  ];
}

function showNextUpOptions(t: TFunction): StepperOption<ShowNextUpTiming>[] {
  return [
    { value: 'atEnd', label: t('settings.showNextUp.atEnd') },
    { value: 'duringCredits', label: t('settings.showNextUp.duringCredits') },
    { value: 'never', label: t('settings.showNextUp.never') },
  ];
}

function skipSegmentOptions(t: TFunction): StepperOption<SkipSegmentBehavior>[] {
  return [
    { value: 'ask', label: t('settings.skipSegment.ask') },
    { value: 'auto', label: t('settings.skipSegment.auto') },
    { value: 'off', label: t('settings.skipSegment.off') },
  ];
}

function languageOptions(t: TFunction): StepperOption<UiLanguage>[] {
  return [
    { value: 'system', label: t('settings.language.system') },
    { value: 'en', label: t('settings.language.en') },
    { value: 'fr', label: t('settings.language.fr') },
  ];
}

const HIDE_CONTROLS_SECONDS = [1, 2, 3, 4, 5, 7, 10, 15, 20, 30];
const SKIP_SECONDS = [5, 10, 15, 30, 45, 60, 90, 120];

/**
 * App preferences root (ui/preferences equivalent) - a flat, single-screen list of sections
 * rather than a nested settings navigator, since Phase 2's first pass only has one screen's
 * worth of options; `RootStackParamList`'s `Settings` route takes no params for the same
 * reason (an earlier `{ screen: string }` shape - never actually used anywhere - implied a
 * sub-screen picker this doesn't need yet).
 *
 * All of these persist via `AppSettingsRepository` (device-local, not synced to the Jellyfin
 * server or tied to whichever user is signed in). "Show Clock" (`HomeHero.tsx`), the three
 * Playback-section numeric settings (`PlaybackScreens.tsx`), and Interface Language (`src/i18n/`)
 * are wired into real behavior. Play Theme Music, Show Next Up, and Auto Play Next Up persist
 * correctly but don't yet drive anything, since theme-song audio and an end-of-playback Next Up
 * prompt are their own separate features, not yet built. Update checking is left as an inert
 * display row rather than a fake working control, for the same reason.
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const settings = useAppSettings();
  const t = useT();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{t('settings.title')}</Text>

      <SettingsSection title={t('settings.section.interface')}>
        <SettingsToggle
          label={t('settings.showClock')}
          value={settings.showClock}
          onChange={(v) => appSettingsRepository.update({ showClock: v })}
          hasTVPreferredFocus
        />
        <SettingsStepper
          label={t('settings.playThemeMusic')}
          value={settings.themeMusicVolume}
          options={themeMusicOptions(t)}
          onChange={(v) => appSettingsRepository.update({ themeMusicVolume: v })}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.section.playback')}>
        <SettingsStepper
          label={t('settings.hideControlsAfter')}
          value={settings.hideControlsAfterSec}
          options={secondsStepperOptions(HIDE_CONTROLS_SECONDS, t)}
          onChange={(v) => appSettingsRepository.update({ hideControlsAfterSec: v })}
        />
        <SettingsStepper
          label={t('settings.skipForward')}
          value={settings.skipForwardSec}
          options={secondsStepperOptions(SKIP_SECONDS, t)}
          onChange={(v) => appSettingsRepository.update({ skipForwardSec: v })}
        />
        <SettingsStepper
          label={t('settings.skipBackward')}
          value={settings.skipBackwardSec}
          options={secondsStepperOptions(SKIP_SECONDS, t)}
          onChange={(v) => appSettingsRepository.update({ skipBackwardSec: v })}
        />
        <SettingsStepper
          label={t('settings.showNextUp')}
          value={settings.showNextUp}
          options={showNextUpOptions(t)}
          onChange={(v) => appSettingsRepository.update({ showNextUp: v })}
        />
        <SettingsToggle
          label={t('settings.autoPlayNextUp')}
          value={settings.autoPlayNextUp}
          onChange={(v) => appSettingsRepository.update({ autoPlayNextUp: v })}
        />
        <SettingsStepper
          label={t('settings.skipIntro')}
          value={settings.skipIntro}
          options={skipSegmentOptions(t)}
          onChange={(v) => appSettingsRepository.update({ skipIntro: v })}
        />
        <SettingsStepper
          label={t('settings.skipOutro')}
          value={settings.skipOutro}
          options={skipSegmentOptions(t)}
          onChange={(v) => appSettingsRepository.update({ skipOutro: v })}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.section.userSettings')}>
        <SettingsStepper
          label={t('settings.interfaceLanguage')}
          value={settings.uiLanguage}
          options={languageOptions(t)}
          onChange={(v) => appSettingsRepository.update({ uiLanguage: v })}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.section.about')}>
        <SettingsInertRow label={t('settings.version')} value={pkg.version} />
        <SettingsInertRow label={t('settings.updates')} value={t('settings.updates.notAvailable')} />
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
