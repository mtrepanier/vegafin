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
}

export interface NegotiatePlaybackOptions {
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  positionMs?: number;
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
      EnableDirectPlay: false,
      EnableDirectStream: false,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
    },
  });

  const source = data.MediaSources?.[0];
  const playSessionId = data.PlaySessionId ?? '';
  if (!source?.Id) {
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
    };
  }

  throw new Error('Server did not return a playable stream URL');
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
