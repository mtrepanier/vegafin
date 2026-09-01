import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import { getTvShowsApi } from '@jellyfin/sdk/lib/utils/api/tv-shows-api';
import { getMediaSegmentsApi } from '@jellyfin/sdk/lib/utils/api/media-segments-api';
import { DlnaProfileType } from '@jellyfin/sdk/lib/generated-client/models/dlna-profile-type';
import { EncodingContext } from '@jellyfin/sdk/lib/generated-client/models/encoding-context';
import { MediaStreamProtocol } from '@jellyfin/sdk/lib/generated-client/models/media-stream-protocol';
import { SubtitleDeliveryMethod } from '@jellyfin/sdk/lib/generated-client/models/subtitle-delivery-method';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { MediaSegmentDto } from '@jellyfin/sdk/lib/generated-client/models/media-segment-dto';
import { jellyfinClient } from './JellyfinClient';
import { msToTicks } from '../../util/format';

/**
 * PlaybackInfo negotiation, device profile, and progress reporting - mirrors
 * `PlaybackViewModel.changeStreams()` and `util/TrackActivityPlaybackListener.kt`.
 *
 * Spike finding (see the plan's playback milestone): `@amazon-devices/react-native-w3cmedia`'s
 * `VideoPlayer` implements the standard W3C `HTMLVideoElement` - `src` is a plain string
 * setter, just like a browser `<video>` tag. There's no Shaka Player or other JS ABR/manifest
 * library anywhere in this project (contrary to the original README draft); HLS/DASH URLs are
 * simply assigned to `videoPlayer.src` and adaptive bitrate/manifest parsing happens natively.
 * No MediaSource/SourceBuffer plumbing is needed for the direct-play/transcode URLs Jellyfin
 * hands back.
 */

/**
 * Conservative static profile: no MediaCodec-style capability probing (RN has no equivalent
 * API), so this declares broad, common direct-play support and otherwise leans on the server's
 * transcoder - matching the plan's playback scope ("let the server transcode anything
 * unsupported").
 */
const DEVICE_PROFILE: DeviceProfile = {
  MaxStreamingBitrate: 120_000_000,
  MaxStaticBitrate: 100_000_000,
  MusicStreamingTranscodingBitrate: 384_000,
  DirectPlayProfiles: [
    { Type: DlnaProfileType.Video, Container: 'mp4,m4v,mkv,mov', VideoCodec: 'h264,hevc,vp9,av1', AudioCodec: 'aac,ac3,eac3,mp3,flac,opus' },
    { Type: DlnaProfileType.Audio, Container: 'mp3,aac,flac,m4a,ogg,wav', AudioCodec: 'mp3,aac,flac,opus' },
  ],
  TranscodingProfiles: [
    {
      Type: DlnaProfileType.Video,
      Container: 'ts',
      Protocol: MediaStreamProtocol.Hls,
      VideoCodec: 'h264',
      AudioCodec: 'aac,mp3',
      Context: EncodingContext.Streaming,
      MinSegments: 1,
      BreakOnNonKeyFrames: true,
    },
    {
      Type: DlnaProfileType.Audio,
      Container: 'mp3',
      Protocol: MediaStreamProtocol.Http,
      AudioCodec: 'mp3',
      Context: EncodingContext.Streaming,
    },
  ],
  SubtitleProfiles: [
    { Format: 'vtt', Method: SubtitleDeliveryMethod.Hls },
    { Format: 'srt', Method: SubtitleDeliveryMethod.External },
    { Format: 'ass', Method: SubtitleDeliveryMethod.Encode },
  ],
};

export type PlayMethodValue = (typeof PlayMethod)[keyof typeof PlayMethod];

export interface PlaybackSource {
  url: string;
  playMethod: PlayMethodValue;
  mediaSourceId: string;
  playSessionId: string;
  /** Audio/subtitle/video streams available on this source, for the track-picker UI. */
  mediaStreams: MediaStream[];
  /** Only set for a Live TV source that required `openLiveStream` (see the comment on that call
   * below) - pass to `closeLiveStream` on teardown/channel-switch to release the tuner. Never
   * set for VOD, which doesn't go through that path. */
  liveStreamId?: string;
}

export interface NegotiatePlaybackOptions {
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  positionMs?: number;
  /** Live TV channels (`liveTv.ts`) pass this - the reason VOD forces transcode-only below is
   * specifically about *seeking* into a direct-played raw file, which doesn't apply to a live
   * stream (there's nothing to seek). Forcing direct play/stream off unconditionally risked the
   * server not returning a usable source at all for some Live TV backends, which already
   * transcode/remux tuner input to HLS on their own end regardless of what's requested here.
   * Defaults to `false` - VOD's existing, tested behavior is unchanged unless a caller opts in. */
  allowDirectPlayback?: boolean;
}

/** Always transcodes to HLS, mirroring `PlaybackViewModel.changeStreams()`'s transcode tier but
 * skipping the direct-play/-stream tiers entirely: seeking into a direct-played raw file fails
 * on this platform (`DefaultMediaPlayer seekWithRate ... Internal error 0`, MPB code 50004 -
 * confirmed from device logs), while HLS's segment-based seeking works reliably. Confirmed
 * against AmbientFlare/astra-tv, a separate Jellyfin-for-Vega client that made the same choice
 * for the same reason. `AllowVideoStreamCopy`/`AllowAudioStreamCopy` stay enabled so the server
 * can still avoid re-encoding compatible streams *within* the HLS package - that's a pure
 * efficiency win and doesn't reintroduce the raw-file seek problem, since the output is still
 * HLS-segmented either way. */
export async function negotiatePlayback(
  userId: string,
  itemId: string,
  options: NegotiatePlaybackOptions = {},
): Promise<PlaybackSource> {
  const api = jellyfinClient.api;
  const { data } = await getMediaInfoApi(api).getPostedPlaybackInfo({
    itemId,
    userId,
    playbackInfoDto: {
      UserId: userId,
      DeviceProfile: DEVICE_PROFILE,
      AudioStreamIndex: options.audioStreamIndex,
      SubtitleStreamIndex: options.subtitleStreamIndex,
      StartTimeTicks: options.positionMs ? msToTicks(options.positionMs) : undefined,
      MaxStreamingBitrate: DEVICE_PROFILE.MaxStreamingBitrate,
      EnableDirectPlay: options.allowDirectPlayback ?? false,
      EnableDirectStream: options.allowDirectPlayback ?? false,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
    },
  });

  let source = data.MediaSources?.[0];
  const playSessionId = data.PlaySessionId ?? '';
  if (!source?.Id) {
    throw new Error('Server returned no playable media source');
  }

  // Confirmed on-device as the actual root cause of a long-standing Live TV bug (see
  // LiveTvPlayerScreen.tsx's own comment on `loadVideoSource` for the full diagnostic story):
  // `RequiresOpening: true` here isn't informational - the tuner/proxy source behind
  // `TranscodingUrl`/`Path` genuinely isn't running yet. Skipping this call (the original code
  // did) meant `live.m3u8` would hang far longer than any reasonable client timeout - confirmed
  // by curling it directly (60s, zero bytes) - while the *same* channel opened properly this
  // way returns a valid playlist in a few seconds. `getPostedPlaybackInfo`'s `MediaSources[0]`
  // is only a preview: placeholder `MediaStreams` (`Index: -1`, no codec) and a generic
  // `TranscodingUrl` with none of the source's real resolution/bitrate baked in.
  // `openLiveStream`'s response is the one Jellyfin has actually probed and started - use it in
  // place of the preview from here on. VOD never sets `RequiresOpening`, so this is unreachable
  // for VOD regardless of `allowDirectPlayback`.
  let liveStreamId: string | undefined;
  if (options.allowDirectPlayback && source.RequiresOpening && source.OpenToken) {
    const { data: openData } = await getMediaInfoApi(api).openLiveStream({
      openLiveStreamDto: {
        OpenToken: source.OpenToken,
        UserId: userId,
        ItemId: itemId,
        PlaySessionId: playSessionId,
        DeviceProfile: DEVICE_PROFILE,
        EnableDirectPlay: options.allowDirectPlayback,
        EnableDirectStream: options.allowDirectPlayback,
      },
    });
    if (openData.MediaSource) {
      source = openData.MediaSource;
      liveStreamId = source.LiveStreamId ?? undefined;
    }
  }
  if (!source.Id) {
    throw new Error('Server returned no playable media source');
  }

  const mediaStreams = source.MediaStreams ?? [];

  if (source.TranscodingUrl) {
    return {
      url: api.getUri(source.TranscodingUrl),
      playMethod: PlayMethod.Transcode,
      mediaSourceId: source.Id,
      playSessionId,
      mediaStreams,
      liveStreamId,
    };
  }

  // Only reachable when the caller opted into direct play/stream (Live TV) - VOD never sees
  // this, since it always requests transcode-only and throws below if that's somehow missing.
  // A Live TV source is frequently already HLS at the tuner/source level (Jellyfin's own LiveTV
  // pipeline remuxes to HLS on its own end), so the server can return `SupportsDirectPlay`/
  // `SupportsDirectStream` with a `Path` instead of ever populating `TranscodingUrl` at all.
  if (options.allowDirectPlayback && source.Path && (source.SupportsDirectPlay || source.SupportsDirectStream)) {
    return {
      url: source.Path.startsWith('http') ? source.Path : api.getUri(source.Path),
      playMethod: source.SupportsDirectStream ? PlayMethod.DirectStream : PlayMethod.DirectPlay,
      mediaSourceId: source.Id,
      playSessionId,
      mediaStreams,
      liveStreamId,
    };
  }

  if (options.allowDirectPlayback) {
    // Surfaced on-screen via LiveTvPlayerScreen.tsx's errorDetail rather than left to a log
    // line - this codebase's own systemd-journald rate-limits and silently drops log bursts, so
    // a diagnostic that's only visible in logs isn't a reliable diagnostic here at all. If this
    // fires, `source`'s actual shape (which fields it did/didn't set) is the next thing to look
    // at - Live TV negotiation is confirmed-uncertain territory (see liveTv.ts's own comment).
    throw new Error(
      `Server did not return a playable stream URL for this channel (Path: ${source.Path ?? 'none'}, ` +
        `SupportsDirectPlay: ${source.SupportsDirectPlay ?? false}, SupportsDirectStream: ${source.SupportsDirectStream ?? false})`,
    );
  }
  throw new Error('Server did not return a playable stream URL');
}

/** Releases a Live TV tuner/proxy source opened via `negotiatePlayback`'s `openLiveStream` call
 * above - mirrors Jellyfin's own web client calling this on channel-switch/stop. Only ever
 * called with a `PlaybackSource.liveStreamId` that came back set, so this is a no-op for VOD
 * (which never opens one) by construction, not by a check here. */
export async function closeLiveStream(liveStreamId: string): Promise<void> {
  await getMediaInfoApi(jellyfinClient.api).closeLiveStream({ liveStreamId });
}

/** The episode Jellyfin's own "Next Up" would recommend after this series' currently-playing
 * episode, scoped to just that one series (`seriesId`, not the general cross-show "Next Up"
 * `homeRows.ts`'s `fetchNextUpRow` uses for the Home row) - lets the server resolve
 * season-boundary/special-episode edge cases rather than this app walking `IndexNumber`
 * itself. Used by `PlaybackScreens.tsx`'s end-of-playback Next Up prompt; `null` when there
 * isn't one (last episode of a series, or the server has nothing queued). */
export async function fetchNextUpEpisode(userId: string, seriesId: string): Promise<BaseItemDto | null> {
  const { data } = await getTvShowsApi(jellyfinClient.api).getNextUp({
    userId,
    seriesId,
    limit: 1,
    enableUserData: true,
  });
  return data.Items?.[0] ?? null;
}

/** Intro/outro skip markers from the MediaSegments API - populated server-side by the Intro
 * Skipper plugin, not anything this app writes. Scoped to just these two types (Commercial/
 * Preview/Recap exist in the schema too, but PlaybackScreens.tsx's Skip Intro/Skip Outro
 * feature doesn't surface them). Used for both a movie and an episode's own itemId - the server
 * just returns an empty list for anything without segment data, so no BaseItemKind check is
 * needed here. */
export async function fetchMediaSegments(itemId: string): Promise<MediaSegmentDto[]> {
  const { data } = await getMediaSegmentsApi(jellyfinClient.api).getItemSegments({
    itemId,
    includeSegmentTypes: [MediaSegmentType.Intro, MediaSegmentType.Outro],
  });
  return data.Items ?? [];
}

export interface ProgressReportInfo {
  itemId: string;
  mediaSourceId: string;
  playSessionId: string;
  playMethod: PlayMethodValue;
  positionMs: number;
  isPaused: boolean;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
}

/** Mirrors `TrackActivityPlaybackListener.init()` - call once when playback first starts. */
export async function reportPlaybackStart(info: ProgressReportInfo): Promise<void> {
  await getPlaystateApi(jellyfinClient.api).reportPlaybackStart({
    playbackStartInfo: {
      ItemId: info.itemId,
      MediaSourceId: info.mediaSourceId,
      PlaySessionId: info.playSessionId,
      PlayMethod: info.playMethod,
      IsPaused: info.isPaused,
      PositionTicks: msToTicks(info.positionMs),
      AudioStreamIndex: info.audioStreamIndex,
      SubtitleStreamIndex: info.subtitleStreamIndex,
      CanSeek: true,
    },
  });
}

/** Mirrors `TrackActivityPlaybackListener.saveActivity()` - call on a 5s interval and on
 * pause/resume. */
export async function reportPlaybackProgress(info: ProgressReportInfo): Promise<void> {
  await getPlaystateApi(jellyfinClient.api).reportPlaybackProgress({
    playbackProgressInfo: {
      ItemId: info.itemId,
      MediaSourceId: info.mediaSourceId,
      PlaySessionId: info.playSessionId,
      PlayMethod: info.playMethod,
      IsPaused: info.isPaused,
      PositionTicks: msToTicks(info.positionMs),
      AudioStreamIndex: info.audioStreamIndex,
      SubtitleStreamIndex: info.subtitleStreamIndex,
      CanSeek: true,
    },
  });
}

/** Mirrors `TrackActivityPlaybackListener.release()` - call on unmount/navigate-away. */
export async function reportPlaybackStopped(info: Omit<ProgressReportInfo, 'isPaused' | 'playMethod'>): Promise<void> {
  await getPlaystateApi(jellyfinClient.api).reportPlaybackStopped({
    playbackStopInfo: {
      ItemId: info.itemId,
      MediaSourceId: info.mediaSourceId,
      PlaySessionId: info.playSessionId,
      PositionTicks: msToTicks(info.positionMs),
    },
  });
}
