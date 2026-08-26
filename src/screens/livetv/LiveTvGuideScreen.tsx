import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type PressableStateCallbackType,
} from 'react-native';
import { useNavigation } from '@amazon-devices/react-navigation__native';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { useAppSettings } from '../../services/storage/AppSettingsContext';
import { Clock } from '../../components/Clock';
import {
  fetchLiveTvChannels,
  fetchLiveTvGuide,
  layoutGuideCells,
  guideTimeLabels,
  isProgramAiring,
  type ChannelGuide,
} from '../../services/jellyfin/liveTv';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { scrollOffsetToReveal } from '../../util/scroll';
import { formatClockTime } from '../../util/format';
import { useT } from '../../i18n/useTranslation';
import { useLanguage } from '../../i18n/useLanguage';
import type { AppNavigationProp } from '../../navigation/types';

/** How far ahead the guide fetches program data for - a fixed window rather than paged/
 * scrollable time navigation (see this screen's own README section for the fuller reasoning). */
const GUIDE_WINDOW_HOURS = 4;
const CHANNEL_COL_WIDTH = 160;
const ROW_HEIGHT = 72;
const TIME_HEADER_HEIGHT = 32;
const HOUR_WIDTH = 240;
const MINUTE_WIDTH = HOUR_WIDTH / 60;
const MIN_CELL_WIDTH = 70;
const TIME_LABEL_INTERVAL_MIN = 30;
const TIMELINE_WIDTH = GUIDE_WINDOW_HOURS * HOUR_WIDTH;

function ChannelLabel({
  name,
  number,
  logoUri,
  hasTVPreferredFocus,
  onFocus,
  onPress,
}: {
  name: string;
  number?: string;
  logoUri?: string;
  hasTVPreferredFocus?: boolean;
  onFocus: () => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onFocus={onFocus} onPress={onPress} style={styles.channelLabelWrap}>
      {({ focused }: PressableStateCallbackType) => {
        const labelStyle = [
          styles.channelLabel,
          { backgroundColor: focused ? colors.primaryContainer : colors.surface, borderColor: focused ? colors.border : 'transparent' },
        ];
        const numberStyle = [styles.channelNumber, { color: focused ? colors.onPrimaryContainer : colors.onSurfaceVariant }];
        const nameStyle = [styles.channelName, { color: focused ? colors.onPrimaryContainer : colors.onSurface }];
        return (
          <View style={labelStyle}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.channelLogo} resizeMode="contain" />
            ) : (
              <Text numberOfLines={1} style={numberStyle}>
                {number}
              </Text>
            )}
            <Text numberOfLines={1} style={nameStyle}>
              {name}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

function ProgramCell({
  name,
  live,
  width,
  hasTVPreferredFocus,
  onFocus,
  onPress,
}: {
  name: string;
  live: boolean;
  width: number;
  hasTVPreferredFocus?: boolean;
  onFocus: () => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onFocus={onFocus} onPress={onPress} style={[styles.cellWrap, { width }]}>
      {({ focused }: PressableStateCallbackType) => {
        const cellStyle = [
          styles.cell,
          { backgroundColor: focused ? colors.primaryContainer : colors.surfaceVariant, borderColor: focused ? colors.border : 'transparent' },
        ];
        const liveTagStyle = [styles.liveTag, { color: focused ? colors.onPrimaryContainer : colors.primary }];
        const nameStyle = [styles.programName, { color: focused ? colors.onPrimaryContainer : colors.onSurface }];
        return (
          <View style={cellStyle}>
            {live ? <Text style={liveTagStyle}>{t('livetv.onNow')}</Text> : null}
            <Text numberOfLines={2} style={nameStyle}>
              {name}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

/**
 * A real synchronized EPG grid - channels pinned in a fixed left column, a shared time header
 * pinned at top, and every channel's programs laid out as proportional-width cells aligned to
 * that one timeline, all three scrolling together. Replaces an earlier version that rendered
 * each channel as its own independently-scrolling `ItemRow` - functional, but it didn't read as
 * a "guide" at all once actually seen on-device (confirmed by screenshot comparison against
 * real Jellyfin clients): no shared timeline, no proportional cell widths, nothing scrolling in
 * sync. See this screen's own section in the README for the full reasoning and the specific
 * risk this rewrite carries.
 *
 * No `FlatList`/`focusItemAlignment` here - those solve exactly one scroll axis for a single
 * uniform list, not a two-axis grid where three separately-rendered pieces (header, channel
 * column, body) must all move together. Scrolling is entirely programmatic instead: each cell's
 * `onFocus` computes whether it's already fully visible (`scrollOffsetToReveal`) and, if not,
 * scrolls the body plus whichever of the header/channel-column pieces shares that axis to match.
 * All three `ScrollView`s are `scrollEnabled={false}` - there's no touch/drag input on this
 * platform to disable, but it also guarantees nothing here depends on native scroll-follows-
 * focus behavior actually existing, which is not something to assume works without seeing it
 * confirmed on this platform (this project's own focus/scroll history has repeatedly found
 * exactly that kind of assumption wrong).
 */
export function LiveTvGuideScreen() {
  const { colors } = useTheme();
  const t = useT();
  const language = useLanguage();
  const navigation = useNavigation<AppNavigationProp<'LiveTvGuide'>>();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const { showClock } = useAppSettings();

  const [guide, setGuide] = useState<ChannelGuide[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideWindow, setGuideWindow] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchLiveTvChannels(userId).then(async (channels) => {
      if (cancelled) return;
      const start = new Date();
      const end = new Date(start.getTime() + GUIDE_WINDOW_HOURS * 60 * 60 * 1000);
      const result = await fetchLiveTvGuide(userId, channels, start, end);
      if (!cancelled) {
        setGuide(result);
        setGuideWindow({ start, end });
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // The body is the "driver": scrolled programmatically on both axes from a focused cell, with
  // the header (X) and channel column (Y) mirrored to match right after. Refs, not state - a
  // scroll offset changing shouldn't itself trigger a re-render, only the imperative scrollTo
  // calls below matter.
  const headerScrollRef = useRef<ScrollView>(null);
  const channelColumnScrollRef = useRef<ScrollView>(null);
  const bodyVerticalRef = useRef<ScrollView>(null);
  const bodyHorizontalRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const scrollYRef = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const onGridLayout = (e: LayoutChangeEvent) => setViewportHeight(e.nativeEvent.layout.height);
  const onTimelineViewportLayout = (e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width);

  const revealRow = (rowIndex: number) => {
    const targetTop = rowIndex * ROW_HEIGHT;
    const newY = scrollOffsetToReveal(scrollYRef.current, targetTop, targetTop + ROW_HEIGHT, viewportHeight);
    if (newY != null) {
      scrollYRef.current = newY;
      bodyVerticalRef.current?.scrollTo({ y: newY, animated: true });
      channelColumnScrollRef.current?.scrollTo({ y: newY, animated: true });
    }
  };

  const revealCell = (rowIndex: number, cellLeft: number, cellWidth: number) => {
    revealRow(rowIndex);
    const newX = scrollOffsetToReveal(scrollXRef.current, cellLeft, cellLeft + cellWidth, viewportWidth);
    if (newX != null) {
      scrollXRef.current = newX;
      bodyHorizontalRef.current?.scrollTo({ x: newX, animated: true });
      headerScrollRef.current?.scrollTo({ x: newX, animated: true });
    }
  };

  const onBodyVerticalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = e.nativeEvent.contentOffset.y;
  };
  const onBodyHorizontalScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollXRef.current = e.nativeEvent.contentOffset.x;
  };

  if (!userId) {
    return null;
  }

  const tuneIn = (channelId?: string | null) => {
    if (channelId) {
      navigation.navigate('LiveTvPlayback', { channelId });
    }
  };

  const now = new Date();
  const timeLabels = guideWindow ? guideTimeLabels(guideWindow.start, guideWindow.end, TIME_LABEL_INTERVAL_MIN) : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.onBackground }]}>{t('livetv.guide')}</Text>
        {showClock ? <Clock /> : null}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={styles.status} /> : null}
      {!loading && guide?.length === 0 ? <Text style={[styles.status, { color: colors.onSurfaceVariant }]}>{t('livetv.noChannels')}</Text> : null}

      {!loading && guide && guide.length > 0 && guideWindow ? (
        <>
          <View style={styles.headerRow}>
            <View style={{ width: CHANNEL_COL_WIDTH }} />
            <View style={styles.timelineViewport} onLayout={onTimelineViewportLayout}>
              {viewportWidth > 0 ? (
                <ScrollView ref={headerScrollRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} style={{ width: viewportWidth }}>
                  <View style={[styles.timeHeader, { width: TIMELINE_WIDTH }]}>
                    {timeLabels.map((label, index) => (
                      <Text
                        key={label.toISOString()}
                        style={[styles.timeLabel, { color: colors.onSurfaceVariant, left: index * TIME_LABEL_INTERVAL_MIN * MINUTE_WIDTH }]}
                      >
                        {formatClockTime(label, language)}
                      </Text>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>

          <View style={styles.grid} onLayout={onGridLayout}>
            <ScrollView ref={channelColumnScrollRef} scrollEnabled={false} showsVerticalScrollIndicator={false} style={{ width: CHANNEL_COL_WIDTH }}>
              {guide.map((row, rowIndex) => (
                <ChannelLabel
                  key={row.channel.Id}
                  name={row.channel.Name ?? ''}
                  number={row.channel.Number ?? undefined}
                  logoUri={primaryImageUrl(row.channel, CHANNEL_COL_WIDTH)}
                  hasTVPreferredFocus={false}
                  onFocus={() => revealRow(rowIndex)}
                  onPress={() => tuneIn(row.channel.Id)}
                />
              ))}
            </ScrollView>

            {/* Reuses the header's own measured `viewportWidth` rather than measuring this
                region separately - two independent `flex: 1` resolutions were how the previous
                version's header and body ended up different widths, visibly desyncing the two
                (confirmed on-device: program cells rendered ~700px away from the time labels
                actually above them). One measurement, shared, removes the chance of that. */}
            {viewportWidth > 0 ? (
              <ScrollView
                ref={bodyVerticalRef}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                onScroll={onBodyVerticalScroll}
                scrollEventThrottle={16}
                style={{ width: viewportWidth }}
              >
                <ScrollView
                  ref={bodyHorizontalRef}
                  horizontal
                  scrollEnabled={false}
                  onScroll={onBodyHorizontalScroll}
                  scrollEventThrottle={16}
                  style={{ width: viewportWidth }}
                >
                  <View style={{ width: TIMELINE_WIDTH }}>
                    {guide.map((row, rowIndex) => {
                      const cells = layoutGuideCells(row.programs, guideWindow.start, guideWindow.end, MINUTE_WIDTH, MIN_CELL_WIDTH);
                      return (
                        <View key={row.channel.Id} style={styles.programRow}>
                          {cells.length > 0 ? (
                            cells.map((cell, cellIndex) => (
                              <View key={cell.program.Id ?? cellIndex} style={[styles.cellPositioner, { left: cell.left, width: cell.width }]}>
                                <ProgramCell
                                  name={cell.program.Name ?? ''}
                                  live={isProgramAiring(cell.program, now)}
                                  width={cell.width}
                                  hasTVPreferredFocus={rowIndex === 0 && cellIndex === 0}
                                  onFocus={() => revealCell(rowIndex, cell.left, cell.width)}
                                  onPress={() => tuneIn(row.channel.Id)}
                                />
                              </View>
                            ))
                          ) : (
                            <View style={styles.noDataCellPositioner}>
                              <ProgramCell
                                name={t('livetv.noGuideData')}
                                live={false}
                                width={MIN_CELL_WIDTH * 2}
                                hasTVPreferredFocus={rowIndex === 0}
                                onFocus={() => revealRow(rowIndex)}
                                onPress={() => tuneIn(row.channel.Id)}
                              />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </ScrollView>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 64,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: layout.contentPadding,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  status: {
    marginHorizontal: layout.contentPadding,
  },
  headerRow: {
    flexDirection: 'row',
    height: TIME_HEADER_HEIGHT,
    marginLeft: layout.contentPadding,
  },
  timelineViewport: {
    flex: 1,
  },
  timeHeader: {
    height: TIME_HEADER_HEIGHT,
  },
  timeLabel: {
    position: 'absolute',
    top: 0,
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    marginLeft: layout.contentPadding,
  },
  // The Pressable itself needs the explicit width, not just the View inside it - without it,
  // `channelLogo`'s `width: '100%'` had no concrete parent width to resolve against (the
  // enclosing vertical ScrollView's own `width` only constrains its viewport, not its children's
  // layout), so a wide logo image fell back to its full natural pixel size instead of being
  // scaled to fit - confirmed on-device as a real bug: channel logos rendered oversized and
  // bled past the column into the timeline area instead of staying inside their row.
  channelLabelWrap: {
    width: CHANNEL_COL_WIDTH - 8,
  },
  channelLabel: {
    width: '100%',
    height: ROW_HEIGHT,
    borderWidth: layout.focusBorderWidth,
    borderRadius: 6,
    marginRight: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  channelLogo: {
    width: '100%',
    height: 24,
    alignSelf: 'center',
  },
  channelNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  channelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  programRow: {
    height: ROW_HEIGHT,
    position: 'relative',
  },
  cellPositioner: {
    position: 'absolute',
    top: 0,
    height: ROW_HEIGHT,
  },
  noDataCellPositioner: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: ROW_HEIGHT,
    width: MIN_CELL_WIDTH * 2,
  },
  cellWrap: {
    height: ROW_HEIGHT,
    paddingRight: 6,
    paddingVertical: 4,
  },
  cell: {
    flex: 1,
    borderWidth: layout.focusBorderWidth,
    borderRadius: 6,
    padding: 8,
    gap: 2,
  },
  liveTag: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  programName: {
    fontSize: 13,
    fontWeight: '600',
  },
});
