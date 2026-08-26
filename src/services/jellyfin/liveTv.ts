import { getLiveTvApi } from '@jellyfin/sdk/lib/utils/api/live-tv-api';
import { ChannelType } from '@jellyfin/sdk/lib/generated-client/models/channel-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { jellyfinClient } from './JellyfinClient';
import { formatClockTime } from '../../util/format';
import type { Language } from '../../i18n/translations';

interface ProgramTimes {
  StartDate?: string | null;
  EndDate?: string | null;
}

/** "8:00 PM - 8:30 PM" guide-cell subtitle - undefined when either bound is missing, which
 * `ProgramCard` treats as "not enough data to show a time." */
export function formatProgramTimeRange(program: ProgramTimes, language: Language): string | undefined {
  if (!program.StartDate || !program.EndDate) {
    return undefined;
  }
  return `${formatClockTime(new Date(program.StartDate), language)} - ${formatClockTime(new Date(program.EndDate), language)}`;
}

/** Whether `program` is airing at `now` - drives the guide's "LIVE" cell highlight. Takes `now`
 * as a param rather than reading `Date.now()` itself so it stays a pure, testable function. */
export function isProgramAiring(program: ProgramTimes, now: Date): boolean {
  if (!program.StartDate || !program.EndDate) {
    return false;
  }
  const time = now.getTime();
  return time >= new Date(program.StartDate).getTime() && time < new Date(program.EndDate).getTime();
}

/**
 * Live TV channel list + program guide (`screens/livetv/LiveTvGuideScreen.tsx`) - Phase 3's
 * first slice. No recording/timer scheduling here (see that screen's own comment for scope) -
 * this is read-only: list channels, show what's on, tune in.
 */

/** TV channels only, not Radio - a visual guide grid doesn't suit audio-only channels, and
 * this app has no audio-playback UI to route them to anyway. Sorted by name server-side
 * (`SortName`, not channel number - `Number` is a string field that doesn't sort numerically,
 * e.g. "10" would sort before "9") so the guide's channel rows land in a stable, predictable
 * order. */
export async function fetchLiveTvChannels(userId: string): Promise<BaseItemDto[]> {
  const { data } = await getLiveTvApi(jellyfinClient.api).getLiveTvChannels({
    userId,
    type: ChannelType.Tv,
    enableUserData: true,
    sortBy: [ItemSortBy.SortName],
  });
  return data.Items ?? [];
}

export interface ChannelGuide {
  channel: BaseItemDto;
  programs: BaseItemDto[];
}

/** Programs airing across the given channels within `[startDate, endDate]`, grouped back into
 * one row per channel (in the same order as `channels`) - the server's own `getLiveTvPrograms`
 * returns one flat, channel-mixed list, not pre-grouped. `minEndDate`/`maxStartDate` (rather
 * than `minStartDate`/`maxStartDate`) is deliberate: it selects any program that *overlaps* the
 * window, including one already in progress when the window starts, not just ones that start
 * inside it. */
export async function fetchLiveTvGuide(userId: string, channels: BaseItemDto[], startDate: Date, endDate: Date): Promise<ChannelGuide[]> {
  const channelIds = channels.map((c) => c.Id).filter((id): id is string => !!id);
  if (channelIds.length === 0) {
    return [];
  }
  const { data } = await getLiveTvApi(jellyfinClient.api).getLiveTvPrograms({
    userId,
    channelIds,
    minEndDate: startDate.toISOString(),
    maxStartDate: endDate.toISOString(),
    sortBy: [ItemSortBy.StartDate],
  });
  const programs = data.Items ?? [];
  const byChannel = new Map<string, BaseItemDto[]>();
  for (const program of programs) {
    if (!program.ChannelId) {
      continue;
    }
    const list = byChannel.get(program.ChannelId);
    if (list) {
      list.push(program);
    } else {
      byChannel.set(program.ChannelId, [program]);
    }
  }
  return channels.map((channel) => ({
    channel,
    programs: channel.Id ? (byChannel.get(channel.Id) ?? []) : [],
  }));
}

export interface GuideCell {
  program: BaseItemDto;
  left: number;
  width: number;
}

/** Pixel layout for one channel's guide cells within `[windowStart, windowEnd]` - the real
 * "looks like a TV guide" piece: cell width is proportional to how long the program actually
 * runs, not a fixed card size. A program that starts before the window or ends after it is
 * clipped to the window's own bounds, not the program's real bounds - the displayed cell only
 * ever represents the portion of the program actually inside the fetched window, so it can't
 * end up positioned partly off the timeline's left edge. `minWidth` keeps a very short program
 * (a 5-minute news break) wide enough to still show a title and stay a reasonable tap target. */
export function layoutGuideCells(programs: BaseItemDto[], windowStart: Date, windowEnd: Date, pxPerMinute: number, minWidth: number): GuideCell[] {
  const start = windowStart.getTime();
  const end = windowEnd.getTime();
  const cells: GuideCell[] = [];
  for (const program of programs) {
    if (!program.StartDate || !program.EndDate) {
      continue;
    }
    const programStart = Math.max(new Date(program.StartDate).getTime(), start);
    const programEnd = Math.min(new Date(program.EndDate).getTime(), end);
    if (programEnd <= programStart) {
      continue;
    }
    const left = ((programStart - start) / 60000) * pxPerMinute;
    const width = Math.max(((programEnd - programStart) / 60000) * pxPerMinute, minWidth);
    cells.push({ program, left, width });
  }
  return cells;
}

/** Time-of-day labels for the guide's shared header, one every `intervalMinutes` across
 * `[windowStart, windowEnd)` - paired with `layoutGuideCells`' same `pxPerMinute` scale by the
 * caller so labels line up with the cells underneath them. */
export function guideTimeLabels(windowStart: Date, windowEnd: Date, intervalMinutes: number): Date[] {
  const labels: Date[] = [];
  const cursor = new Date(windowStart);
  while (cursor.getTime() < windowEnd.getTime()) {
    labels.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + intervalMinutes);
  }
  return labels;
}
