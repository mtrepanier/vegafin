import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { KeplerVideoView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { MediaStreamType } from '@jellyfin/sdk/lib/generated-client/models/media-stream-type';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import { useTheme } from '../../theme/ThemeContext';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { fetchItem, fetchPlaylistItems } from '../../services/jellyfin/detail';
import {
  negotiatePlayback,
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStopped,
  type PlaybackSource,
} from '../../services/jellyfin/playback';
import type { RootStackParamList } from '../../navigation/types';

const PROGRESS_REPORT_INTERVAL_MS = 5000;

interface PlaybackBodyProps {
  itemId: string;
  initialPositionMs: number;
  forceTranscoding?: boolean;
  onEnded: () => void;
  onExit: () => void;
}

/**
 * Shared player body for both `PlaybackScreen` and `PlaybackListScreen` - owns the
 * `VideoPlayer` instance, PlaybackInfo negotiation, and progress reporting lifecycle (mirrors
 * `PlaybackViewModel`/`TrackActivityPlaybackListener.kt`). Relies on `KeplerVideoView`'s native
 * `showControls`/`showCaptions` chrome for play/pause/seek (see the plan's playback spike
 * finding) and layers only what that chrome can't provide: an audio/subtitle track picker.
 */
function PlaybackBody({ itemId, initialPositionMs, forceTranscoding, onEnded, onExit }: PlaybackBodyProps) {
  const { colors } = useTheme();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [title, setTitle] = useState<string | null>(null);
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selection, setSelection] = useState<{ audioStreamIndex?: number; subtitleStreamIndex?: number }>({});

  // Mutable mirrors of the above, read from inside long-lived event-handler closures so those
  // closures never see stale values without needing to be torn down and rebuilt on every
  // state change (which would mean removing/re-adding native event listeners constantly).
  const sourceRef = useRef<PlaybackSource | null>(null);
  const positionMsRef = useRef(initialPositionMs);
  const isPausedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    fetchItem(userId, itemId).then((item) => setTitle(item.Name ?? null));
  }, [userId, itemId]);

  const load = useCallback(
    async (activePlayer: VideoPlayer, opts: { audioStreamIndex?: number; subtitleStreamIndex?: number; seekMs: number }) => {
      if (!userId) {
        return;
      }
      const nextSource = await negotiatePlayback(userId, itemId, {
        forceTranscoding,
        positionMs: opts.seekMs,
        audioStreamIndex: opts.audioStreamIndex,
        subtitleStreamIndex: opts.subtitleStreamIndex,
      });
      sourceRef.current = nextSource;
      setSource(nextSource);
      activePlayer.src = nextSource.url;
      activePlayer.autoplay = true;
      if (nextSource.playMethod === PlayMethod.DirectPlay && opts.seekMs > 0) {
        const seekOnce = () => {
          activePlayer.currentTime = opts.seekMs / 1000;
          activePlayer.removeEventListener('loadedmetadata', seekOnce);
        };
        activePlayer.addEventListener('loadedmetadata', seekOnce);
      }
    },
    [userId, itemId, forceTranscoding],
  );

  // Set up the player once per item; teardown reports playback-stopped and releases the player.
  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    const activePlayer = new VideoPlayer();
    sourceRef.current = null;
    positionMsRef.current = initialPositionMs;
    isPausedRef.current = false;

    const reportProgress = () => {
      const src = sourceRef.current;
      if (!src) return;
      reportPlaybackProgress({
        itemId,
        mediaSourceId: src.mediaSourceId,
        playSessionId: src.playSessionId,
        playMethod: src.playMethod,
        positionMs: positionMsRef.current,
        isPaused: isPausedRef.current,
      }).catch(() => {});
    };

    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let started = false;

    const onTimeUpdate = () => {
      positionMsRef.current = Math.round(activePlayer.currentTime * 1000);
    };
    const onPlay = () => {
      isPausedRef.current = false;
      if (!started) {
        started = true;
        const src = sourceRef.current;
        if (src) {
          reportPlaybackStart({
            itemId,
            mediaSourceId: src.mediaSourceId,
            playSessionId: src.playSessionId,
            playMethod: src.playMethod,
            positionMs: positionMsRef.current,
            isPaused: false,
          }).catch(() => {});
        }
        progressTimer = setInterval(reportProgress, PROGRESS_REPORT_INTERVAL_MS);
      } else {
        reportProgress();
      }
    };
    const onPause = () => {
      isPausedRef.current = true;
      reportProgress();
    };
    const onEndedEvent = () => onEnded();
    const onError = () => {
      const mediaError = activePlayer.error;
      const detail = mediaError ? `(${mediaError.code}) ${mediaError.message}` : null;
      console.error('[VegaFin] playback error', detail, 'src:', sourceRef.current?.url);
      setErrorDetail(detail);
      setError(true);
    };

    activePlayer.addEventListener('timeupdate', onTimeUpdate);
    activePlayer.addEventListener('play', onPlay);
    activePlayer.addEventListener('pause', onPause);
    activePlayer.addEventListener('ended', onEndedEvent);
    activePlayer.addEventListener('error', onError);

    activePlayer
      .initialize()
      .then(() => {
        if (cancelled) return;
        setPlayer(activePlayer);
        return load(activePlayer, { seekMs: initialPositionMs });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      if (progressTimer) clearInterval(progressTimer);
      activePlayer.removeEventListener('timeupdate', onTimeUpdate);
      activePlayer.removeEventListener('play', onPlay);
      activePlayer.removeEventListener('pause', onPause);
      activePlayer.removeEventListener('ended', onEndedEvent);
      activePlayer.removeEventListener('error', onError);

      const src = sourceRef.current;
      if (src) {
        reportPlaybackStopped({
          itemId,
          mediaSourceId: src.mediaSourceId,
          playSessionId: src.playSessionId,
          positionMs: positionMsRef.current,
        }).catch(() => {});
      }
      activePlayer.pause();
      activePlayer.deinitialize().catch(() => {});
      setPlayer(null);
      setSource(null);
    };
    // Reload only when the item itself changes - `load` closes over `forceTranscoding` for the
    // initial call, later calls happen explicitly from the track picker via `selectTrack`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, itemId, initialPositionMs]);

  const audioTracks = useMemo(
    () => source?.mediaStreams.filter((s) => s.Type === MediaStreamType.Audio) ?? [],
    [source],
  );
  const subtitleTracks = useMemo(
    () => source?.mediaStreams.filter((s) => s.Type === MediaStreamType.Subtitle) ?? [],
    [source],
  );

  const selectTrack = async (next: { audioStreamIndex?: number; subtitleStreamIndex?: number }) => {
    if (!player) {
      return;
    }
    const merged = { ...selection, ...next };
    setSelection(merged);
    setPickerOpen(false);
    await load(player, { ...merged, seekMs: positionMsRef.current });
  };

  if (!userId) {
    return null;
  }

  return (
    <View style={styles.container}>
      {player ? (
        <KeplerVideoView videoPlayer={player} showControls showCaptions scalingmode="fit" style={StyleSheet.absoluteFill} />
      ) : null}

      {!source && !error ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {error ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.onBackground }}>Playback failed.</Text>
          {errorDetail ? (
            <Text style={{ color: colors.onSurfaceVariant, marginTop: 4, fontSize: 12 }}>{errorDetail}</Text>
          ) : null}
          <Pressable onPress={onExit} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.primary }}>Back</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.topBar}>
        <Pressable onPress={onExit}>
          {({ focused }: PressableStateCallbackType) => (
            <View style={[styles.iconChip, { backgroundColor: focused ? colors.primaryContainer : 'rgba(0,0,0,0.4)' }]}>
              <Icon name="arrow-back" size={22} color={colors.onBackground} />
            </View>
          )}
        </Pressable>
        {title ? (
          <Text numberOfLines={1} style={[styles.title, { color: colors.onBackground }]}>
            {title}
          </Text>
        ) : null}
        {audioTracks.length > 1 || subtitleTracks.length > 0 ? (
          <Pressable onPress={() => setPickerOpen((v) => !v)}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={[styles.iconChip, { backgroundColor: focused ? colors.primaryContainer : 'rgba(0,0,0,0.4)' }]}>
                <Icon name="closed-caption" size={22} color={colors.onBackground} />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>

      {pickerOpen ? (
        <TrackPicker
          audioTracks={audioTracks}
          subtitleTracks={subtitleTracks}
          selection={selection}
          onSelectAudio={(index) => selectTrack({ audioStreamIndex: index })}
          onSelectSubtitle={(index) => selectTrack({ subtitleStreamIndex: index })}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </View>
  );
}

interface TrackPickerProps {
  audioTracks: MediaStream[];
  subtitleTracks: MediaStream[];
  selection: { audioStreamIndex?: number; subtitleStreamIndex?: number };
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number | undefined) => void;
  onClose: () => void;
}

function TrackPicker({ audioTracks, subtitleTracks, selection, onSelectAudio, onSelectSubtitle, onClose }: TrackPickerProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {audioTracks.length > 0 ? (
        <>
          <Text style={[styles.pickerHeading, { color: colors.onSurfaceVariant }]}>Audio</Text>
          {audioTracks.map((track) => (
            <PickerRow
              key={track.Index}
              label={track.DisplayTitle ?? track.Language ?? `Track ${track.Index}`}
              selected={selection.audioStreamIndex === track.Index}
              onPress={() => track.Index != null && onSelectAudio(track.Index)}
            />
          ))}
        </>
      ) : null}
      {subtitleTracks.length > 0 ? (
        <>
          <Text style={[styles.pickerHeading, { color: colors.onSurfaceVariant }]}>Subtitles</Text>
          <PickerRow label="Off" selected={selection.subtitleStreamIndex == null} onPress={() => onSelectSubtitle(undefined)} />
          {subtitleTracks.map((track) => (
            <PickerRow
              key={track.Index}
              label={track.DisplayTitle ?? track.Language ?? `Track ${track.Index}`}
              selected={selection.subtitleStreamIndex === track.Index}
              onPress={() => track.Index != null && onSelectSubtitle(track.Index)}
            />
          ))}
        </>
      ) : null}
      <Pressable onPress={onClose} style={styles.pickerClose}>
        <Text style={{ color: colors.primary }}>Close</Text>
      </Pressable>
    </View>
  );
}

function PickerRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => (
        <Text
          style={[
            styles.pickerRow,
            {
              color: selected ? colors.primary : colors.onSurface,
              backgroundColor: focused ? colors.primaryContainer : 'transparent',
            },
          ]}
        >
          {selected ? '✓ ' : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ui/playback/PlaybackPage.kt equivalent.
export function PlaybackScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Playback'>>();
  const navigation = useNavigation();
  const { itemId, positionMs, forceTranscoding } = route.params;

  return (
    <PlaybackBody
      itemId={itemId}
      initialPositionMs={positionMs}
      forceTranscoding={forceTranscoding}
      onEnded={() => navigation.goBack()}
      onExit={() => navigation.goBack()}
    />
  );
}

// Play-all/shuffle-all from a Series/Collection - builds a flat playlist and advances through
// it, mirroring PlaylistCreator.kt's consumption by PlaybackViewModel.
export function PlaybackListScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'PlaybackList'>>();
  const navigation = useNavigation();
  const { itemId, startIndex, shuffle, recursive } = route.params;
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [items, setItems] = useState<Array<{ Id?: string | null }> | null>(null);
  const [currentIndex, setCurrentIndex] = useState(startIndex ?? 0);

  useEffect(() => {
    if (!userId) {
      return;
    }
    fetchPlaylistItems(userId, itemId, { recursive, shuffle }).then(setItems);
  }, [userId, itemId, recursive, shuffle]);

  const current = items?.[currentIndex];

  if (!items || !current?.Id) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const goNext = () => {
    if (currentIndex + 1 < items.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.goBack();
    }
  };

  return (
    <PlaybackBody
      key={current.Id}
      itemId={current.Id}
      initialPositionMs={0}
      onEnded={goNext}
      onExit={() => navigation.goBack()}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    position: 'absolute',
    top: 80,
    right: 24,
    minWidth: 240,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  pickerHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  pickerRow: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pickerClose: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
});
