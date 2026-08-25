import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { useKeplerAppStateManager, useTVEventHandler, type HWEvent } from '@amazon-devices/react-native-kepler';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { MediaStreamType } from '@jellyfin/sdk/lib/generated-client/models/media-stream-type';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import { useTheme } from '../../theme/ThemeContext';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { useAppSettings } from '../../services/storage/AppSettingsContext';
import { fetchItem, fetchPlaylistItems } from '../../services/jellyfin/detail';
import {
  negotiatePlayback,
  reportPlaybackProgress,
  reportPlaybackStart,
  reportPlaybackStopped,
  type PlaybackSource,
} from '../../services/jellyfin/playback';
import { unloadPlayer } from '../../w3cmedia/playerLifecycle';
import { ShakaPlayer } from '../../w3cmedia/shakaplayer/ShakaPlayer';
import type { RootStackParamList } from '../../navigation/types';

const PROGRESS_REPORT_INTERVAL_MS = 5000;
/** Vega delivers both key phases of one physical press (down + up, plus for some keys a
 * distinct "_up" eventType), so a naive switch on eventType fires every command twice.
 * De-duping on the normalized type within this window collapses that back to one action. */
const KEY_EVENT_DEDUPE_MS = 350;
const SHAKA_LOAD_TIMEOUT_MS = 20000;
// Skip-seconds and the controls auto-hide delay used to be fixed here (30/10/5) - now read
// from AppSettings (Settings screen's Playback section) instead, with defaultAppSettings()
// carrying forward these exact same numbers so nobody's actual playback behavior changed the
// day that setting screen was added.

/** negotiatePlayback always transcodes to HLS, so this is effectively always true - kept as an
 * explicit check (rather than assumed) for parity with AmbientFlare/astra-tv, a separate
 * Jellyfin-for-Vega client tested on real Fire TV hardware, in case a non-adaptive source URL
 * is ever returned again. */
function isAdaptiveStream(url: string): boolean {
  return url.includes('.m3u8') || url.includes('.mpd');
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const total = Math.floor(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const secondsStr = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secondsStr}` : `${minutes}:${secondsStr}`;
}

interface PlaybackBodyProps {
  itemId: string;
  initialPositionMs: number;
  onEnded: () => void;
  onExit: () => void;
}

/**
 * Shared player body for both `PlaybackScreen` and `PlaybackListScreen` - owns the
 * `VideoPlayer` instance, PlaybackInfo negotiation, and progress reporting lifecycle (mirrors
 * `PlaybackViewModel`/`TrackActivityPlaybackListener.kt`).
 *
 * Uses `KeplerVideoSurfaceView`'s manual surface-handle handshake (the w3cmedia README's
 * "pre-buffering mode") rather than the higher-level `KeplerVideoView` wrapper. That wrapper's
 * built-in `showControls` chrome never routed hardware remote presses to the player -
 * play/pause, skip forward/back, and the D-pad all did nothing - and didn't reliably guarantee
 * its surface existed before playback started. This architecture, including the TV-event
 * handling below, is confirmed working end-to-end against AmbientFlare/astra-tv, a separate
 * Jellyfin-for-Vega client tested on real Fire TV hardware.
 */
function PlaybackBody({ itemId, initialPositionMs, onEnded, onExit }: PlaybackBodyProps) {
  const { colors } = useTheme();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const keplerAppStateManager = useKeplerAppStateManager();
  const { hideControlsAfterSec, skipForwardSec, skipBackwardSec } = useAppSettings();

  const [title, setTitle] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selection, setSelection] = useState<{ audioStreamIndex?: number; subtitleStreamIndex?: number }>({});
  const [paused, setPaused] = useState(true);
  const [positionSec, setPositionSec] = useState(initialPositionMs / 1000);
  const [durationSec, setDurationSec] = useState(0);
  // Surfaces 'waiting'/'stalled' as a visible "Buffering..." indicator - transcoded HLS
  // rebuffers on seek and on bitrate-limited connections, and silence there reads as a freeze.
  const [statusText, setStatusText] = useState<string | null>('Preparing playback...');
  const [showControls, setShowControls] = useState(true);

  // Mutable mirrors of the above, read from inside long-lived event-handler closures so those
  // closures never see stale values without needing to be torn down and rebuilt on every
  // state change (which would mean removing/re-adding native event listeners constantly).
  const playerRef = useRef<VideoPlayer | null>(null);
  const shakaPlayerRef = useRef<ShakaPlayer | null>(null);
  const surfaceHandleRef = useRef<string | null>(null);
  const sourceRef = useRef<PlaybackSource | null>(null);
  const positionMsRef = useRef(initialPositionMs);
  const isPausedRef = useRef(true);
  const startedRef = useRef(false);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // KeplerVideoSurfaceView's onSurfaceViewCreated isn't guaranteed to fire only once (observed
  // in AmbientFlare/astra-tv, a separate Jellyfin-for-Vega client tested on real Fire TV
  // hardware); a second firing must tear down the first player rather than let two players
  // both attach to the same surface as writer. Every listener below checks isCurrentPlayer()
  // so a stale, replaced player's late events can't corrupt state for the current one.
  const playbackGenerationRef = useRef(0);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsHideTimer();
    controlsHideTimerRef.current = setTimeout(() => {
      // Don't hide while paused - the paused frame plus a vanished play/pause icon reads as a
      // stuck screen, matching AmbientFlare/astra-tv (a separate Jellyfin-for-Vega client tested
      // on real Fire TV hardware).
      if (!playerRef.current?.paused) {
        setShowControls(false);
      }
    }, hideControlsAfterSec * 1000);
  }, [clearControlsHideTimer, hideControlsAfterSec]);

  const revealControls = useCallback(
    (autoHide = true) => {
      setShowControls(true);
      if (autoHide) {
        scheduleControlsHide();
      } else {
        clearControlsHideTimer();
      }
    },
    [clearControlsHideTimer, scheduleControlsHide],
  );

  useEffect(() => clearControlsHideTimer, [clearControlsHideTimer]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    fetchItem(userId, itemId).then((item) => setTitle(item.Name ?? null));
  }, [userId, itemId]);

  const reportProgress = useCallback(() => {
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
  }, [itemId]);

  const unloadAdaptivePlayer = useCallback(async () => {
    await unloadPlayer(shakaPlayerRef);
  }, []);

  // Hands the negotiated source to the right engine: Shaka (MSE-based, matching
  // AmbientFlare/astra-tv - a separate Jellyfin-for-Vega client tested on real Fire TV
  // hardware) for adaptive HLS/DASH, or a plain `src` assignment otherwise. Since
  // negotiatePlayback always transcodes to HLS now, this is effectively always the Shaka path.
  const loadVideoSource = useCallback(
    async (activePlayer: VideoPlayer, nextSource: PlaybackSource, startTimeSeconds: number) => {
      if (!isAdaptiveStream(nextSource.url)) {
        await unloadAdaptivePlayer();
        activePlayer.src = nextSource.url;
        activePlayer.load();
        return;
      }

      const settings = {
        secure: nextSource.url.startsWith('https://'),
        abrEnabled: false,
        abrMaxWidth: 3840,
        abrMaxHeight: 2160,
      };

      await unloadAdaptivePlayer();
      const shakaPlayer = new ShakaPlayer(activePlayer, settings);
      shakaPlayerRef.current = shakaPlayer;
      try {
        // Surfaced directly in the UI rather than relied on via logs: Shaka is extremely
        // chatty (per-request/response filter logs, polyfill logs), and on this platform
        // systemd-journald rate-limits and silently drops log bursts - observed dropping
        // hundreds of lines mid-load, which made log-based diagnosis unreliable. A timeout
        // that's visible on screen doesn't depend on any log line surviving that limiter.
        await Promise.race([
          shakaPlayer.load(
            {
              uri: nextSource.url,
              format: nextSource.url.includes('.mpd') ? 'DASH' : 'HLS',
              secure: settings.secure,
              drm_scheme: '',
              drm_license_uri: '',
              startTime: startTimeSeconds,
            },
            false,
          ),
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error(`Shaka load timed out after ${SHAKA_LOAD_TIMEOUT_MS}ms`)), SHAKA_LOAD_TIMEOUT_MS);
          }),
        ]);
      } catch (loadError) {
        // Shaka rejects with shaka.util.Error, which is not an Error instance - without this
        // it surfaces as a blank "Playback failed." with no diagnostic trail.
        const shakaError = loadError as { code?: number; category?: number; severity?: number };
        throw loadError instanceof Error
          ? loadError
          : new Error(`Stream engine error ${shakaError?.code ?? 'unknown'} (category ${shakaError?.category ?? '?'})`);
      }
    },
    [unloadAdaptivePlayer],
  );

  const load = useCallback(
    async (activePlayer: VideoPlayer, opts: { audioStreamIndex?: number; subtitleStreamIndex?: number; seekMs: number }) => {
      if (!userId) {
        return;
      }
      const nextSource = await negotiatePlayback(userId, itemId, {
        positionMs: opts.seekMs,
        audioStreamIndex: opts.audioStreamIndex,
        subtitleStreamIndex: opts.subtitleStreamIndex,
      });
      sourceRef.current = nextSource;
      setSource(nextSource);
      setStatusText(`Starting video... (attempt ${playbackGenerationRef.current})`);
      await loadVideoSource(activePlayer, nextSource, opts.seekMs / 1000);
      activePlayer.play();
      // Reported eagerly rather than from a 'play'/'playing' event: that event isn't
      // reliably delivered on every platform build, which would otherwise leave the UI stuck
      // showing "paused" and playback-start/progress never reported even while video plays.
      isPausedRef.current = false;
      setPaused(false);
      if (!startedRef.current) {
        startedRef.current = true;
        reportPlaybackStart({
          itemId,
          mediaSourceId: nextSource.mediaSourceId,
          playSessionId: nextSource.playSessionId,
          playMethod: nextSource.playMethod,
          positionMs: positionMsRef.current,
          isPaused: false,
        }).catch(() => {});
        progressTimerRef.current = setInterval(reportProgress, PROGRESS_REPORT_INTERVAL_MS);
      } else {
        reportProgress();
      }
    },
    [userId, itemId, reportProgress, loadVideoSource],
  );

  // Creates (or replaces) the player for the given surface handle. Only ever called once the
  // surface actually exists - setting `src`/calling `play()` any earlier races the decoder's
  // buffer-queue writer attach against the surface's reader registration and fails with
  // "Failed to attach as writer".
  const createPlayer = useCallback(
    async (handle: string): Promise<VideoPlayer | null> => {
      const generation = playbackGenerationRef.current + 1;
      playbackGenerationRef.current = generation;
      const isCurrentPlayer = () => playbackGenerationRef.current === generation;

      const oldPlayer = playerRef.current;
      if (oldPlayer) {
        playerRef.current = null;
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
        await unloadAdaptivePlayer();
        try {
          oldPlayer.pause();
          oldPlayer.clearSurfaceHandle(handle);
        } catch {
          // Best-effort - replacing a stale player, not a clean exit.
        }
        await oldPlayer.deinitialize().catch(() => {});
      }

      sourceRef.current = null;
      positionMsRef.current = initialPositionMs;
      isPausedRef.current = true;
      startedRef.current = false;
      setError(false);
      setErrorDetail(null);
      setPaused(true);
      setPositionSec(initialPositionMs / 1000);
      setDurationSec(0);
      // The generation number is shown so a re-fired onSurfaceViewCreated (KeplerVideoSurfaceView
      // isn't guaranteed to fire it only once) is visible directly on screen - logs are
      // unreliable here (systemd-journald rate-limits and silently drops bursts).
      setStatusText(`Preparing playback... (attempt ${generation})`);
      setReady(false);
      setShowControls(true);
      clearControlsHideTimer();

      const activePlayer = new VideoPlayer();
      try {
        await activePlayer.setMediaControlFocus(keplerAppStateManager.getComponentInstance());
      } catch (mediaControlError) {
        console.warn('[VegaFin] Failed to enable Vega media controls:', mediaControlError);
      }

      try {
        await activePlayer.initialize();
      } catch {
        if (isCurrentPlayer()) setError(true);
        return null;
      }
      if (!isCurrentPlayer() || surfaceHandleRef.current !== handle) {
        // Superseded by a newer surface/player, or the surface was torn down, while
        // initialize() was pending - this player was never registered anywhere, so it's on us
        // to release it.
        await activePlayer.deinitialize().catch(() => {});
        return null;
      }

      const onTimeUpdate = () => {
        if (!isCurrentPlayer()) return;
        positionMsRef.current = Math.round(activePlayer.currentTime * 1000);
        setPositionSec(activePlayer.currentTime);
      };
      const onDurationChange = () => {
        if (!isCurrentPlayer() || !Number.isFinite(activePlayer.duration)) return;
        setDurationSec(activePlayer.duration);
      };
      const onPlaying = () => {
        if (!isCurrentPlayer()) return;
        setPaused(false);
        setStatusText(null);
        scheduleControlsHide();
      };
      const onPause = () => {
        if (!isCurrentPlayer()) return;
        isPausedRef.current = true;
        setPaused(true);
        reportProgress();
        revealControls(false);
      };
      const onWaiting = () => {
        if (!isCurrentPlayer()) return;
        setStatusText('Buffering...');
        revealControls(false);
      };
      const onStalled = () => {
        if (!isCurrentPlayer()) return;
        setStatusText('Playback stalled. Buffering...');
        revealControls(false);
      };
      const onCanPlay = () => {
        if (isCurrentPlayer()) setStatusText(null);
      };
      const onEndedEvent = () => {
        if (isCurrentPlayer()) onEnded();
      };
      const onError = () => {
        if (!isCurrentPlayer()) return;
        const mediaError = activePlayer.error;
        const detail = mediaError ? `(${mediaError.code}) ${mediaError.message}` : null;
        console.error('[VegaFin] playback error', detail, 'src:', sourceRef.current?.url);
        setErrorDetail(detail);
        setStatusText(null);
        setError(true);
      };

      activePlayer.addEventListener('timeupdate', onTimeUpdate);
      activePlayer.addEventListener('durationchange', onDurationChange);
      activePlayer.addEventListener('playing', onPlaying);
      activePlayer.addEventListener('pause', onPause);
      activePlayer.addEventListener('waiting', onWaiting);
      activePlayer.addEventListener('stalled', onStalled);
      activePlayer.addEventListener('canplay', onCanPlay);
      activePlayer.addEventListener('ended', onEndedEvent);
      activePlayer.addEventListener('error', onError);

      activePlayer.setSurfaceHandle(handle);
      activePlayer.autoplay = false;
      playerRef.current = activePlayer;
      setReady(true);
      return activePlayer;
    },
    [
      initialPositionMs,
      keplerAppStateManager,
      onEnded,
      reportProgress,
      unloadAdaptivePlayer,
      clearControlsHideTimer,
      scheduleControlsHide,
      revealControls,
    ],
  );

  const onSurfaceViewCreated = useCallback(
    async (handle: string) => {
      if (!userId) {
        return;
      }
      if (surfaceHandleRef.current === handle) {
        // KeplerVideoSurfaceView isn't guaranteed to fire onSurfaceViewCreated only once per
        // surface (confirmed on-device: the "attempt N" counter in the loading text reaches 2
        // for what's still the same physical surface). Re-running createPlayer for a duplicate
        // firing tears down the in-flight Shaka player while its own load() is still pending,
        // orphaning that promise - the load then hangs forever with no error, confirmed via the
        // UI-visible timeout above (logs are unreliable here - systemd-journald silently drops
        // bursts). A genuinely new surface still gets a genuinely new handle, so this only
        // skips the redundant, self-destructive re-fire.
        return;
      }
      surfaceHandleRef.current = handle;
      try {
        const activePlayer = await createPlayer(handle);
        if (!activePlayer) return;
        await load(activePlayer, { seekMs: initialPositionMs });
      } catch (loadError) {
        setErrorDetail(loadError instanceof Error ? loadError.message : String(loadError));
        setError(true);
      }
    },
    [userId, createPlayer, load, initialPositionMs],
  );

  const onSurfaceViewDestroyed = useCallback(
    (handle: string) => {
      surfaceHandleRef.current = null;
      playbackGenerationRef.current += 1;
      setReady(false);
      setSource(null);
      setStatusText(null);
      clearControlsHideTimer();
      unloadAdaptivePlayer().catch(() => {});

      const activePlayer = playerRef.current;
      if (!activePlayer) {
        return;
      }
      playerRef.current = null;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      const src = sourceRef.current;
      if (src) {
        reportPlaybackStopped({
          itemId,
          mediaSourceId: src.mediaSourceId,
          playSessionId: src.playSessionId,
          positionMs: positionMsRef.current,
        }).catch(() => {});
      }
      try {
        activePlayer.pause();
        activePlayer.clearSurfaceHandle(handle);
      } catch {
        // Best-effort teardown - the surface/player are already going away.
      }
      activePlayer.deinitialize().catch(() => {});
    },
    [itemId, unloadAdaptivePlayer, clearControlsHideTimer],
  );

  // Prefers fastSeek over the plain currentTime setter when available, matching
  // AmbientFlare/astra-tv (a separate Jellyfin-for-Vega client tested on real Fire TV
  // hardware) - also reports the new position immediately rather than waiting for the next
  // 'timeupdate' tick, which can lag visibly during HLS rebuffering.
  const seekBy = useCallback((activePlayer: VideoPlayer, deltaSeconds: number) => {
    const duration = typeof activePlayer.duration === 'number' && Number.isFinite(activePlayer.duration) ? activePlayer.duration : 0;
    const raw = activePlayer.currentTime + deltaSeconds;
    const target = Math.max(0, duration > 0 ? Math.min(duration, raw) : raw);
    const seekable = activePlayer as VideoPlayer & { fastSeek?: (time: number) => void };
    if (typeof seekable.fastSeek === 'function') {
      seekable.fastSeek(target);
    } else {
      activePlayer.currentTime = target;
    }
    positionMsRef.current = Math.round(target * 1000);
    setPositionSec(target);
  }, []);

  // KeplerVideoSurfaceView renders no controls of its own, so all remote input - play/pause,
  // skip forward/back, and the D-pad - is driven from raw TV key events here. Reads playerRef
  // rather than closing over `ready` state so this handler stays stable across renders instead
  // of resubscribing on every state change.
  const lastKeyEventRef = useRef<{ type: string; time: number }>({ type: '', time: 0 });
  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      const activePlayer = playerRef.current;
      if (!activePlayer) {
        return;
      }
      const type = (event.eventType ?? '').replace(/_up$/, '');
      const now = Date.now();
      if (lastKeyEventRef.current.type === type && now - lastKeyEventRef.current.time < KEY_EVENT_DEDUPE_MS) {
        return;
      }
      lastKeyEventRef.current = { type, time: now };

      if (type !== 'back') {
        revealControls(!pickerOpen);
      }

      switch (type) {
        case 'back':
          onExit();
          break;
        case 'play':
        case 'pause':
        case 'playpause':
        case 'playPause':
          // The Vega Virtual Device's remote sends a single "play" eventType for its combined
          // play/pause button, not "playpause" as TVTypes.d.ts's own docstring claims (its
          // actual type union only lists "playpause" too) - confirmed by logging raw HWEvents.
          // Real hardware may use a different string still, hence matching all four aliases.
          if (activePlayer.paused) {
            activePlayer.play();
          } else {
            activePlayer.pause();
          }
          break;
        case 'right':
        case 'forward':
        case 'skip_forward':
          seekBy(activePlayer, skipForwardSec);
          break;
        case 'left':
        case 'rewind':
        case 'skip_backward':
          seekBy(activePlayer, -skipBackwardSec);
          break;
        default:
          break;
      }
    },
    [onExit, seekBy, revealControls, pickerOpen, skipForwardSec, skipBackwardSec],
  );
  useTVEventHandler(handleTVEvent);

  const audioTracks = useMemo(
    () => source?.mediaStreams.filter((s) => s.Type === MediaStreamType.Audio) ?? [],
    [source],
  );
  const subtitleTracks = useMemo(
    () => source?.mediaStreams.filter((s) => s.Type === MediaStreamType.Subtitle) ?? [],
    [source],
  );

  const selectTrack = async (next: { audioStreamIndex?: number; subtitleStreamIndex?: number }) => {
    const activePlayer = playerRef.current;
    if (!activePlayer) {
      return;
    }
    const merged = { ...selection, ...next };
    setSelection(merged);
    setPickerOpen(false);
    await load(activePlayer, { ...merged, seekMs: positionMsRef.current });
  };

  const togglePlayPause = () => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return;
    if (activePlayer.paused) {
      activePlayer.play();
    } else {
      activePlayer.pause();
    }
  };

  if (!userId) {
    return null;
  }

  const progressPercent = durationSec > 0 ? Math.min(100, Math.max(0, (positionSec / durationSec) * 100)) : 0;
  const iconChipStyle = (focused: boolean) => [
    styles.iconChip,
    { backgroundColor: focused ? colors.primaryContainer : 'rgba(0,0,0,0.4)' },
  ];
  const progressTrackStyle = [styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.3)' }];

  return (
    <View key={itemId} style={styles.container}>
      <KeplerVideoSurfaceView
        onSurfaceViewCreated={onSurfaceViewCreated}
        onSurfaceViewDestroyed={onSurfaceViewDestroyed}
        scalingmode="fit"
        style={StyleSheet.absoluteFill}
      />

      {!error && statusText ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.statusText, { color: colors.onBackground }]}>{statusText}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.onBackground }}>Playback failed.</Text>
          {errorDetail ? (
            <Text style={[styles.errorDetail, { color: colors.onSurfaceVariant }]}>{errorDetail}</Text>
          ) : null}
          <Pressable onPress={onExit} style={styles.errorBack}>
            <Text style={{ color: colors.primary }}>Back</Text>
          </Pressable>
        </View>
      ) : null}

      {showControls ? (
        <View style={styles.topBar}>
          <Pressable onPress={onExit}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={iconChipStyle(focused)}>
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
                <View style={iconChipStyle(focused)}>
                  <Icon name="closed-caption" size={22} color={colors.onBackground} />
                </View>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showControls && ready && source ? (
        <View style={styles.bottomBar}>
          <Pressable onPress={togglePlayPause}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={iconChipStyle(focused)}>
                <Icon name={paused ? 'play-arrow' : 'pause'} size={22} color={colors.onBackground} />
              </View>
            )}
          </Pressable>
          <Text style={[styles.timeText, { color: colors.onBackground }]}>{formatTime(positionSec)}</Text>
          <View style={progressTrackStyle}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.timeText, { color: colors.onBackground }]}>{formatTime(durationSec)}</Text>
        </View>
      ) : null}

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
      {({ focused }: PressableStateCallbackType) => {
        const rowStyle = [
          styles.pickerRow,
          {
            color: selected ? colors.primary : colors.onSurface,
            backgroundColor: focused ? colors.primaryContainer : 'transparent',
          },
        ];
        return (
          <Text style={rowStyle}>
            {selected ? '✓ ' : ''}
            {label}
          </Text>
        );
      }}
    </Pressable>
  );
}

// ui/playback/PlaybackPage.kt equivalent.
export function PlaybackScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Playback'>>();
  const navigation = useNavigation();
  const { itemId, positionMs } = route.params;

  return (
    <PlaybackBody
      itemId={itemId}
      initialPositionMs={positionMs}
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
  statusText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorDetail: {
    marginTop: 4,
    fontSize: 12,
  },
  errorBack: {
    marginTop: 12,
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
  bottomBar: {
    position: 'absolute',
    bottom: 24,
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
  timeText: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
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
