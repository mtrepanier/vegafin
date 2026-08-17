/** Jellyfin durations/positions are in "ticks" (100ns units). */
const TICKS_PER_MS = 10_000;
const TICKS_PER_MINUTE = TICKS_PER_MS * 1000 * 60;

export function ticksToMs(ticks: number): number {
  return Math.round(ticks / TICKS_PER_MS);
}

export function msToTicks(ms: number): number {
  return Math.round(ms * TICKS_PER_MS);
}

export function formatRuntime(runTimeTicks?: number | null): string | undefined {
  if (!runTimeTicks) {
    return undefined;
  }
  const totalMinutes = Math.round(runTimeTicks / TICKS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatTimeRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}m left`;
  }
  return `${hours}h ${minutes}m left`;
}

/** "2019 • 2h 15m • TV-MA • ★7.4" - mirrors `QuickDetails.kt`. */
export function formatQuickDetails(item: {
  ProductionYear?: number | null;
  RunTimeTicks?: number | null;
  OfficialRating?: string | null;
  CommunityRating?: number | null;
}): string {
  const parts: string[] = [];
  if (item.ProductionYear) {
    parts.push(String(item.ProductionYear));
  }
  const runtime = formatRuntime(item.RunTimeTicks);
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
