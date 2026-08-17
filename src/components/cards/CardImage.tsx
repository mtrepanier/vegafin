import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
  uri?: string;
  width: number;
  height: number;
  /** Played percentage (0-100). Draws a progress bar along the bottom edge when 0 < value < 100. */
  progressPercent?: number;
  watched?: boolean;
  favorite?: boolean;
  borderRadius?: number;
}

/**
 * Shared image cell for every card type - poster/banner art plus the watched checkmark,
 * favorite heart, and resume-progress bar overlays common to all of them. Mirrors
 * `ItemCardImage.kt`.
 */
export function CardImage({ uri, width, height, progressPercent, watched, favorite, borderRadius = 6 }: Props) {
  const { colors } = useTheme();
  const showProgress = progressPercent != null && progressPercent > 0 && progressPercent < 100;

  return (
    <View
      style={[
        styles.container,
        { width, height, borderRadius, backgroundColor: colors.surfaceVariant },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}

      {watched ? (
        <View style={[styles.badge, styles.watchedBadge, { backgroundColor: colors.primary }]}>
          <Icon name="check" size={12} color={colors.onPrimary} />
        </View>
      ) : null}

      {favorite ? (
        <View style={[styles.badge, styles.favoriteBadge]}>
          <Icon name="favorite" size={14} color={colors.error} />
        </View>
      ) : null}

      {showProgress ? (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchedBadge: {
    right: 6,
  },
  favoriteBadge: {
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  progressFill: {
    height: '100%',
  },
});
