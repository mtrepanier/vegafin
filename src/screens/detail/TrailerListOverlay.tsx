import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useTVEventHandler, type HWEvent } from '@amazon-devices/react-native-kepler';
import Icon from '../../components/Icon';
import type { MediaUrl } from '@jellyfin/sdk/lib/generated-client/models/media-url';
import { useTheme } from '../../theme/ThemeContext';
import { FocusGroup } from '../../focus/FocusGroup';
import { useT } from '../../i18n/useTranslation';

interface Props {
  trailers: MediaUrl[];
  onClose: () => void;
}

/**
 * Full-screen overlay listing an item's `RemoteTrailers` - external links (YouTube, etc.)
 * Jellyfin doesn't host itself, unlike a local trailer file this app can play through its own
 * Playback route. There's no in-app player for arbitrary web video, so picking one instead opens
 * it through the platform's own URL handler (`Linking.openURL`) - untested on real Fire TV/Vega
 * hardware as of writing, since this is the first thing in this app to hand a URL off to the OS
 * rather than handling it in-app.
 *
 * Mounted/unmounted by its caller's own open/closed state (`MovieDetail.tsx`) rather than using
 * RN's `Modal` - same manual absolute-positioned-overlay approach `PlaybackScreens.tsx`'s
 * `TrackPicker` already uses, no other overlay in this codebase reaches for `Modal`. Closing via
 * the remote's back button only works because this is plain conditional JSX inside the same
 * screen, not a pushed route - a `useTVEventHandler` subscription that only exists while this
 * component is mounted is enough, with nothing else to un-wind at the navigation level.
 */
export function TrailerListOverlay({ trailers, onClose }: Props) {
  const { colors } = useTheme();
  const t = useT();

  useTVEventHandler((event: HWEvent) => {
    const type = (event.eventType ?? '').replace(/_up$/, '');
    if (type === 'back') {
      onClose();
    }
  });

  return (
    <View style={styles.backdrop}>
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{t('common.trailers')}</Text>
        <FocusGroup trapFocusUp trapFocusDown trapFocusLeft trapFocusRight>
          <ScrollView style={styles.list} focusItemAlignment="start">
            {trailers.map((trailer, index) => (
              <Pressable
                key={trailer.Url ?? index}
                hasTVPreferredFocus={index === 0}
                onPress={() => trailer.Url && Linking.openURL(trailer.Url)}
              >
                {({ focused }: PressableStateCallbackType) => {
                  const contentColor = focused ? colors.onPrimary : colors.onSurface;
                  const itemStyle = [styles.item, { backgroundColor: focused ? colors.primary : 'transparent' }];
                  return (
                    <View style={itemStyle}>
                      <Icon name="play-arrow" size={20} color={contentColor} />
                      <Text numberOfLines={1} style={[styles.itemText, { color: contentColor }]}>
                        {trailer.Name ?? t('common.trailerFallback', { number: index + 1 })}
                      </Text>
                    </View>
                  );
                }}
              </Pressable>
            ))}
          </ScrollView>
        </FocusGroup>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    minWidth: 420,
    maxWidth: 600,
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  // A fixed cap, not left to grow with however many trailers an item happens to have - a long
  // RemoteTrailers list pushed the whole panel (and its backdrop) taller than the screen
  // without this, instead of scrolling internally. ~5 rows' worth before it scrolls.
  list: {
    maxHeight: 260,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
