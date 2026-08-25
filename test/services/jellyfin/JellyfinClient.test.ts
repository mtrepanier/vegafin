import type { Api } from '@jellyfin/sdk/lib/api';
import type { jellyfinClient as JellyfinClientSingleton } from '../../../src/services/jellyfin/JellyfinClient';

describe('JellyfinClient.update', () => {
  let jellyfinClient: typeof JellyfinClientSingleton;

  beforeEach(() => {
    jest.resetModules();
    jellyfinClient = require('../../../src/services/jellyfin/JellyfinClient').jellyfinClient;
  });

  it('throws from the api getter before update() has been called', () => {
    expect(() => jellyfinClient.api).toThrow('JellyfinClient.update(serverUrl) must be called before use');
  });

  it('returns null and clears the api when called with a null serverUrl', () => {
    jellyfinClient.update('https://example.com', 'token');
    const result = jellyfinClient.update(null);
    expect(result).toBeNull();
    expect(() => jellyfinClient.api).toThrow();
  });

  it('defaults to https when the stored url has no scheme', () => {
    const api = jellyfinClient.update('example.com') as Api;
    expect(api.basePath).toBe('https://example.com');
  });

  it('keeps an explicit http scheme rather than defaulting to https', () => {
    const api = jellyfinClient.update('http://example.com') as Api;
    expect(api.basePath).toBe('http://example.com');
  });

  it('keeps an explicit https scheme', () => {
    const api = jellyfinClient.update('https://example.com') as Api;
    expect(api.basePath).toBe('https://example.com');
  });

  it('normalizes case and trailing slash on the resolved url', () => {
    const api = jellyfinClient.update('HTTPS://Example.com/') as Api;
    expect(api.basePath).toBe('https://example.com');
  });

  it('does not lowercase a schemeless host, since normalizeServerUrl only lowercases hosts that already follow a scheme', () => {
    const api = jellyfinClient.update('Example.COM') as Api;
    expect(api.basePath).toBe('https://Example.COM');
  });

  it('sets the access token, defaulting to an empty string when none is given', () => {
    const withToken = jellyfinClient.update('https://example.com', 'abc123') as Api;
    expect(withToken.accessToken).toBe('abc123');

    const withoutToken = jellyfinClient.update('https://example.com') as Api;
    expect(withoutToken.accessToken).toBe('');
  });

  it('reuses the same Api instance when the resolved url is unchanged', () => {
    const first = jellyfinClient.update('https://example.com', 'token-a');
    const second = jellyfinClient.update('https://example.com', 'token-b');
    expect(second).toBe(first);
    expect(second?.accessToken).toBe('token-b');
  });

  it('creates a new Api instance when the resolved url changes', () => {
    const first = jellyfinClient.update('https://example.com');
    const second = jellyfinClient.update('https://other.example.com');
    expect(second).not.toBe(first);
    expect(second?.basePath).toBe('https://other.example.com');
  });

  it('treats two urls that resolve to the same normalized form as unchanged', () => {
    const first = jellyfinClient.update('https://Example.com/');
    const second = jellyfinClient.update('HTTPS://example.com');
    expect(second).toBe(first);
  });
});

describe('JellyfinClient.createApiFor', () => {
  let jellyfinClient: typeof JellyfinClientSingleton;

  beforeEach(() => {
    jest.resetModules();
    jellyfinClient = require('../../../src/services/jellyfin/JellyfinClient').jellyfinClient;
  });

  it('builds a standalone Api instance with the given url and token, normalized the same way as update()', () => {
    const api = jellyfinClient.createApiFor('example.com', 'user-token');
    expect(api.basePath).toBe('https://example.com');
    expect(api.accessToken).toBe('user-token');
  });

  it('defaults the access token to an empty string when null', () => {
    const api = jellyfinClient.createApiFor('https://example.com', null);
    expect(api.accessToken).toBe('');
  });

  it('does not share state with the shared singleton api or with other created instances', () => {
    jellyfinClient.update('https://example.com', 'shared-token');
    const a = jellyfinClient.createApiFor('https://example.com', 'token-a');
    const b = jellyfinClient.createApiFor('https://example.com', 'token-b');

    expect(a).not.toBe(jellyfinClient.api);
    expect(a).not.toBe(b);
    expect(a.accessToken).toBe('token-a');
    expect(b.accessToken).toBe('token-b');
    expect(jellyfinClient.api.accessToken).toBe('shared-token');
  });
});
