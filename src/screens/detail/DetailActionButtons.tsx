import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { IconButton } from '../../components/IconButton';
import { ticksToMs, formatTimeRemaining } from '../../util/format';

interface Props {
  item: BaseItemDto;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onToggleWatched: () => void;
  /** Extra buttons (e.g. Shuffle on Series/Collection) rendered between Play and the toggles. */
  extra?: React.ReactNode;
}

/** Play/Resume + favorite/watched toggles, shared across every detail page (`ExpandablePlayButtons`). */
export function DetailActionButtons({ item, onPlay, onToggleFavorite, onToggleWatched, extra }: Props) {
  const { colors } = useTheme();
  const resumeTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const resumeMs = resumeTicks > 0 ? ticksToMs(resumeTicks) : 0;
  const runtimeMs = item.RunTimeTicks ? ticksToMs(item.RunTimeTicks) : 0;

  return (
    <View style={styles.row}>
      <Pressable hasTVPreferredFocus onPress={onPlay}>
        {({ focused }: PressableStateCallbackType) => (
          <View
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary, borderColor: focused ? colors.border : 'transparent' },
            ]}
          >
            <Icon name="play-arrow" size={22} color={colors.onPrimary} />
            <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>
              {resumeMs > 0 ? `Resume` : 'Play'}
            </Text>
            {resumeMs > 0 && runtimeMs > 0 ? (
              <Text style={[styles.remaining, { color: colors.onPrimary }]}>{formatTimeRemaining(runtimeMs - resumeMs)}</Text>
            ) : null}
          </View>
        )}
      </Pressable>
      {extra}
      <IconButton
        icon={item.UserData?.IsFavorite ? 'favorite' : 'favorite-border'}
        active={item.UserData?.IsFavorite}
        onPress={onToggleFavorite}
      />
      <IconButton
        icon={item.UserData?.Played ? 'check-circle' : 'check-circle-outline'}
        active={item.UserData?.Played}
        onPress={onToggleWatched}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: layout.focusBorderWidth,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  remaining: {
    fontSize: 12,
    opacity: 0.8,
  },
});
