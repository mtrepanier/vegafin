/** Lightweight RFC-4122-ish v4 id generator; swap for kepler-identifiers where a stable,
 * device-scoped id matters (see JellyfinClient's deviceInfo.id TODO). */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
