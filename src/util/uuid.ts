/** Lightweight RFC-4122-ish v4 id generator; swap for kepler-identifiers where a stable,
 * device-scoped id matters (see JellyfinClient's deviceInfo.id TODO). */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // Nibble-masking is the standard, clearest way to write the UUIDv4 algorithm; a
    // division/modulo rewrite would be less obviously correct.
    // eslint-disable-next-line no-bitwise
    const r = (Math.random() * 16) | 0;
    // eslint-disable-next-line no-bitwise
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
