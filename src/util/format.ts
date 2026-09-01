import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { translate } from '../i18n/translate';
import type { Language } from '../i18n/translations';

/** Jellyfin durations/positions are in "ticks" (100ns units). */
const TICKS_PER_MS = 10_000;
const TICKS_PER_MINUTE = TICKS_PER_MS * 1000 * 60;

/** BCP-47 tag `toLocaleDateString`/`toLocaleTimeString` actually understand - this app's own
 * `Language` values are bare 'en'/'fr', which `Intl` also accepts, but a real region tag gives
 * more predictable month-name/AM-PM formatting across Hermes builds than a bare language tag
 * does. */
function localeTag(language: Language): string {
  return language === 'fr' ? 'fr-FR' : 'en-US';
}

export function ticksToMs(ticks: number): number {
  return Math.round(ticks / TICKS_PER_MS);
}

export function msToTicks(ms: number): number {
  return Math.round(ms * TICKS_PER_MS);
}

export function formatRuntime(runTimeTicks: number | null | undefined, language: Language): string | undefined {
  if (!runTimeTicks) {
    return undefined;
  }
  const totalMinutes = Math.round(runTimeTicks / TICKS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return translate(language, 'time.minutes', { minutes });
  }
  return translate(language, 'time.hoursMinutes', { hours, minutes });
}

export function formatTimeRemaining(ms: number, language: Language): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value =
    hours <= 0 ? translate(language, 'time.minutes', { minutes }) : translate(language, 'time.hoursMinutes', { hours, minutes });
  return translate(language, 'time.left', { value });
}

/** "2019 • 2h 15m • TV-MA • ★7.4" - mirrors `QuickDetails.kt`. */
export function formatQuickDetails(
  item: {
    ProductionYear?: number | null;
    RunTimeTicks?: number | null;
    OfficialRating?: string | null;
    CommunityRating?: number | null;
  },
  language: Language,
): string {
  const parts: string[] = [];
  if (item.ProductionYear) {
    parts.push(String(item.ProductionYear));
  }
  const runtime = formatRuntime(item.RunTimeTicks, language);
  if (runtime) {
    parts.push(runtime);
  }
  if (item.OfficialRating) {
    parts.push(item.OfficialRating);
  }
  if (item.CommunityRating) {
    parts.push(`★${item.CommunityRating.toFixed(1)}`);
  }
  return parts.join('  •  ');
}

/** "1:07 PM" - the top-right clock. */
export function formatClockTime(date: Date, language: Language): string {
  return date.toLocaleTimeString(localeTag(language), { hour: 'numeric', minute: '2-digit' });
}

/** "Jun 19, 2026" */
export function formatFullDate(iso: string, language: Language): string {
  return new Date(iso).toLocaleDateString(localeTag(language), { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Mon, Aug 31" - no year, for the Live TV guide's program info overlay (matches the compact
 * date every reference TV-guide client shows next to a program's air time). */
export function formatWeekdayDate(date: Date, language: Language): string {
  return date.toLocaleDateString(localeTag(language), { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Time left in an in-progress item, or undefined for one with no saved position. Prefers
 * `UserData.PlayedPercentage` (`RunTimeTicks * (1 - PlayedPercentage/100)`) over
 * `PlaybackPositionTicks` - the same field `CardImage.tsx`'s progress bar already reads, and
 * the one Jellyfin's own `/Items/Resume` response reliably carries; `PlaybackPositionTicks`
 * came back missing for some in-progress episodes even though `PlayedPercentage` was right
 * there, which is why "Ends at" silently never showed for those. `PlaybackPositionTicks` is
 * kept as a fallback for whatever else might call this with an item that only has that field.
 */
export function remainingRuntimeMs(item: {
  RunTimeTicks?: number | null;
  UserData?: { PlaybackPositionTicks?: number | null; PlayedPercentage?: number | null } | null;
}): number | undefined {
  if (!item.RunTimeTicks) {
    return undefined;
  }
  const playedPercentage = item.UserData?.PlayedPercentage;
  if (playedPercentage != null && playedPercentage > 0) {
    return Math.round(ticksToMs(item.RunTimeTicks) * (1 - playedPercentage / 100));
  }
  const positionTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  if (positionTicks > 0) {
    return ticksToMs(item.RunTimeTicks - positionTicks);
  }
  return undefined;
}

/**
 * One piece of the Home hero's info line (`HomeHero.tsx`). Most segments are plain text, but
 * the two ratings are tagged separately so `HomeHero.tsx` can give the star its own color/size
 * instead of it just being a character embedded in a plain string - not possible if this
 * returned one flat, already-joined string.
 */
export type HeroInfoSegment =
  | { kind: 'text'; value: string }
  | { kind: 'communityRating'; value: string }
  | { kind: 'criticRating'; value: string };

/**
 * The Home hero's info line (`HomeHero.tsx`), as an ordered list of segments rather than one
 * joined string. Distinct from `formatQuickDetails` (used on the detail screens) in both
 * content and per-type shape:
 * - An episode leads with "S1 E5" and its full air date ("Jun 19, 2026") instead of year/
 *   runtime/rating - the episode title above this line already carries the episode's own
 *   identity, and the season/episode + date pins down *which* episode of the show it is.
 * - Anything else (movies) gets year, runtime, and the official content rating instead.
 * - Both then get whichever of CommunityRating ("7.4", rendered with a star) and CriticRating
 *   ("🍅 92%", Jellyfin's Rotten-Tomatoes-style score) are actually present - an episode with
 *   either of these set shows them too, same as a movie.
 * - Whichever type it is, an in-progress item (a saved playback position) appends "Xm left"
 *   (`formatTimeRemaining`) - not "Ends at HH:MM", which an earlier version of this line showed
 *   instead.
 */
export function formatHeroInfoLine(
  item: {
    Type?: BaseItemKind;
    ParentIndexNumber?: number | null;
    IndexNumber?: number | null;
    PremiereDate?: string | null;
    ProductionYear?: number | null;
    RunTimeTicks?: number | null;
    OfficialRating?: string | null;
    CommunityRating?: number | null;
    CriticRating?: number | null;
    UserData?: { PlaybackPositionTicks?: number | null; PlayedPercentage?: number | null } | null;
  },
  language: Language,
): HeroInfoSegment[] {
  const segments: HeroInfoSegment[] = [];
  const text = (value: string) => segments.push({ kind: 'text', value });

  if (item.Type === BaseItemKind.Episode) {
    if (item.ParentIndexNumber != null && item.IndexNumber != null) {
      text(translate(language, 'episode.seasonEpisode', { season: item.ParentIndexNumber, episode: item.IndexNumber }));
    }
    if (item.PremiereDate) {
      text(formatFullDate(item.PremiereDate, language));
    }
  } else {
    if (item.ProductionYear) {
      text(String(item.ProductionYear));
    }
    const runtime = formatRuntime(item.RunTimeTicks, language);
    if (runtime) {
      text(runtime);
    }
    if (item.OfficialRating) {
      text(item.OfficialRating);
    }
  }

  if (item.CommunityRating) {
    segments.push({ kind: 'communityRating', value: item.CommunityRating.toFixed(1) });
  }
  if (item.CriticRating != null) {
    segments.push({ kind: 'criticRating', value: `🍅 ${Math.round(item.CriticRating)}%` });
  }

  const remainingMs = remainingRuntimeMs(item);
  if (remainingMs != null) {
    text(formatTimeRemaining(remainingMs, language));
  }

  return segments;
}

/**
 * "Season 1", "Season 2", ... "Specials" for season 0 - built from `IndexNumber` rather than
 * trusting `season.Name` (`SeasonTabs.tsx`), since a season's `Name` comes straight from
 * whatever the metadata provider set and isn't reliably in English or reliably present at all.
 * Falls back to `Name` only when there's no `IndexNumber` to build a label from.
 */
export function formatSeasonLabel(season: { IndexNumber?: number | null; Name?: string | null }, language: Language): string {
  if (season.IndexNumber === 0) {
    return translate(language, 'season.specials');
  }
  if (season.IndexNumber != null) {
    return translate(language, 'season.numbered', { number: season.IndexNumber });
  }
  return season.Name ?? translate(language, 'season.fallback');
}
