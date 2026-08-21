import { DUMMY_BASE_URL, setSearchParams, toPathString } from '@jellyfin/sdk/lib/generated-client/common';

/**
 * Regression test for patches/@jellyfin+sdk+*.patch. Every generated API method with query
 * params (home rows, library sorting/pagination/filtering, Quick Connect, ...) builds its
 * request URL via exactly this setSearchParams() + toPathString() pair, and the unpatched
 * version silently drops every param on Vega's native URL implementation (url.search = string
 * is a no-op there). That platform bug can't be reproduced under Jest/Node - URL.prototype
 * behaves correctly here - so this test can't catch a regression *of the platform quirk*
 * itself. What it does guard is the patch's own logic: since the fix works by stashing the
 * computed query string on a plain url.__vegafinSearch property instead of trusting
 * url.search/url.searchParams at all, it's easy to silently break by "cleaning up" what looks
 * like a redundant computation. This pins the exact input/output contract that the rest of
 * the app's networking depends on.
 */
describe('@jellyfin/sdk setSearchParams/toPathString (patched)', () => {
  it('includes every query param in the final path string', () => {
    const url = new URL('/Items/Latest', DUMMY_BASE_URL);
    setSearchParams(url, { userId: 'user-1', parentId: 'lib-1', limit: 20 });
    expect(toPathString(url)).toBe('/Items/Latest?userId=user-1&parentId=lib-1&limit=20');
  });

  it('produces a bare path with no query string when there are no params', () => {
    const url = new URL('/Items/Latest', DUMMY_BASE_URL);
    setSearchParams(url, {});
    expect(toPathString(url)).toBe('/Items/Latest');
  });

  it('merges params across multiple objects, matching the generated client\'s own call shape', () => {
    const url = new URL('/Items/Latest', DUMMY_BASE_URL);
    setSearchParams(url, { userId: 'user-1' }, { limit: 5 });
    expect(toPathString(url)).toBe('/Items/Latest?userId=user-1&limit=5');
  });

  it('repeats the key for array-valued params (e.g. includeItemTypes)', () => {
    const url = new URL('/Items/Latest', DUMMY_BASE_URL);
    setSearchParams(url, { includeItemTypes: ['Movie', 'Series'] });
    expect(toPathString(url)).toBe('/Items/Latest?includeItemTypes=Movie&includeItemTypes=Series');
  });

  it('preserves the hash', () => {
    const url = new URL('/Items/Latest#section', DUMMY_BASE_URL);
    setSearchParams(url, { limit: 5 });
    expect(toPathString(url)).toBe('/Items/Latest?limit=5#section');
  });
});
