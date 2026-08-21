import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../../theme/ThemeContext';
import { layout } from '../../../theme/types';
import { backdropImageUrl, primaryImageUrl } from '../../../services/jellyfin/images';
import { formatQuickDetails } from '../../../util/format';

interface Props {
  series: BaseItemDto;
  episode: BaseItemDto | null;
}

/** Backdrop + title/synopsis for whichever episode currently has focus in the row below
 * (`FocusedEpisodeHeader.kt`) - falls back to the series' own art/overview before any episode
 * has taken focus yet. */
export function FocusedEpisodeHeader({ series, episode }: Props) {
  const { colors } = useTheme();
  const backdropUri = episode ? (primaryImageUrl(episode, 1280) ?? backdropImageUrl(series, 1280)) : backdropImageUrl(series, 1280);
  const title = episode?.Name ?? series.Name;
  const subtitle =
    episode?.IndexNumber != null && episode?.ParentIndexNumber != null
      ? `${series.Name} - S${episode.ParentIndexNumber}:E${episode.IndexNumber}`
      : series.Name;
  const overview = episode?.Overview ?? series.Overview;

  const scrimStyle = [StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: 0.45 }];
  return (
    <View>
      {backdropUri ? (
        <View style={styles.backdrop}>
          <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={scrimStyle} />
        </View>
      ) : null}
      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.primary }]}>{subtitle}</Text>
        <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
        {episode ? (
          <Text style={[styles.quickDetails, { color: colors.onSurfaceVariant }]}>{formatQuickDetails(episode)}</Text>
        ) : null}
        {overview ? (
          <Text numberOfLines={4} style={[styles.overview, { color: colors.onSurface }]}>
            {overview}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    width: '100%',
    aspectRatio: 21 / 9,
  },
  content: {
    padding: layout.contentPadding,
    gap: 6,
    maxWidth: 900,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  quickDetails: {
    fontSize: 14,
  },
  overview: {
    fontSize: 15,
    lineHeight: 22,
  },
});
