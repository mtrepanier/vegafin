import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { useKeplerAppStateManager, useTVEventHandler, type HWEvent } from '@amazon-devices/react-native-kepler';
import { KeplerVideoSurfaceView, VideoPlayer } from '@amazon-devices/react-native-w3cmedia';
import Icon from '../../components/Icon';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { useCurrentUser } from '../../services/storage/ServerRepositoryContext';
import { useT } from '../../i18n/useTranslation';
import { useLanguage } from '../../i18n/useLanguage';
import { negotiatePlayback, reportPlaybackProgress, reportPlaybackStart, reportPlaybackStopped, closeLiveStream, type PlaybackSource } from '../../services/jellyfin/playback';
import { fetchLiveTvChannels, formatProgramTimeRange } from '../../services/jellyfin/liveTv';
import { unloadPlayer } from '../../w3cmedia/playerLifecycle';
import { ShakaPlayer } from '../../w3cmedia/shakaplayer/ShakaPlayer';
import type { RootStackParamList } from '../../navigation/types';

const PROGRESS_REPORT_INTERVAL_MS = 5000;
const KEY_EVENT_DEDUPE_MS = 350;
const SHAKA_LOAD_TIMEOUT_MS = 20000;

function isAdaptiveStream(url: string): boolean {
  return url.includes('.m3u8') || url.includes('.mpd');
}

interface LiveTvPlayerBodyProps {
  channel: BaseItemDto;
  channels: BaseItemDto[];
  onChangeChannel: (channel: BaseItemDto) => void;
  onExit: () => void;
}

/**
 * Live channel playback - deliberately a separate, much simpler component from
 * `PlaybackScreens.tsx`'s `PlaybackBody`, not a shared/parameterized one. A live channel has no
 * duration, can't be seeked or resumed, has no Next Up/Skip Intro-Outro (those all depend on a
 * finite timeline or per-item segment data neither of which a channel has), and switching
 * channels needs to happen instantly rather than through a "load a new item" flow - trying to
 * thread all of that through `PlaybackBody` as extra conditionals would have made an already
 * long file harder to follow for both cases. What *is* shared: the same low-level primitives
 * (`KeplerVideoSurfaceView`'s manual surface-handle handshake, `VideoPlayer`, `ShakaPlayer`,
 * `negotiatePlayback`, `reportPlayback*`) and the same hard-won lifecycle shape (generation
 * tracking so a stale, superseded player's late events can't corrupt current state; an explicit
 * unmount cleanup as a backup to the native `onSurfaceViewDestroyed` callback, which is not
 * reliably fired - see that file's own comments for how those were originally confirmed on
 * real testing, not just reasoned about).
 */
function LiveTvPlayerBody({ channel, channels, onChangeChannel, onExit }: LiveTvPlayerBodyProps) {
  const { colors } = useTheme();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const keplerAppStateManager = useKeplerAppStateManager();
  const t = useT();
  const language = useLanguage();

  const [ready, setReady] = useState(false);
  const [source, setSource] = useState<PlaybackSource | null>(null);
  const [error, setError] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [statusText, setStatusText] = useState<string | null>(t('player.preparingPlayback'));
  const [showControls, setShowControls] = useState(true);

  const playerRef = useRef<VideoPlayer | null>(null);
  const shakaPlayerRef = useRef<ShakaPlayer | null>(null);
  const surfaceHandleRef = useRef<string | null>(null);
  const sourceRef = useRef<PlaybackSource | null>(null);
  const isPausedRef = useRef(true);
  const startedRef = useRef(false);
  const watchStartedAtRef = useRef(Date.now());
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      if (!playerRef.current?.paused) {
        setShowControls(false);
      }
    }, 5000);
  }, [clearControlsHideTimer]);

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

  // No seekable position for a live stream - "position" reported to the server is just elapsed
  // wall-clock watch time on this channel, the same approximation other Jellyfin clients use
  // for a live session (there's nothing to resume, so this only feeds the server's "now
  // playing" session info, not a saved position).
  const reportProgress = useCallback(() => {
    const src = sourceRef.current;
    if (!src || !channel.Id) return;
    reportPlaybackProgress({
      itemId: channel.Id,
      mediaSourceId: src.mediaSourceId,
      playSessionId: src.playSessionId,
      playMethod: src.playMethod,
      positionMs: Date.now() - watchStartedAtRef.current,
      isPaused: isPausedRef.current,
    }).catch(() => {});
  }, [channel.Id]);

  const unloadAdaptivePlayer = useCallback(async () => {
    await unloadPlayer(shakaPlayerRef);
  }, []);

  const loadVideoSource = useCallback(
    async (activePlayer: VideoPlayer, nextSource: PlaybackSource) => {
      if (!isAdaptiveStream(nextSource.url)) {
        await unloadAdaptivePlayer();
        activePlayer.src = nextSource.url;
        activePlayer.load();
        return;
      }
      const settings = { secure: nextSource.url.startsWith('https://'), abrEnabled: false, abrMaxWidth: 3840, abrMaxHeight: 2160 };
      await unloadAdaptivePlayer();
      const shakaPlayer = new ShakaPlayer(activePlayer, settings);
      shakaPlayerRef.current = shakaPlayer;
      try {
        await Promise.race([
          shakaPlayer.load(
            { uri: nextSource.url, format: nextSource.url.includes('.mpd') ? 'DASH' : 'HLS', secure: settings.secure, drm_scheme: '', drm_license_uri: '', startTime: 0 },
            false,
          ),
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error(t('player.shakaTimeout', { seconds: SHAKA_LOAD_TIMEOUT_MS / 1000 }))), SHAKA_LOAD_TIMEOUT_MS);
          }),
        ]);
      } catch (loadError) {
        const shakaError = loadError as { code?: number; category?: number };
        throw loadError instanceof Error
          ? loadError
          : new Error(t('player.streamEngineError', { code: shakaError?.code ?? 'unknown', category: shakaError?.category ?? '?' }));
      }
    },
    [unloadAdaptivePlayer, t],
  );

  const load = useCallback(
    async (activePlayer: VideoPlayer) => {
      if (!userId || !channel.Id) return;
      const nextSource = await negotiatePlayback(userId, channel.Id, { allowDirectPlayback: true });
      sourceRef.current = nextSource;
      setSource(nextSource);
      setStatusText(t('player.startingVideo'));
      await loadVideoSource(activePlayer, nextSource);
      activePlayer.play();
      isPausedRef.current = false;
      setPaused(false);
      watchStartedAtRef.current = Date.now();
      if (!startedRef.current) {
        startedRef.current = true;
        reportPlaybackStart({
          itemId: channel.Id,
          mediaSourceId: nextSource.mediaSourceId,
          playSessionId: nextSource.playSessionId,
          playMethod: nextSource.playMethod,
          positionMs: 0,
          isPaused: false,
        }).catch(() => {});
        progressTimerRef.current = setInterval(reportProgress, PROGRESS_REPORT_INTERVAL_MS);
      } else {
        reportProgress();
      }
    },
    [userId, channel.Id, reportProgress, loadVideoSource, t],
  );

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
        // Release the previous channel's tuner before opening the next one - a channel switch
        // reaches this branch instead of onSurfaceViewDestroyed/the unmount cleanup below, so
        // without this a fast succession of channel changes would leak one open tuner per
        // switch (see negotiatePlayback's own comment on why opening is required at all).
        if (sourceRef.current?.liveStreamId) {
          closeLiveStream(sourceRef.current.liveStreamId).catch(() => {});
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
      isPausedRef.current = true;
      startedRef.current = false;
      setError(false);
      setErrorDetail(null);
      setPaused(true);
      setStatusText(t('player.preparingPlayback'));
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
        await activePlayer.deinitialize().catch(() => {});
        return null;
      }

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
        setStatusText(t('player.buffering'));
        revealControls(false);
      };
      const onStalled = () => {
        if (!isCurrentPlayer()) return;
        setStatusText(t('player.stalledBuffering'));
        revealControls(false);
      };
      const onCanPlay = () => {
        if (isCurrentPlayer()) setStatusText(null);
      };
      const onError = () => {
        if (!isCurrentPlayer()) return;
        const mediaError = activePlayer.error;
        const detail = mediaError ? `(${mediaError.code}) ${mediaError.message}` : null;
        console.error('[VegaFin] live tv playback error', detail, 'src:', sourceRef.current?.url);
        setErrorDetail(detail);
        setStatusText(null);
        setError(true);
      };

      activePlayer.addEventListener('playing', onPlaying);
      activePlayer.addEventListener('pause', onPause);
      activePlayer.addEventListener('waiting', onWaiting);
      activePlayer.addEventListener('stalled', onStalled);
      activePlayer.addEventListener('canplay', onCanPlay);
      activePlayer.addEventListener('error', onError);

      activePlayer.setSurfaceHandle(handle);
      activePlayer.autoplay = false;
      playerRef.current = activePlayer;
      setReady(true);
      return activePlayer;
    },
    [keplerAppStateManager, reportProgress, unloadAdaptivePlayer, clearControlsHideTimer, scheduleControlsHide, revealControls, t],
  );

  const onSurfaceViewCreated = useCallback(
    async (handle: string) => {
      if (!userId) return;
      if (surfaceHandleRef.current === handle) return;
      surfaceHandleRef.current = handle;
      try {
        const activePlayer = await createPlayer(handle);
        if (!activePlayer) return;
        await load(activePlayer);
      } catch (loadError) {
        setErrorDetail(loadError instanceof Error ? loadError.message : String(loadError));
        setError(true);
      }
    },
    [userId, createPlayer, load],
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
      if (!activePlayer) return;
      playerRef.current = null;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      const src = sourceRef.current;
      if (src && channel.Id) {
        reportPlaybackStopped({
          itemId: channel.Id,
          mediaSourceId: src.mediaSourceId,
          playSessionId: src.playSessionId,
          positionMs: Date.now() - watchStartedAtRef.current,
        }).catch(() => {});
      }
      if (src?.liveStreamId) {
        closeLiveStream(src.liveStreamId).catch(() => {});
      }
      try {
        activePlayer.pause();
        activePlayer.clearSurfaceHandle(handle);
      } catch {
        // Best-effort teardown - the surface/player are already going away.
      }
      activePlayer.deinitialize().catch(() => {});
    },
    [channel.Id, unloadAdaptivePlayer, clearControlsHideTimer],
  );

  // Belt-and-suspenders unmount cleanup - see PlaybackScreens.tsx's identical comment for why
  // onSurfaceViewDestroyed alone isn't reliable enough on its own.
  useEffect(() => {
    return () => {
      const activePlayer = playerRef.current;
      if (!activePlayer) return;
      playerRef.current = null;
      playbackGenerationRef.current += 1;
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      const src = sourceRef.current;
      if (src && channel.Id) {
        reportPlaybackStopped({
          itemId: channel.Id,
          mediaSourceId: src.mediaSourceId,
          playSessionId: src.playSessionId,
          positionMs: Date.now() - watchStartedAtRef.current,
        }).catch(() => {});
      }
      if (src?.liveStreamId) {
        closeLiveStream(src.liveStreamId).catch(() => {});
      }
      try {
        activePlayer.pause();
        if (surfaceHandleRef.current) {
          activePlayer.clearSurfaceHandle(surfaceHandleRef.current);
        }
      } catch {
        // Best-effort - the screen is already gone either way.
      }
      activePlayer.deinitialize().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlayPause = () => {
    const activePlayer = playerRef.current;
    if (!activePlayer) return;
    if (activePlayer.paused) {
      activePlayer.play();
    } else {
      activePlayer.pause();
    }
  };

  const changeChannel = useCallback(
    (direction: 1 | -1) => {
      const index = channels.findIndex((c) => c.Id === channel.Id);
      if (index === -1 || channels.length < 2) return;
      const next = channels[(index + direction + channels.length) % channels.length];
      onChangeChannel(next);
    },
    [channels, channel.Id, onChangeChannel],
  );

  const lastKeyEventRef = useRef<{ type: string; time: number }>({ type: '', time: 0 });
  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      const type = (event.eventType ?? '').replace(/_up$/, '');
      const now = Date.now();
      if (lastKeyEventRef.current.type === type && now - lastKeyEventRef.current.time < KEY_EVENT_DEDUPE_MS) {
        return;
      }
      lastKeyEventRef.current = { type, time: now };

      if (type !== 'back') {
        revealControls(true);
      }

      switch (type) {
        case 'back':
          onExit();
          break;
        case 'play':
        case 'pause':
        case 'playpause':
        case 'playPause':
          togglePlayPause();
          break;
        case 'up':
        case 'channel_up':
          changeChannel(1);
          break;
        case 'down':
        case 'channel_down':
          changeChannel(-1);
          break;
        default:
          break;
      }
    },
    [onExit, revealControls, changeChannel],
  );
  useTVEventHandler(handleTVEvent);

  if (!userId) {
    return null;
  }

  const currentProgram = channel.CurrentProgram;
  const programTimeRange = currentProgram ? formatProgramTimeRange(currentProgram, language) : undefined;
  const iconChipStyle = (focused: boolean) => [styles.iconChip, { backgroundColor: focused ? colors.primaryContainer : 'rgba(0,0,0,0.4)' }];

  return (
    <View style={styles.container}>
      <KeplerVideoSurfaceView onSurfaceViewCreated={onSurfaceViewCreated} onSurfaceViewDestroyed={onSurfaceViewDestroyed} scalingmode="fit" style={StyleSheet.absoluteFill} />

      {!error && statusText ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.statusText, { color: colors.onBackground }]}>{statusText}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.loading}>
          <Text style={{ color: colors.onBackground }}>{t('player.playbackFailed')}</Text>
          {errorDetail ? <Text style={[styles.errorDetail, { color: colors.onSurfaceVariant }]}>{errorDetail}</Text> : null}
          <Pressable onPress={onExit} style={styles.errorBack}>
            <Text style={{ color: colors.primary }}>{t('common.back')}</Text>
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
          <View style={styles.channelInfo}>
            <Text numberOfLines={1} style={[styles.channelTitle, { color: colors.onBackground }]}>
              {channel.Number ? `${channel.Number} · ` : ''}
              {channel.Name}
            </Text>
            {currentProgram ? (
              <Text numberOfLines={1} style={[styles.programTitle, { color: colors.onSurfaceVariant }]}>
                {programTimeRange ? `${currentProgram.Name} (${programTimeRange})` : currentProgram.Name}
              </Text>
            ) : null}
          </View>
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
          <Pressable onPress={() => changeChannel(-1)}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={iconChipStyle(focused)}>
                <Icon name="keyboard-arrow-down" size={22} color={colors.onBackground} />
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => changeChannel(1)}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={iconChipStyle(focused)}>
                <Icon name="keyboard-arrow-up" size={22} color={colors.onBackground} />
              </View>
            )}
          </Pressable>
          <Text style={[styles.liveBadge, { color: colors.onBackground }]}>{t('livetv.live')}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ui/detail/livetv equivalent - plays a channel live. Full-screen push (RootStackParamList),
// not drawer chrome, matching Playback/PlaybackList.
export function LiveTvPlayerScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveTvPlayback'>>();
  const navigation = useNavigation();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [channels, setChannels] = useState<BaseItemDto[] | null>(null);
  const [channelId, setChannelId] = useState(route.params.channelId);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchLiveTvChannels(userId).then((items) => {
      if (!cancelled) setChannels(items);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Absorbs the hardware back button for as long as this screen is mounted, plus a short grace
  // period after it unmounts. Without any of this, `@amazon-devices/react-navigation__native`'s
  // own `NavigationContainer` back listener (RN's `BackHandler`, entirely separate from Kepler's
  // `HWEvent`/`useTVEventHandler` system `LiveTvPlayerBody` uses for its own manual 'back'
  // handling below) independently pops the same navigation stack a second time per press -
  // confirmed on-device as the cause of a real bug: back correctly closed this screen down to
  // the guide, then the second, unrelated pop had nothing left on the root stack and fell
  // through into the Drawer navigator's own `backBehavior="history"`, landing on Home instead -
  // see DEVELOPER.md's Live TV guide section (and its Slideshow gotcha, which first found this
  // exact two-listener conflict) for the full story.
  //
  // The grace period turned out to be load-bearing, confirmed via on-device logging
  // (`BackHandler.addEventListener` fires in reverse-registration order, absorbing here should
  // otherwise be enough on its own): the second `hardwareBackPress` for a single physical press
  // didn't arrive until ~80ms *after* the first `goBack()` had already unmounted this screen -
  // removing the subscription immediately left nothing registered to catch it, so it fell
  // through exactly as before. Delaying the actual `subscription.remove()` keeps absorbing
  // through that window without leaking the listener indefinitely.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => {
      setTimeout(() => subscription.remove(), 500);
    };
  }, []);

  if (!channels) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const channel = channels.find((c) => c.Id === channelId) ?? channels.find((c) => c.Id === route.params.channelId);
  if (!channel) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <LiveTvPlayerBody
      key={channelId}
      channel={channel}
      channels={channels}
      onChangeChannel={(next) => next.Id && setChannelId(next.Id)}
      onExit={() => navigation.goBack()}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusText: { marginTop: 12, fontSize: 14 },
  errorDetail: { marginTop: 4, fontSize: 12 },
  errorBack: { marginTop: 12 },
  topBar: { position: 'absolute', top: 24, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  channelInfo: { flex: 1 },
  channelTitle: { fontSize: 16, fontWeight: '600' },
  programTitle: { fontSize: 13, marginTop: 2 },
  bottomBar: { position: 'absolute', bottom: 24, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconChip: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  liveBadge: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, marginLeft: 'auto' },
});
