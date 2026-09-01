const mockGetPostedPlaybackInfo = jest.fn();
const mockOpenLiveStream = jest.fn();
const mockCloseLiveStream = jest.fn();
const mockReportPlaybackStart = jest.fn();
const mockReportPlaybackProgress = jest.fn();
const mockReportPlaybackStopped = jest.fn();
const mockGetNextUp = jest.fn();
const mockGetItemSegments = jest.fn();
const mockGetUri = jest.fn((url: string) => `https://server.example.com${url}`);

jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: {
    get api() {
      return { getUri: mockGetUri };
    },
  },
}));

jest.mock('@jellyfin/sdk/lib/utils/api/media-info-api', () => ({
  getMediaInfoApi: () => ({
    getPostedPlaybackInfo: mockGetPostedPlaybackInfo,
    openLiveStream: mockOpenLiveStream,
    closeLiveStream: mockCloseLiveStream,
  }),
}));

jest.mock('@jellyfin/sdk/lib/utils/api/playstate-api', () => ({
  getPlaystateApi: () => ({
    reportPlaybackStart: mockReportPlaybackStart,
    reportPlaybackProgress: mockReportPlaybackProgress,
    reportPlaybackStopped: mockReportPlaybackStopped,
  }),
}));

jest.mock('@jellyfin/sdk/lib/utils/api/tv-shows-api', () => ({
  getTvShowsApi: () => ({ getNextUp: mockGetNextUp }),
}));

jest.mock('@jellyfin/sdk/lib/utils/api/media-segments-api', () => ({
  getMediaSegmentsApi: () => ({ getItemSegments: mockGetItemSegments }),
}));

import {
  negotiatePlayback,
  reportPlaybackStart as reportStart,
  reportPlaybackProgress as reportProgress,
  reportPlaybackStopped as reportStopped,
  fetchNextUpEpisode,
  fetchMediaSegments,
  closeLiveStream,
} from '../../../src/services/jellyfin/playback';
import { PlayMethod } from '@jellyfin/sdk/lib/generated-client/models/play-method';
import { MediaSegmentType } from '@jellyfin/sdk/lib/generated-client/models/media-segment-type';

describe('negotiatePlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUri.mockImplementation((url: string) => `https://server.example.com${url}`);
  });

  it('always forces transcoding and disables direct play/stream', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({
      data: { PlaySessionId: 'sess-1', MediaSources: [{ Id: 'src-1', TranscodingUrl: '/videos/1/stream.m3u8' }] },
    });

    await negotiatePlayback('user-1', 'item-1');

    const [[call]] = mockGetPostedPlaybackInfo.mock.calls;
    expect(call.playbackInfoDto.EnableDirectPlay).toBe(false);
    expect(call.playbackInfoDto.EnableDirectStream).toBe(false);
    expect(call.playbackInfoDto.EnableTranscoding).toBe(true);
    expect(call.playbackInfoDto.AllowVideoStreamCopy).toBe(true);
    expect(call.playbackInfoDto.AllowAudioStreamCopy).toBe(true);
  });

  it('maps mediaSourceId/playSessionId/mediaStreams/playMethod from the response', async () => {
    const mediaStreams = [{ Index: 0, Type: 'Video' }];
    mockGetPostedPlaybackInfo.mockResolvedValue({
      data: {
        PlaySessionId: 'sess-42',
        MediaSources: [{ Id: 'src-42', TranscodingUrl: '/videos/42/stream.m3u8', MediaStreams: mediaStreams }],
      },
    });

    const result = await negotiatePlayback('user-1', 'item-42');

    expect(result).toEqual({
      url: 'https://server.example.com/videos/42/stream.m3u8',
      playMethod: PlayMethod.Transcode,
      mediaSourceId: 'src-42',
      playSessionId: 'sess-42',
      mediaStreams,
    });
    expect(mockGetUri).toHaveBeenCalledWith('/videos/42/stream.m3u8');
  });

  it('defaults playSessionId to an empty string when missing', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({
      data: { MediaSources: [{ Id: 'src-1', TranscodingUrl: '/x' }] },
    });

    const result = await negotiatePlayback('user-1', 'item-1');
    expect(result.playSessionId).toBe('');
  });

  it('defaults mediaStreams to an empty array when missing', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({
      data: { PlaySessionId: 's', MediaSources: [{ Id: 'src-1', TranscodingUrl: '/x' }] },
    });

    const result = await negotiatePlayback('user-1', 'item-1');
    expect(result.mediaStreams).toEqual([]);
  });

  it('throws when the server returns no media source', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [] } });
    await expect(negotiatePlayback('user-1', 'item-1')).rejects.toThrow('Server returned no playable media source');
  });

  it('throws when the media source has no Id', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [{ TranscodingUrl: '/x' }] } });
    await expect(negotiatePlayback('user-1', 'item-1')).rejects.toThrow('Server returned no playable media source');
  });

  it('throws when the media source has no TranscodingUrl', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [{ Id: 'src-1' }] } });
    await expect(negotiatePlayback('user-1', 'item-1')).rejects.toThrow('Server did not return a playable stream URL');
  });

  describe('allowDirectPlayback (Live TV)', () => {
    it('requests direct play/stream enabled instead of forcing them off', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [{ Id: 'src-1', TranscodingUrl: '/live.m3u8' }] } });

      await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

      const call = mockGetPostedPlaybackInfo.mock.calls[0][0];
      expect(call.playbackInfoDto.EnableDirectPlay).toBe(true);
      expect(call.playbackInfoDto.EnableDirectStream).toBe(true);
      expect(call.playbackInfoDto.EnableTranscoding).toBe(true);
    });

    it('still prefers TranscodingUrl when the server provides one', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({
        data: { PlaySessionId: 'sess-1', MediaSources: [{ Id: 'src-1', TranscodingUrl: '/live.m3u8', Path: '/raw/live.ts', SupportsDirectPlay: true }] },
      });

      const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

      expect(result).toEqual({
        url: 'https://server.example.com/live.m3u8',
        playMethod: PlayMethod.Transcode,
        mediaSourceId: 'src-1',
        playSessionId: 'sess-1',
        mediaStreams: [],
      });
    });

    it('falls back to a direct-stream Path when there is no TranscodingUrl', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({
        data: { PlaySessionId: 'sess-1', MediaSources: [{ Id: 'src-1', Path: '/raw/live.m3u8', SupportsDirectStream: true }] },
      });

      const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

      expect(result).toEqual({
        url: 'https://server.example.com/raw/live.m3u8',
        playMethod: PlayMethod.DirectStream,
        mediaSourceId: 'src-1',
        playSessionId: 'sess-1',
        mediaStreams: [],
      });
    });

    it('falls back to a direct-play Path when only SupportsDirectPlay is set', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({
        data: { MediaSources: [{ Id: 'src-1', Path: '/raw/live.m3u8', SupportsDirectPlay: true }] },
      });

      const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

      expect(result.playMethod).toBe(PlayMethod.DirectPlay);
    });

    it('uses an already-absolute Path as-is, without routing it through getUri', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({
        data: { MediaSources: [{ Id: 'src-1', Path: 'http://tuner.example.com/live.m3u8', SupportsDirectStream: true }] },
      });

      const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

      expect(result.url).toBe('http://tuner.example.com/live.m3u8');
      expect(mockGetUri).not.toHaveBeenCalled();
    });

    it('throws a diagnostic-carrying error when neither TranscodingUrl nor a direct Path is usable', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [{ Id: 'src-1' }] } });

      await expect(negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true })).rejects.toThrow(/Path: none/);
    });

    it('does not fall back to Path when allowDirectPlayback is not set, even if the source has one', async () => {
      mockGetPostedPlaybackInfo.mockResolvedValue({
        data: { MediaSources: [{ Id: 'src-1', Path: '/raw/live.m3u8', SupportsDirectPlay: true }] },
      });

      await expect(negotiatePlayback('user-1', 'channel-1')).rejects.toThrow('Server did not return a playable stream URL');
    });

    describe('RequiresOpening (tuner not yet started)', () => {
      it('opens the live stream and uses its resolved MediaSource instead of the PlaybackInfo preview', async () => {
        mockGetPostedPlaybackInfo.mockResolvedValue({
          data: {
            PlaySessionId: 'sess-preview',
            MediaSources: [{ Id: 'src-1', RequiresOpening: true, OpenToken: 'open-token-1', TranscodingUrl: '/preview.m3u8' }],
          },
        });
        mockOpenLiveStream.mockResolvedValue({
          data: { MediaSource: { Id: 'src-1', LiveStreamId: 'live-stream-1', TranscodingUrl: '/opened.m3u8' } },
        });

        const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

        expect(mockOpenLiveStream).toHaveBeenCalledWith({
          openLiveStreamDto: expect.objectContaining({
            OpenToken: 'open-token-1',
            UserId: 'user-1',
            ItemId: 'channel-1',
            PlaySessionId: 'sess-preview',
            EnableDirectPlay: true,
            EnableDirectStream: true,
          }),
        });
        expect(result.url).toBe('https://server.example.com/opened.m3u8');
        expect(result.liveStreamId).toBe('live-stream-1');
      });

      it('does not call openLiveStream when RequiresOpening is not set', async () => {
        mockGetPostedPlaybackInfo.mockResolvedValue({
          data: { MediaSources: [{ Id: 'src-1', TranscodingUrl: '/live.m3u8' }] },
        });

        const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

        expect(mockOpenLiveStream).not.toHaveBeenCalled();
        expect(result.liveStreamId).toBeUndefined();
      });

      it('falls back to the preview MediaSource when openLiveStream returns none', async () => {
        mockGetPostedPlaybackInfo.mockResolvedValue({
          data: {
            PlaySessionId: 'sess-preview',
            MediaSources: [{ Id: 'src-1', RequiresOpening: true, OpenToken: 'open-token-1', TranscodingUrl: '/preview.m3u8' }],
          },
        });
        mockOpenLiveStream.mockResolvedValue({ data: {} });

        const result = await negotiatePlayback('user-1', 'channel-1', { allowDirectPlayback: true });

        expect(result.url).toBe('https://server.example.com/preview.m3u8');
        expect(result.liveStreamId).toBeUndefined();
      });
    });
  });

  it('converts positionMs to StartTimeTicks when given, and omits it otherwise', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [{ Id: 's', TranscodingUrl: '/x' }] } });

    await negotiatePlayback('user-1', 'item-1', { positionMs: 1500 });
    expect(mockGetPostedPlaybackInfo.mock.calls[0][0].playbackInfoDto.StartTimeTicks).toBe(15_000_000);

    await negotiatePlayback('user-1', 'item-1', {});
    expect(mockGetPostedPlaybackInfo.mock.calls[1][0].playbackInfoDto.StartTimeTicks).toBeUndefined();
  });

  it('passes audioStreamIndex/subtitleStreamIndex through to the request', async () => {
    mockGetPostedPlaybackInfo.mockResolvedValue({ data: { MediaSources: [{ Id: 's', TranscodingUrl: '/x' }] } });

    await negotiatePlayback('user-1', 'item-1', { audioStreamIndex: 2, subtitleStreamIndex: 5 });
    const call = mockGetPostedPlaybackInfo.mock.calls[0][0];
    expect(call.playbackInfoDto.AudioStreamIndex).toBe(2);
    expect(call.playbackInfoDto.SubtitleStreamIndex).toBe(5);
    expect(call.itemId).toBe('item-1');
    expect(call.userId).toBe('user-1');
  });
});

describe('reportPlaybackStart', () => {
  beforeEach(() => jest.clearAllMocks());

  it('maps fields and marks the session seekable', async () => {
    await reportStart({
      itemId: 'item-1',
      mediaSourceId: 'src-1',
      playSessionId: 'sess-1',
      playMethod: PlayMethod.Transcode,
      positionMs: 2000,
      isPaused: false,
      audioStreamIndex: 1,
      subtitleStreamIndex: 3,
    });

    expect(mockReportPlaybackStart).toHaveBeenCalledWith({
      playbackStartInfo: {
        ItemId: 'item-1',
        MediaSourceId: 'src-1',
        PlaySessionId: 'sess-1',
        PlayMethod: PlayMethod.Transcode,
        IsPaused: false,
        PositionTicks: 20_000_000,
        AudioStreamIndex: 1,
        SubtitleStreamIndex: 3,
        CanSeek: true,
      },
    });
  });
});

describe('reportPlaybackProgress', () => {
  beforeEach(() => jest.clearAllMocks());

  it('converts position to ticks and marks the session seekable', async () => {
    await reportProgress({
      itemId: 'item-1',
      mediaSourceId: 'src-1',
      playSessionId: 'sess-1',
      playMethod: PlayMethod.Transcode,
      positionMs: 5000,
      isPaused: true,
    });

    const [[call]] = mockReportPlaybackProgress.mock.calls;
    expect(call.playbackProgressInfo.PositionTicks).toBe(50_000_000);
    expect(call.playbackProgressInfo.IsPaused).toBe(true);
    expect(call.playbackProgressInfo.CanSeek).toBe(true);
  });
});

describe('reportPlaybackStopped', () => {
  beforeEach(() => jest.clearAllMocks());

  it('omits playMethod/isPaused/CanSeek, which stop info does not carry', async () => {
    await reportStopped({ itemId: 'item-1', mediaSourceId: 'src-1', playSessionId: 'sess-1', positionMs: 9000 });

    expect(mockReportPlaybackStopped).toHaveBeenCalledWith({
      playbackStopInfo: {
        ItemId: 'item-1',
        MediaSourceId: 'src-1',
        PlaySessionId: 'sess-1',
        PositionTicks: 90_000_000,
      },
    });
  });
});

describe('closeLiveStream', () => {
  beforeEach(() => jest.clearAllMocks());

  it('closes the given live stream id', async () => {
    await closeLiveStream('live-stream-1');
    expect(mockCloseLiveStream).toHaveBeenCalledWith({ liveStreamId: 'live-stream-1' });
  });
});

describe('fetchNextUpEpisode', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the first item, scoped to the given series', async () => {
    mockGetNextUp.mockResolvedValue({ data: { Items: [{ Id: 'ep-2', IndexNumber: 2 }] } });

    const result = await fetchNextUpEpisode('user-1', 'series-1');

    expect(result).toEqual({ Id: 'ep-2', IndexNumber: 2 });
    expect(mockGetNextUp).toHaveBeenCalledWith({
      userId: 'user-1',
      seriesId: 'series-1',
      limit: 1,
      enableUserData: true,
    });
  });

  it('returns null when the server has nothing queued (e.g. the last episode of a series)', async () => {
    mockGetNextUp.mockResolvedValue({ data: { Items: [] } });
    expect(await fetchNextUpEpisode('user-1', 'series-1')).toBeNull();
  });

  it('returns null when Items is missing entirely', async () => {
    mockGetNextUp.mockResolvedValue({ data: {} });
    expect(await fetchNextUpEpisode('user-1', 'series-1')).toBeNull();
  });
});

describe('fetchMediaSegments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the items, scoped to Intro/Outro segment types', async () => {
    const items = [
      { Id: 'seg-1', ItemId: 'item-1', Type: MediaSegmentType.Intro, StartTicks: 0, EndTicks: 900_000_000 },
    ];
    mockGetItemSegments.mockResolvedValue({ data: { Items: items } });

    const result = await fetchMediaSegments('item-1');

    expect(result).toEqual(items);
    expect(mockGetItemSegments).toHaveBeenCalledWith({
      itemId: 'item-1',
      includeSegmentTypes: [MediaSegmentType.Intro, MediaSegmentType.Outro],
    });
  });

  it('returns an empty array when the server has no segment data for the item', async () => {
    mockGetItemSegments.mockResolvedValue({ data: {} });
    expect(await fetchMediaSegments('item-1')).toEqual([]);
  });
});
