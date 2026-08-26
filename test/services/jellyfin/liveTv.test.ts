const mockGetLiveTvChannels = jest.fn();
const mockGetLiveTvPrograms = jest.fn();

jest.mock('../../../src/services/jellyfin/JellyfinClient', () => ({
  jellyfinClient: { get api() { return {}; } },
}));
jest.mock('@jellyfin/sdk/lib/utils/api/live-tv-api', () => ({
  getLiveTvApi: () => ({ getLiveTvChannels: mockGetLiveTvChannels, getLiveTvPrograms: mockGetLiveTvPrograms }),
}));

import {
  fetchLiveTvChannels,
  fetchLiveTvGuide,
  formatProgramTimeRange,
  isProgramAiring,
  layoutGuideCells,
  guideTimeLabels,
} from '../../../src/services/jellyfin/liveTv';
import { ChannelType } from '@jellyfin/sdk/lib/generated-client/models/channel-type';

beforeEach(() => jest.clearAllMocks());

describe('fetchLiveTvChannels', () => {
  it('requests TV channels only, sorted by name', async () => {
    mockGetLiveTvChannels.mockResolvedValue({ data: { Items: [{ Id: 'ch-1' }] } });

    const result = await fetchLiveTvChannels('user-1');

    expect(result).toEqual([{ Id: 'ch-1' }]);
    const call = mockGetLiveTvChannels.mock.calls[0][0];
    expect(call.userId).toBe('user-1');
    expect(call.type).toBe(ChannelType.Tv);
    expect(call.enableUserData).toBe(true);
  });

  it('defaults to an empty array when the server returns no channels', async () => {
    mockGetLiveTvChannels.mockResolvedValue({ data: {} });
    expect(await fetchLiveTvChannels('user-1')).toEqual([]);
  });
});

describe('fetchLiveTvGuide', () => {
  const channelA = { Id: 'ch-a', Name: 'Channel A' };
  const channelB = { Id: 'ch-b', Name: 'Channel B' };

  it('groups programs back under their own channel, in the given channel order', async () => {
    mockGetLiveTvPrograms.mockResolvedValue({
      data: {
        Items: [
          { Id: 'p1', ChannelId: 'ch-b', Name: 'Show B1' },
          { Id: 'p2', ChannelId: 'ch-a', Name: 'Show A1' },
          { Id: 'p3', ChannelId: 'ch-a', Name: 'Show A2' },
        ],
      },
    });

    const result = await fetchLiveTvGuide('user-1', [channelA, channelB], new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T04:00:00Z'));

    expect(result).toEqual([
      { channel: channelA, programs: [{ Id: 'p2', ChannelId: 'ch-a', Name: 'Show A1' }, { Id: 'p3', ChannelId: 'ch-a', Name: 'Show A2' }] },
      { channel: channelB, programs: [{ Id: 'p1', ChannelId: 'ch-b', Name: 'Show B1' }] },
    ]);
  });

  it('gives a channel with no matching programs an empty programs array', async () => {
    mockGetLiveTvPrograms.mockResolvedValue({ data: { Items: [] } });

    const result = await fetchLiveTvGuide('user-1', [channelA], new Date(), new Date());

    expect(result).toEqual([{ channel: channelA, programs: [] }]);
  });

  it('passes the window as minEndDate/maxStartDate so overlapping programs are included', async () => {
    mockGetLiveTvPrograms.mockResolvedValue({ data: { Items: [] } });
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-01T04:00:00Z');

    await fetchLiveTvGuide('user-1', [channelA], start, end);

    const call = mockGetLiveTvPrograms.mock.calls[0][0];
    expect(call.channelIds).toEqual(['ch-a']);
    expect(call.minEndDate).toBe(start.toISOString());
    expect(call.maxStartDate).toBe(end.toISOString());
  });

  it('returns an empty array and skips the request entirely when there are no channels', async () => {
    const result = await fetchLiveTvGuide('user-1', [], new Date(), new Date());
    expect(result).toEqual([]);
    expect(mockGetLiveTvPrograms).not.toHaveBeenCalled();
  });
});

describe('formatProgramTimeRange', () => {
  it('formats a start/end pair', () => {
    const result = formatProgramTimeRange({ StartDate: '2026-01-01T20:00:00Z', EndDate: '2026-01-01T20:30:00Z' }, 'en');
    expect(result).toContain(' - ');
  });

  it('returns undefined when either bound is missing', () => {
    expect(formatProgramTimeRange({ StartDate: '2026-01-01T20:00:00Z' }, 'en')).toBeUndefined();
    expect(formatProgramTimeRange({ EndDate: '2026-01-01T20:00:00Z' }, 'en')).toBeUndefined();
    expect(formatProgramTimeRange({}, 'en')).toBeUndefined();
  });
});

describe('isProgramAiring', () => {
  const program = { StartDate: '2026-01-01T20:00:00Z', EndDate: '2026-01-01T21:00:00Z' };

  it('is true while now falls within [StartDate, EndDate)', () => {
    expect(isProgramAiring(program, new Date('2026-01-01T20:30:00Z'))).toBe(true);
  });

  it('is true exactly at StartDate', () => {
    expect(isProgramAiring(program, new Date('2026-01-01T20:00:00Z'))).toBe(true);
  });

  it('is false exactly at EndDate (end is exclusive)', () => {
    expect(isProgramAiring(program, new Date('2026-01-01T21:00:00Z'))).toBe(false);
  });

  it('is false before StartDate or after EndDate', () => {
    expect(isProgramAiring(program, new Date('2026-01-01T19:59:00Z'))).toBe(false);
    expect(isProgramAiring(program, new Date('2026-01-01T21:01:00Z'))).toBe(false);
  });

  it('is false when either bound is missing', () => {
    expect(isProgramAiring({ StartDate: '2026-01-01T20:00:00Z' }, new Date())).toBe(false);
    expect(isProgramAiring({}, new Date())).toBe(false);
  });
});

describe('layoutGuideCells', () => {
  const windowStart = new Date('2026-01-01T20:00:00Z');
  const windowEnd = new Date('2026-01-01T22:00:00Z');

  it('positions a cell left/width proportional to its start offset and duration', () => {
    const program = { Id: 'p1', StartDate: '2026-01-01T20:30:00Z', EndDate: '2026-01-01T21:00:00Z' };

    const [cell] = layoutGuideCells([program], windowStart, windowEnd, 10, 0);

    expect(cell.left).toBe(300); // 30 min * 10px/min
    expect(cell.width).toBe(300); // 30 min * 10px/min
  });

  it('clips a program that starts before the window to the window start', () => {
    const program = { Id: 'p1', StartDate: '2026-01-01T19:30:00Z', EndDate: '2026-01-01T20:30:00Z' };

    const [cell] = layoutGuideCells([program], windowStart, windowEnd, 10, 0);

    expect(cell.left).toBe(0);
    expect(cell.width).toBe(300); // only the 30 min inside the window
  });

  it('clips a program that ends after the window to the window end', () => {
    const program = { Id: 'p1', StartDate: '2026-01-01T21:30:00Z', EndDate: '2026-01-01T22:30:00Z' };

    const [cell] = layoutGuideCells([program], windowStart, windowEnd, 10, 0);

    expect(cell.left).toBe(900); // 90 min * 10px/min
    expect(cell.width).toBe(300); // only the 30 min inside the window
  });

  it('enforces a minimum width for a very short program', () => {
    const program = { Id: 'p1', StartDate: '2026-01-01T20:00:00Z', EndDate: '2026-01-01T20:05:00Z' };

    const [cell] = layoutGuideCells([program], windowStart, windowEnd, 10, 80);

    expect(cell.width).toBe(80); // 5 min * 10px/min = 50, below the 80 minimum
  });

  it('skips a program with no StartDate/EndDate, or one entirely outside the window', () => {
    const noDates = { Id: 'p1' };
    const beforeWindow = { Id: 'p2', StartDate: '2026-01-01T18:00:00Z', EndDate: '2026-01-01T19:00:00Z' };

    expect(layoutGuideCells([noDates, beforeWindow], windowStart, windowEnd, 10, 0)).toEqual([]);
  });
});

describe('guideTimeLabels', () => {
  it('generates one label per interval across the window', () => {
    const labels = guideTimeLabels(new Date('2026-01-01T20:00:00Z'), new Date('2026-01-01T21:30:00Z'), 30);

    expect(labels.map((d) => d.toISOString())).toEqual([
      '2026-01-01T20:00:00.000Z',
      '2026-01-01T20:30:00.000Z',
      '2026-01-01T21:00:00.000Z',
    ]);
  });

  it('still includes the leading label even when the window is shorter than one interval', () => {
    expect(guideTimeLabels(new Date('2026-01-01T20:00:00Z'), new Date('2026-01-01T20:10:00Z'), 30).map((d) => d.toISOString())).toEqual([
      '2026-01-01T20:00:00.000Z',
    ]);
  });

  it('returns an empty array for a zero-length window', () => {
    const t = new Date('2026-01-01T20:00:00Z');
    expect(guideTimeLabels(t, t, 30)).toEqual([]);
  });
});
