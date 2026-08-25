import React, { useEffect, useRef, useState } from 'react';
import { findNodeHandle, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { FocusGroup } from '../../focus/FocusGroup';
import { useT } from '../../i18n/useTranslation';

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
 * literal white/black) keep the inverted pill theme-aware across this app's 8 palettes.
 *
 * Forwards its ref onto the underlying `Pressable` (a plain host View, not a class instance) so
 * `DetailActionButtons` can hand Play's node handle to a `FocusGroup`'s `destinations` prop. */
const ActionButton = React.forwardRef<View, ActionButtonProps>(function ActionButton(
  { icon, label, active, onPress, hasTVPreferredFocus },
  ref,
) {
  const { colors } = useTheme();
  return (
    <Pressable ref={ref} hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress}>
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
});

interface Props {
  item: BaseItemDto;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onToggleWatched: () => void;
  /** Omitted (rather than passed as a no-op) when the item has no local trailer - see
   * `item.LocalTrailerCount` at each call site. */
  onPlayTrailer?: () => void;
  /** Opens the `RemoteTrailers` picker overlay (`TrailerListOverlay.tsx`) - a separate button
   * from `onPlayTrailer` above, since a local trailer plays directly through this app's own
   * player while `RemoteTrailers` are external links (YouTube, etc.) with no single obvious one
   * to play, so they get a list to choose from instead. Omitted when the item has no
   * `RemoteTrailers` - see `item.RemoteTrailers` at each call site. */
  onOpenTrailers?: () => void;
  /** Extra buttons (e.g. Shuffle on Series/Collection) rendered between Play and the toggles. */
  extra?: React.ReactNode;
  /** See `ItemRow`'s `autoFocus` doc - false when some other element on the same page (e.g. an
   * episode row) is the intended initial focus target instead of this Play button. Only controls
   * whether Play *proactively claims* the page's initial focus (`hasTVPreferredFocus`) - it does
   * not affect where D-pad navigation *into* this row from elsewhere lands, which is always Play
   * regardless (see the `destinations` comment below). */
  autoFocus?: boolean;
}

/** Play/Resume + trailer/favorite/watched toggles, shared across every detail page
 * (`ExpandablePlayButtons`).
 *
 * The row is wrapped in a `FocusGroup` with `destinations` pointed at Play, so any D-pad entry
 * into this row - from the episode row above on `SeriesOverviewScreen.tsx`, or from anywhere else
 * - lands on Play specifically, not whichever button the platform judges spatially nearest
 * (rightmost/Watched, with nothing else in the row claiming it). This is independent from
 * `autoFocus`/`hasTVPreferredFocus` above deliberately: an earlier attempt made Play claim
 * `hasTVPreferredFocus` instead (even delayed via a timer past mount) and it reliably *stole* the
 * page's initial focus away from the episode row that's supposed to have it - `hasTVPreferredFocus`
 * turning true apparently does yank focus on this platform, contradicting the assumption the delay
 * was based on. `destinations` doesn't have that failure mode: it's a passive "if this group is
 * ever entered, land here" rule, not a proactive claim, so it can point at Play unconditionally
 * without any risk of grabbing focus away from wherever it already is. */
export function DetailActionButtons({
  item,
  onPlay,
  onToggleFavorite,
  onToggleWatched,
  onPlayTrailer,
  onOpenTrailers,
  extra,
  autoFocus = true,
}: Props) {
  const t = useT();
  const resumeTicks = item.UserData?.PlaybackPositionTicks ?? 0;

  const playRef = useRef<View>(null);
  // Node handle, not the raw ref - `destinations`' type accepts a `number` handle or a class
  // component instance, and Pressable's forwarded ref resolves to a plain host View instance,
  // not a class instance, so `findNodeHandle` is what actually satisfies it. Populated a render
  // after mount, once the ref has attached - `destinations` is a normal reactive prop, so the
  // group picks it up as soon as this state update lands.
  const [playHandle, setPlayHandle] = useState<number | null>(null);
  useEffect(() => {
    setPlayHandle(findNodeHandle(playRef.current));
  }, []);

  return (
    <FocusGroup style={styles.row} destinations={playHandle != null ? [playHandle] : undefined}>
      <ActionButton
        ref={playRef}
        icon="play-arrow"
        label={resumeTicks > 0 ? t('common.resume') : t('common.play')}
        hasTVPreferredFocus={autoFocus}
        onPress={onPlay}
      />
      {extra}
      {onPlayTrailer ? <ActionButton icon="movie" label={t('common.trailer')} onPress={onPlayTrailer} /> : null}
      {onOpenTrailers ? <ActionButton icon="theaters" label={t('common.trailers')} onPress={onOpenTrailers} /> : null}
      <ActionButton
        icon={item.UserData?.IsFavorite ? 'favorite' : 'favorite-border'}
        label={t('common.favorite')}
        active={item.UserData?.IsFavorite}
        onPress={onToggleFavorite}
      />
      <ActionButton
        icon={item.UserData?.Played ? 'check-circle' : 'check-circle-outline'}
        label={item.UserData?.Played ? t('common.markAsUnwatched') : t('common.markAsWatched')}
        active={item.UserData?.Played}
        onPress={onToggleWatched}
      />
    </FocusGroup>
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
