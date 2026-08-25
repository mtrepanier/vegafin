import React from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';

interface ActionButtonProps {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}

/** Icon-only by default, expanding to an inverted light pill with the label alongside the icon
 * while focused - same "collapsed until focus reveals more" shape as the side nav rail
 * (`focus/useFocusGroupExpanded.ts`), just per-button instead of per-region, and every button
 * (including Play) gets identical treatment rather than Play having its own filled-at-rest
 * style - matching the reference screenshot, where the focused button is the only one that
 * looks different from the rest. `colors.onBackground`/`colors.background` (rather than a
 * literal white/black) keep the inverted pill theme-aware across this app's 8 palettes. */
function ActionButton({ icon, label, active, onPress, hasTVPreferredFocus }: ActionButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const contentColor = focused ? colors.background : active ? colors.primary : colors.onSurfaceVariant;
        const buttonStyle = [
          styles.button,
          focused && styles.buttonExpanded,
          { backgroundColor: focused ? colors.onBackground : colors.surfaceVariant },
        ];
        return (
          <View style={buttonStyle}>
            <Icon name={icon} size={22} color={contentColor} />
            {focused ? (
              <Text numberOfLines={1} style={[styles.label, { color: contentColor }]}>
                {label}
              </Text>
            ) : null}
          </View>
        );
      }}
    </Pressable>
  );
}

interface Props {
  item: BaseItemDto;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onToggleWatched: () => void;
  /** Omitted (rather than passed as a no-op) when the item has no local trailer - see
   * `item.LocalTrailerCount` at each call site. */
  onPlayTrailer?: () => void;
  /** Extra buttons (e.g. Shuffle on Series/Collection) rendered between Play and the toggles. */
  extra?: React.ReactNode;
  /** See `ItemRow`'s `autoFocus` doc - false when some other element on the same page (e.g. an
   * episode row) is the intended initial focus target instead of this Play button. */
  autoFocus?: boolean;
}

/** Play/Resume + trailer/favorite/watched toggles, shared across every detail page
 * (`ExpandablePlayButtons`). */
export function DetailActionButtons({
  item,
  onPlay,
  onToggleFavorite,
  onToggleWatched,
  onPlayTrailer,
  extra,
  autoFocus = true,
}: Props) {
  const resumeTicks = item.UserData?.PlaybackPositionTicks ?? 0;

  return (
    <View style={styles.row}>
      <ActionButton
        icon="play-arrow"
        label={resumeTicks > 0 ? 'Resume' : 'Play'}
        hasTVPreferredFocus={autoFocus}
        onPress={onPlay}
      />
      {extra}
      {onPlayTrailer ? <ActionButton icon="movie" label="Trailer" onPress={onPlayTrailer} /> : null}
      <ActionButton
        icon={item.UserData?.IsFavorite ? 'favorite' : 'favorite-border'}
        label="Favorite"
        active={item.UserData?.IsFavorite}
        onPress={onToggleFavorite}
      />
      <ActionButton
        icon={item.UserData?.Played ? 'check-circle' : 'check-circle-outline'}
        label={item.UserData?.Played ? 'Mark as Unwatched' : 'Mark as Watched'}
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // minWidth (a floor), not width (a fixed value) - the expanded state below only adds
    // padding/a gap and lets the label's own content push the row wider, rather than trying to
    // *cancel* a fixed width with `width: undefined` merged in after it - that didn't reliably
    // override the already-computed layout on-device, leaving the button stuck circular with
    // no room for the label to actually show.
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 11,
  },
  buttonExpanded: {
    paddingHorizontal: 16,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
