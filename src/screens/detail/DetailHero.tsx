import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { itemOrParentLogoImageUrl } from '../../services/jellyfin/images';
import { formatHeroInfoLine } from '../../util/format';
import { HeroInfoLine } from '../../components/HeroInfoLine';

interface Props {
  /** Drives the logo (or plain title text) and genres - always the series/movie itself, never
   * swapped per focused episode. */
  item: BaseItemDto;
  /** Drives the episode title line and the info line - defaults to `item`. Pass whichever
   * episode currently has focus (`SeriesOverviewScreen.tsx`) to get "S1 E1", the episode's own
   * air date, and its own title under the logo instead of the series' own year/runtime/rating;
   * `MovieDetail.tsx` never passes this, so its info line stays exactly the movie's own. */
  detailItem?: BaseItemDto;
}

/** Logo (or plain title text) + episode title (episodes only) + the shared `HeroInfoLine` +
 * genres - the identity block shared by `MovieDetail.tsx` and `SeriesOverviewScreen.tsx`,
 * sitting over each page's own `ScreenBackdrop`. Pulled out once both screens needed the same
 * pieces, rather than each screen duplicating this JSX. */
export function DetailHero({ item, detailItem = item }: Props) {
  const { colors } = useTheme();
  const logoUri = itemOrParentLogoImageUrl(item, 400);
  const episodeTitle = detailItem.Type === BaseItemKind.Episode ? detailItem.Name : undefined;
  const infoSegments = formatHeroInfoLine(detailItem);

  return (
    <>
      {logoUri ? (
        <Image source={{ uri: logoUri }} style={styles.logo} resizeMode="contain" />
      ) : (
        <Text style={[styles.title, { color: colors.onBackground }]}>{item.Name}</Text>
      )}
      {episodeTitle ? (
        <Text numberOfLines={1} style={[styles.episodeTitle, { color: colors.onBackground }]}>
          {episodeTitle}
        </Text>
      ) : null}
      <HeroInfoLine segments={infoSegments} color={colors.onSurfaceVariant} fontSize={16} numberOfLines={2} />
      {item.Genres?.length ? (
        <Text style={[styles.genres, { color: colors.onSurfaceVariant }]}>{item.Genres.join(', ')}</Text>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 160,
    height: 64,
    alignSelf: 'flex-start',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  episodeTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  genres: {
    fontSize: 14,
  },
});
