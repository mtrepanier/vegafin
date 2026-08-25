import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';

export interface StepperOption<T> {
  value: T;
  label: string;
}

/** A curated preset list, not a raw min/max/step - a plain numeric range would mean pressing
 * D-pad right dozens of times to get from 1s to 120s. Both `SettingsStepper` callers below
 * (numeric seconds and named enums) share this one `{value, label}[]` shape either way. */
export function numericStepperOptions(values: number[], suffix: string): StepperOption<number>[] {
  return values.map((value) => ({ value, label: `${value}${suffix}` }));
}

interface Props<T> {
  label: string;
  value: T;
  options: StepperOption<T>[];
  onChange: (value: T) => void;
}

/** A labeled row with a left/right stepper (`< value >`) cycling through a fixed option list -
 * the TV-native equivalent of a slider, since D-pad remotes have no drag gesture and this
 * platform has no usable Slider component (see the README). Decrementing/incrementing past
 * either end of the list is a no-op rather than wrapping around, with the boundary button
 * dimmed to show it - `Pressable`'s own `disabled` prop was avoided since it isn't guaranteed
 * to leave the button focusable-but-inert on this platform's TV focus engine, unlike a plain
 * no-op `onPress`. */
export function SettingsStepper<T>({ label, value, options, onChange }: Props<T>) {
  const { colors } = useTheme();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[index];
  const canDecrement = index > 0;
  const canIncrement = index < options.length - 1;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.onSurface }]}>{label}</Text>
      <View style={styles.controls}>
        <StepButton
          icon="chevron-left"
          enabled={canDecrement}
          onPress={() => canDecrement && onChange(options[index - 1].value)}
        />
        <Text numberOfLines={1} style={[styles.value, { color: colors.onSurface }]}>
          {current?.label ?? ''}
        </Text>
        <StepButton
          icon="chevron-right"
          enabled={canIncrement}
          onPress={() => canIncrement && onChange(options[index + 1].value)}
        />
      </View>
    </View>
  );
}

function StepButton({ icon, enabled, onPress }: { icon: string; enabled: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const buttonStyle = [styles.stepButton, { backgroundColor: focused ? colors.primary : colors.surfaceVariant, opacity: enabled ? 1 : 0.35 }];
        return (
          <View style={buttonStyle}>
            <Icon name={icon} size={20} color={focused ? colors.onPrimary : colors.onSurfaceVariant} />
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
  },
  label: {
    fontSize: 16,
    flexShrink: 1,
    paddingRight: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    // Fixed, not minWidth - every SettingsStepper on the screen shares this exact width so the
    // -/+ buttons stay in the same horizontal position across rows and while cycling through a
    // single row's own options, regardless of how long the current option's label is ("Never"
    // vs. "At the End of Playback") - a minWidth let the longer ones grow the row and visibly
    // shift the buttons sideways relative to every row above/below.
    width: 200,
    textAlign: 'center',
  },
});
