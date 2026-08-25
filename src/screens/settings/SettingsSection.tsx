import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.onSurfaceVariant }]}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 4,
  },
  title: {
    // Bigger than the row labels below it (fontSize 16 in SettingsToggle/SettingsStepper/
    // SettingsInertRow) - a section header should read as more prominent than the settings it
    // groups, not smaller than them.
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  rows: {
    gap: 2,
  },
});
