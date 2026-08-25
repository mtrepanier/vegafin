import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hasTVPreferredFocus?: boolean;
}

/** A labeled on/off row - the whole row is one `Pressable` that flips the value on select,
 * unlike `SettingsStepper.tsx` (which needs two separate targets for decrement/increment). */
export function SettingsToggle({ label, value, onChange, hasTVPreferredFocus }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onPress={() => onChange(!value)}>
      {({ focused }: PressableStateCallbackType) => {
        const rowStyle = [styles.row, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
        const labelStyle = [styles.label, { color: focused ? colors.onPrimaryContainer : colors.onSurface }];
        const trackStyle = [styles.track, { backgroundColor: value ? colors.primary : colors.surfaceVariant }];
        const thumbStyle = [
          styles.thumb,
          { backgroundColor: colors.onPrimary, alignSelf: value ? ('flex-end' as const) : ('flex-start' as const) },
        ];
        return (
          <View style={rowStyle}>
            <Text style={labelStyle}>{label}</Text>
            <View style={trackStyle}>
              <View style={thumbStyle} />
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  label: {
    fontSize: 16,
  },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 3,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
