import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  label: string;
  value: string;
  note?: string;
}

/** A non-interactive settings row - not wrapped in `Pressable` at all, so it's skipped by D-pad
 * navigation entirely rather than being a focusable dead end that does nothing on select. Used
 * for values this screen only displays (app version) or hasn't wired up a real control for yet
 * (interface language, update checking) rather than faking a working one. */
export function SettingsInertRow({ label, value, note }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
      <View style={styles.valueWrap}>
        <Text style={[styles.value, { color: colors.onSurfaceVariant }]}>{value}</Text>
        {note ? <Text style={[styles.note, { color: colors.onSurfaceVariant }]}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 16,
    opacity: 0.6,
  },
  valueWrap: {
    alignItems: 'flex-end',
  },
  value: {
    fontSize: 15,
    opacity: 0.6,
  },
  note: {
    fontSize: 12,
    opacity: 0.45,
    marginTop: 2,
  },
});
