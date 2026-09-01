import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '../../components/Icon';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { useT } from '../../i18n/useTranslation';
import { useLanguage } from '../../i18n/useLanguage';
import { formatWeekdayDate, formatClockTime } from '../../util/format';

interface ProgramInfoOverlayProps {
  program: BaseItemDto;
  channel: BaseItemDto;
  /** Only a program actually airing right now is playable - there's no seeking into a future
   * or past slot, so a program outside its own air window gets no Play button at all rather
   * than one that would just fail. */
  live: boolean;
  onPlay: () => void;
  onClose: () => void;
}

/** A dimmed-backdrop modal card, not a full-screen page - opened by tapping any real guide cell
 * (a channel's own "no listings" placeholder still tunes in directly - see
 * LiveTvGuideScreen.tsx's own comment on why that one case skips this). First version covered
 * the whole screen like a reference client's own full-page version; changed after on-device
 * feedback to stay a small card over a dimmed guide instead, so the guide grid itself stays
 * visible (if dark) behind it - closer to how most TV UIs show a "peek" detail panel without
 * fully leaving the screen you tapped from. Deliberately not a reusable component pulled from
 * elsewhere - nothing else in this app shows a bare EPG program's own start/end/channel/overview
 * together, and there's no "Record" action here the way a reference client's own version has,
 * since recording/DVR is out of scope for this slice (see the Live TV guide section's own
 * scoping note). */
export function ProgramInfoOverlay({ program, channel, live, onPlay, onClose }: ProgramInfoOverlayProps) {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();

  const timeRange =
    program.StartDate && program.EndDate
      ? `${formatWeekdayDate(new Date(program.StartDate), language)} ${formatClockTime(new Date(program.StartDate), language)} - ${formatClockTime(new Date(program.EndDate), language)}`
      : undefined;
  // Same "{number} · {name}" convention LiveTvPlayerScreen.tsx's own title row already uses.
  const channelLabel = channel.Number ? `${channel.Number} · ${channel.Name ?? ''}` : channel.Name;

  const iconChipStyle = (focused: boolean) => [styles.iconChip, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];

  return (
    <View style={styles.backdrop}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.topBar}>
          <Pressable hasTVPreferredFocus={!live} onPress={onClose}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={iconChipStyle(focused)}>
                <Icon name="arrow-back" size={22} color={colors.onSurface} />
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{program.Name}</Text>
          {timeRange || channelLabel ? (
            <Text style={[styles.meta, { color: colors.onSurfaceVariant }]}>{[timeRange, channelLabel].filter(Boolean).join('   ')}</Text>
          ) : null}
          {program.Overview ? <Text style={[styles.overview, { color: colors.onSurface }]}>{program.Overview}</Text> : null}
        </ScrollView>

        {live ? (
          <View style={styles.bottomBar}>
            <Pressable hasTVPreferredFocus onPress={onPlay}>
              {({ focused }: PressableStateCallbackType) => (
                <View style={[styles.playButton, { backgroundColor: focused ? colors.onSurface : colors.primary }]}>
                  <Text style={[styles.playLabel, { color: focused ? colors.surface : colors.onPrimary }]}>{t('common.play')}</Text>
                </View>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '55%',
    maxWidth: 720,
    maxHeight: '75%',
    borderRadius: 16,
    paddingTop: 20,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
  },
  overview: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomBar: {
    marginTop: 20,
    alignItems: 'flex-start',
  },
  playButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  playLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
