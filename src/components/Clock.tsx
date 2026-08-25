import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useCurrentTime } from '../util/useCurrentTime';
import { formatClockTime } from '../util/format';
import { useLanguage } from '../i18n/useLanguage';

/** Top-right wall clock on the Home hero, matching the reference screenshot. */
export function Clock() {
  const { colors } = useTheme();
  const now = useCurrentTime();
  const language = useLanguage();
  return <Text style={[styles.text, { color: colors.onBackground }]}>{formatClockTime(now, language)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 22,
    fontWeight: '600',
  },
});
