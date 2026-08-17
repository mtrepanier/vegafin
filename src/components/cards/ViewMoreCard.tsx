import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { layout, type CardMetrics } from '../../theme/types';

interface Props {
  metrics?: CardMetrics;
  label?: string;
  onPress: () => void;
}

/** Trailing "see all" card appended to a row/grid. Mirrors `ViewMoreCard.kt`/`HomePageViewMoreCard`. */
export function ViewMoreCard({ metrics = layout.poster, label = 'View All', onPress }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const animateTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 20, bounciness: 4 }).start();

  const outerWidth = metrics.width + layout.focusBorderWidth * 2;
  const outerHeight = metrics.height + layout.focusBorderWidth * 2;

  return (
    <Pressable onFocus={() => animateTo(layout.focusScale)} onBlur={() => animateTo(1)} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => (
        <Animated.View
          style={[
            styles.card,
            {
              width: outerWidth,
              height: outerHeight,
              borderColor: focused ? colors.border : colors.surfaceVariant,
              transform: [{ scale }],
            },
          ]}
        >
          <Icon name="chevron-right" size={28} color={colors.onSurfaceVariant} />
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: layout.focusBorderWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
