import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { layout, type CardMetrics } from '../../theme/types';
import { CardImage } from './CardImage';

interface Props {
  uri?: string;
  metrics?: CardMetrics;
  title?: string;
  subtitle?: string;
  progressPercent?: number;
  watched?: boolean;
  favorite?: boolean;
  hasTVPreferredFocus?: boolean;
  onFocus?: () => void;
  onPress: () => void;
  onLongPress?: () => void;
}

/**
 * Poster/banner card - image plus an optional sliding title/subtitle beneath it, a focus ring,
 * and a focus scale-up. Mirrors `BannerCard`/`BannerCardWithTitle`/`GridCard` (ui/cards/), which
 * this repo collapses into one component since RN has no equivalent of Compose's per-row
 * `cardContent` slot needing separate composables.
 */
export function PosterCard({
  uri,
  metrics = layout.poster,
  title,
  subtitle,
  progressPercent,
  watched,
  favorite,
  hasTVPreferredFocus,
  onFocus,
  onPress,
  onLongPress,
}: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 20, bounciness: 4 }).start();
  };

  const handleFocus = () => {
    animateTo(layout.focusScale);
    onFocus?.();
  };
  const handleBlur = () => animateTo(1);

  const outerWidth = metrics.width + layout.focusBorderWidth * 2;

  return (
    <Pressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {({ focused }: PressableStateCallbackType) => (
        <Animated.View style={{ width: outerWidth, transform: [{ scale }] }}>
          <View
            style={[
              styles.imageWrap,
              {
                width: outerWidth,
                height: metrics.height + layout.focusBorderWidth * 2,
                borderColor: focused ? colors.border : 'transparent',
              },
            ]}
          >
            <CardImage
              uri={uri}
              width={metrics.width}
              height={metrics.height}
              progressPercent={progressPercent}
              watched={watched}
              favorite={favorite}
            />
          </View>
          {title ? (
            <View style={styles.textWrap}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.onBackground }]}>
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageWrap: {
    borderWidth: layout.focusBorderWidth,
    borderRadius: 8,
    padding: 0,
  },
  textWrap: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
