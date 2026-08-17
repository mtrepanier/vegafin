import { Jellyfin } from '@jellyfin/sdk';
import type { Api } from '@jellyfin/sdk/lib/api';

/**
 * Thin wrapper around the official @jellyfin/sdk, playing the role of the injected
 * `Jellyfin`/`ApiClient` singletons from ServerRepository.kt. A single `Api` instance is
 * kept and repointed at a new base URL/access token on login/logout/user switch, matching
 * `apiClient.update(baseUrl, accessToken)` on the Kotlin side.
 */
class JellyfinClient {
  readonly jellyfin: Jellyfin;
  private _api: Api | null = null;

  constructor() {
    this.jellyfin = new Jellyfin({
      clientInfo: { name: 'VegaFin', version: '0.0.1' },
      deviceInfo: {
        name: 'Vega Device',
        // TODO(Phase 1): source a stable per-install id, e.g. via kepler-identifiers.
        id: 'vegafin-placeholder-device-id',
      },
    });
  }

  get api(): Api {
    if (!this._api) {
      throw new Error('JellyfinClient.update(serverUrl) must be called before use');
    }
    return this._api;
  }

  update(serverUrl: string | null, accessToken: string | null = null): Api | null {
    if (!serverUrl) {
      this._api = null;
      return null;
    }
    if (!this._api || this._api.basePath !== serverUrl) {
      this._api = this.jellyfin.createApi(serverUrl);
    }
    this._api.accessToken = accessToken ?? '';
    return this._api;
  }
}

export const jellyfinClient = new JellyfinClient();
