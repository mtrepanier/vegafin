/**
 * Server-URL normalization and scheme resolution, ported from AmbientFlare/astra-tv (a
 * separate Jellyfin-for-Vega client field-tested on real Fire TV hardware). A schemeless or
 * mixed-case server URL breaks silently on this platform: JS-side fetch/axios calls tolerate
 * it, but the native media pipeline's URI-scheme dispatch doesn't - a stream URL built from a
 * schemeless base falls through to GStreamer's `filesrc` element, which tries to open the
 * whole URL as a literal local file path ("No such file ..."). Resolving the scheme once at
 * connect time, rather than trusting what the user typed, avoids that entirely.
 */

/** Canonical form of a server URL: trimmed, lowercase scheme/host, no trailing slash. */
export function normalizeServerUrl(serverUrl: string): string {
  return serverUrl
    .trim()
    // The TV on-screen keyboard auto-capitalizes the first letter, so users routinely enter
    // "Http://...". A non-lowercase scheme can fail URL parsing outright, so normalize it.
    .replace(/^([a-z][a-z0-9+.-]*):\/\//i, (_match, scheme: string) => `${scheme.toLowerCase()}://`)
    // Hostnames are case-insensitive; lowercasing keeps "Jelly.example.com" and
    // "jelly.example.com" from becoming two separate stored servers.
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)([^/?#]+)/i, (_match, scheme: string, host: string) => scheme + host.toLowerCase())
    .replace(/\/+$/, '');
}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /\.local$/i,
];

/** Private/LAN addresses are almost always plain HTTP (self-signed certs are worse than
 * useless on a TV), while a public hostname is usually HTTPS. This only decides which scheme
 * to *try first* - both are always attempted. */
function isPrivateHost(host: string): boolean {
  const hostname = host.split(/[:/]/, 1)[0];
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

/** Ordered list of URLs to try for a server URL the user typed - covers a bare hostname with
 * no scheme, and a server that has since moved between http/https from what's typed/stored. */
export function getServerUrlCandidates(serverUrl: string): string[] {
  const normalized = normalizeServerUrl(serverUrl);
  if (!normalized) {
    return [];
  }

  if (/^https?:\/\//i.test(normalized)) {
    const alternate = /^http:\/\//i.test(normalized)
      ? normalized.replace(/^http:/i, 'https:')
      : normalized.replace(/^https:/i, 'http:');
    return [normalized, alternate];
  }

  return isPrivateHost(normalized) ? [`http://${normalized}`, `https://${normalized}`] : [`https://${normalized}`, `http://${normalized}`];
}
