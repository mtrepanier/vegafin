import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { useT } from '../../i18n/useTranslation';
import { useLanguage } from '../../i18n/useLanguage';
import { translate } from '../../i18n/translate';

interface Props {
  item: BaseItemDto;
  /** Seconds left before `onPlay` fires on its own (Auto Play Next Up) - `null` when
   * autoplay is off, so the card just waits for an explicit press instead of counting down. */
  countdownSec: number | null;
  onPlay: () => void;
  onDismiss: () => void;
}

/**
 * End-of-playback "Next Up" card (`PlaybackScreens.tsx`) - appears over the video once the
 * Settings screen's `showNextUp` threshold is crossed, offering the next episode in the series.
 * A card, not a full-screen takeover, so the tail end of the current episode (or its actual end
 * credits) stays visible and playing behind it rather than being cut off.
 */
export function NextUpCard({ item, countdownSec, onPlay, onDismiss }: Props) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const imageUri = primaryImageUrl(item, layout.landscape.width * 2);
  const episodeLabel =
    item.ParentIndexNumber != null && item.IndexNumber != null
      ? translate(language, 'episode.seasonEpisode', { season: item.ParentIndexNumber, episode: item.IndexNumber })
      : undefined;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.surfaceVariant }]}>
        {imageUri ? <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      </View>
      <View style={styles.info}>
        <Text style={[styles.heading, { color: colors.onSurfaceVariant }]}>{t('home.nextUp')}</Text>
        {item.SeriesName ? (
          <Text numberOfLines={1} style={[styles.series, { color: colors.onSurface }]}>
            {item.SeriesName}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurfaceVariant }]}>
          {episodeLabel ? `${episodeLabel} · ${item.Name ?? ''}` : item.Name}
        </Text>
        <View style={styles.actions}>
          <Pressable hasTVPreferredFocus onPress={onPlay}>
            {({ focused }: PressableStateCallbackType) => {
              const buttonStyle = [styles.playButton, { backgroundColor: focused ? colors.onBackground : colors.primary }];
              const labelColor = focused ? colors.background : colors.onPrimary;
              return (
                <View style={buttonStyle}>
                  <Icon name="play-arrow" size={18} color={labelColor} />
                  <Text style={[styles.playLabel, { color: labelColor }]}>
                    {countdownSec != null ? t('player.nextUpCountdown', { seconds: countdownSec }) : t('player.playNow')}
                  </Text>
                </View>
              );
            }}
          </Pressable>
          <Pressable onPress={onDismiss}>
            {({ focused }: PressableStateCallbackType) => {
              const dismissStyle = [styles.dismissButton, { borderColor: focused ? colors.border : 'transparent' }];
              return (
                <View style={dismissStyle}>
                  <Text style={{ color: colors.onSurfaceVariant }}>{t('common.dismiss')}</Text>
                </View>
              );
            }}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 420,
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  imageWrap: {
    width: layout.landscape.width,
    height: layout.landscape.height,
    borderRadius: 8,
    overflow: 'hidden',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  series: {
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    fontSize: 13,
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  playLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
});
