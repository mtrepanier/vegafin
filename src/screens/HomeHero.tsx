import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { formatHeroInfoLine } from '../util/format';
import { itemOrParentLogoImageUrl } from '../services/jellyfin/images';
import { Clock } from '../components/Clock';
import { HeroInfoLine } from '../components/HeroInfoLine';
import { HOME_HERO_CONTENT_HEIGHT } from './homeHeroLayout';

interface Props {
  item: BaseItemDto;
}

/**
 * The Home hero's foreground: whichever card currently has focus gets a logo standing in for a
 * text title when one exists, the episode's own title right below it (episodes only - a movie
 * has nothing else to show there, its title/logo already says everything), an info line (see
 * `formatHeroInfoLine` for the per-type shape, rendered via the shared `HeroInfoLine`), and a
 * 2-line overview, plus the top-right clock. Pinned in place over `ScreenBackdrop.tsx`'s image
 * (rendered separately, one level up, so it can go full-bleed behind the side nav) rather than
 * scrolling away with the rows below - see `HomeScreen.tsx`.
 */
export function HomeHero({ item }: Props) {
  const { colors } = useTheme();
  const logoUri = itemOrParentLogoImageUrl(item, 400);
  const episodeTitle = item.Type === BaseItemKind.Episode ? item.Name : undefined;
  const infoSegments = formatHeroInfoLine(item);

  return (
    <View style={styles.hero}>
      <View style={styles.topBar}>
        <Clock />
      </View>

      <View style={styles.content}>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text numberOfLines={2} style={[styles.title, { color: colors.onBackground }]}>
            {item.Name}
          </Text>
        )}
        {episodeTitle ? (
          <Text numberOfLines={1} style={[styles.episodeTitle, { color: colors.onBackground }]}>
            {episodeTitle}
          </Text>
        ) : null}
        {/* 2 lines, not 1 - an episode's "S1 E5 · <full date>" plus ratings plus the
            remaining-time suffix can still run long enough at this font size/width to need the
            second line rather than truncating away whichever section comes last. */}
        <HeroInfoLine segments={infoSegments} color={colors.onSurfaceVariant} fontSize={17} numberOfLines={2} />
        {item.Overview ? (
          <Text numberOfLines={2} style={[styles.overview, { color: colors.onSurface }]}>
            {item.Overview}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: HOME_HERO_CONTENT_HEIGHT,
  },
  topBar: {
    alignItems: 'flex-end',
    paddingHorizontal: layout.contentPadding,
    paddingTop: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: layout.contentPadding,
    paddingBottom: 20,
    gap: 4,
    maxWidth: 720,
  },
  logo: {
    width: 180,
    height: 72,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
  },
  episodeTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
  },
});
