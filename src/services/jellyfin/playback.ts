import { getMediaInfoApi } from '@jellyfin/sdk/lib/utils/api/media-info-api';
import { getPlaystateApi } from '@jellyfin/sdk/lib/utils/api/playstate-api';
import { DlnaProfileType } from '@jellyfin/sdk/lib/generated-client/models/dlna-profile-type';
import { EncodingContext } from '@jellyfin/sdk/lib/generated-client/models/encoding-context';
import { MediaStreamProtocol } from '@jellyfin/sdk/lib/generated-client/models/media-stream-protocol';
import { SubtitleDeliveryMethod } from '@jellyfin/sdk/lib/generated-client/models/subtitle-delivery-method';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import type { DeviceProfile } from '@jellyfin/sdk/lib/generated-client/models/device-profile';
import type { MediaStream } from '@jellyfin/sdk/lib/generated-client/models/media-stream';
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
  forceTranscoding?: boolean;
  positionMs?: number;
}

/** Three-tier direct play -> direct stream -> transcode negotiation, mirroring
 * `PlaybackViewModel.changeStreams()`. Call again with `forceTranscoding: true` as a fallback
 * if playback of a direct-play/-stream URL fails at runtime. */
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
      EnableDirectPlay: !options.forceTranscoding,
      EnableDirectStream: !options.forceTranscoding,
      EnableTranscoding: true,
      AllowVideoStreamCopy: !options.forceTranscoding,
      AllowAudioStreamCopy: !options.forceTranscoding,
    },
  });

  const source = data.MediaSources?.[0];
  const playSessionId = data.PlaySessionId ?? '';
  if (!source?.Id) {
    throw new Error('Server returned no playable media source');
  }

  const mediaStreams = source.MediaStreams ?? [];

  if (source.SupportsDirectPlay && source.Path) {
    // Kepler's native media pipeline determines the container from the URL's file extension
    // rather than sniffing content or trusting the `container` query param, so the extensionless
    // `/stream` route (which works fine on players like ExoPlayer/AVPlayer) fails there with
    // MEDIA_ERR_SRC_NOT_SUPPORTED. `/stream.{container}` is the server's own documented route for
    // exactly this case.
    const container = source.Container ?? 'mp4';
    const url = api.getUri(`/Videos/${itemId}/stream.${container}`, {
      static: true,
      mediaSourceId: source.Id,
      playSessionId,
      api_key: api.accessToken,
    });
    return { url, playMethod: PlayMethod.DirectPlay, mediaSourceId: source.Id, playSessionId, mediaStreams };
  }

  if (source.TranscodingUrl) {
    return {
      url: api.getUri(source.TranscodingUrl),
      playMethod: source.SupportsDirectStream ? PlayMethod.DirectStream : PlayMethod.Transcode,
      mediaSourceId: source.Id,
      playSessionId,
      mediaStreams,
    };
  }

  throw new Error('Server did not return a playable stream URL');
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
