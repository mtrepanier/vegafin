import { normalizeServerUrl, getServerUrlCandidates } from '../../../src/services/jellyfin/serverUrl';

describe('normalizeServerUrl', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeServerUrl('  http://example.com  ')).toBe('http://example.com');
  });

  it('lowercases the scheme', () => {
    expect(normalizeServerUrl('HTTP://example.com')).toBe('http://example.com');
    expect(normalizeServerUrl('Https://example.com')).toBe('https://example.com');
  });

  it('lowercases the host but preserves path case', () => {
    expect(normalizeServerUrl('http://Jelly.Example.COM/Web/Index.Html')).toBe('http://jelly.example.com/Web/Index.Html');
  });

  it('strips a single trailing slash', () => {
    expect(normalizeServerUrl('http://example.com/')).toBe('http://example.com');
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeServerUrl('http://example.com///')).toBe('http://example.com');
  });

  it('leaves a schemeless host mostly untouched aside from trim/slash-strip', () => {
    expect(normalizeServerUrl('  Example.com/  ')).toBe('Example.com');
  });

  it('preserves a port number', () => {
    expect(normalizeServerUrl('HTTP://192.168.1.5:8096/')).toBe('http://192.168.1.5:8096');
  });

  it('handles an empty string', () => {
    expect(normalizeServerUrl('')).toBe('');
  });
});

describe('getServerUrlCandidates', () => {
  it('returns an empty list for an empty input', () => {
    expect(getServerUrlCandidates('')).toEqual([]);
  });

  it('returns an empty list for a whitespace-only input', () => {
    expect(getServerUrlCandidates('   ')).toEqual([]);
  });

  it('tries http before https for a schemeless localhost host', () => {
    expect(getServerUrlCandidates('localhost:8096')).toEqual(['http://localhost:8096', 'https://localhost:8096']);
  });

  it('tries http before https for schemeless private IPv4 ranges', () => {
    expect(getServerUrlCandidates('127.0.0.1')).toEqual(['http://127.0.0.1', 'https://127.0.0.1']);
    expect(getServerUrlCandidates('10.0.0.5')).toEqual(['http://10.0.0.5', 'https://10.0.0.5']);
    expect(getServerUrlCandidates('192.168.1.20')).toEqual(['http://192.168.1.20', 'https://192.168.1.20']);
    expect(getServerUrlCandidates('172.20.0.4')).toEqual(['http://172.20.0.4', 'https://172.20.0.4']);
  });

  it('does not treat 172.x addresses outside the 16-31 second octet range as private', () => {
    expect(getServerUrlCandidates('172.15.0.4')).toEqual(['https://172.15.0.4', 'http://172.15.0.4']);
    expect(getServerUrlCandidates('172.32.0.4')).toEqual(['https://172.32.0.4', 'http://172.32.0.4']);
  });

  it('tries http before https for a .local hostname', () => {
    expect(getServerUrlCandidates('myserver.local')).toEqual(['http://myserver.local', 'https://myserver.local']);
  });

  it('does not detect a bare IPv6 loopback as private, since the host/port split cuts at the first colon', () => {
    expect(getServerUrlCandidates('::1')).toEqual(['https://::1', 'http://::1']);
  });

  it('tries https before http for a schemeless public hostname', () => {
    expect(getServerUrlCandidates('jellyfin.example.com')).toEqual(['https://jellyfin.example.com', 'http://jellyfin.example.com']);
  });

  it('only checks the hostname portion, not the port, for private-host detection', () => {
    expect(getServerUrlCandidates('example.com:10168')).toEqual(['https://example.com:10168', 'http://example.com:10168']);
  });

  it('adds the https alternate when given an explicit http URL', () => {
    expect(getServerUrlCandidates('http://jellyfin.example.com')).toEqual(['http://jellyfin.example.com', 'https://jellyfin.example.com']);
  });

  it('adds the http alternate when given an explicit https URL', () => {
    expect(getServerUrlCandidates('https://jellyfin.example.com')).toEqual(['https://jellyfin.example.com', 'http://jellyfin.example.com']);
  });

  it('normalizes case/whitespace/trailing-slash before building candidates', () => {
    expect(getServerUrlCandidates('  HTTPS://Jellyfin.Example.COM/  ')).toEqual([
      'https://jellyfin.example.com',
      'http://jellyfin.example.com',
    ]);
  });
});
