import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from '@amazon-devices/react-native-svg';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../theme/ThemeContext';
import { backdropImageUrl } from '../services/jellyfin/images';
import { HOME_HERO_BACKDROP_HEIGHT } from './homeHeroLayout';

interface Props {
  item: BaseItemDto | null;
}

/**
 * The Home hero's background image, rendered at `MainDrawerNavigator` level as a full-bleed
 * layer behind the *entire* screen - including the side nav rail, which goes transparent while
 * this is showing (see `MainDrawerNavigator.tsx`) - rather than inside `HomeScreen.tsx` itself,
 * which only occupies the content pane to the nav's right and so could never draw behind it.
 *
 * Fills the whole screen height, not just the image itself: the photo only covers the top
 * `HOME_HERO_BACKDROP_HEIGHT` pixels, followed by a solid `colors.background` fill for
 * whatever's below (usually the rows), with a genuine SVG `LinearGradient` fading continuously
 * between the two - not the stacked flat-opacity `View`s an earlier version used to fake one.
 * That approach was visibly banded no matter how many steps it used (each step is a hard-edged
 * rectangle, not an interpolated ramp, and it reads as such against a busy image) - a real
 * gradient was the fix, not more/smaller bands. `@amazon-devices/react-native-svg` is already a
 * system-deployed Kepler library (see its own `README.kepler.md` - no manual linking needed,
 * unlike the icon-fonts asset gotcha), so this doesn't carry that same native-module risk.
 */
export function HomeHeroBackdrop({ item }: Props) {
  const { colors } = useTheme();
  if (!item) {
    return null;
  }
  const backdropUri = backdropImageUrl(item, 1600);
  if (!backdropUri) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      <Image source={{ uri: backdropUri }} style={styles.image} resizeMode="cover" />
      <Svg width="100%" height={HOME_HERO_BACKDROP_HEIGHT} style={styles.image}>
        <Defs>
          <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0.45} />
            <Stop offset="0.55" stopColor={colors.background} stopOpacity={0.65} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroFade)" />
      </Svg>
      <View style={[styles.solidFill, { top: HOME_HERO_BACKDROP_HEIGHT, backgroundColor: colors.background }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HOME_HERO_BACKDROP_HEIGHT,
  },
  solidFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
