import React from 'react';
import { Pressable, StyleSheet, Text, type PressableStateCallbackType } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useT } from '../../i18n/useTranslation';

interface Props {
  type: 'intro' | 'outro';
  onPress: () => void;
}

/** "Skip Intro"/"Skip Outro" overlay button (`PlaybackScreens.tsx`) - shown while playback is
 * inside a media segment the Settings screen's Skip Intro/Skip Outro preference is set to "Ask"
 * for. Dismissing it without skipping is the remote's back button, matching the Next Up card's
 * own "back cancels the overlay, not playback" convention, rather than a second on-screen button
 * competing for focus here. */
export function SkipSegmentButton({ type, onPress }: Props) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Pressable hasTVPreferredFocus onPress={onPress} style={styles.wrap}>
      {({ focused }: PressableStateCallbackType) => (
        <Text
          style={[
            styles.label,
            {
              color: focused ? colors.onPrimaryContainer : colors.onSurface,
              backgroundColor: focused ? colors.primaryContainer : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {t(type === 'intro' ? 'player.skipIntro' : 'player.skipOutro')}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 24,
    bottom: 100,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
