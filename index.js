// Kepler's native `URL` works fine on its own - confirmed against AmbientFlare/astra-tv, a
// separate Jellyfin-for-Vega client that constructs `new URL(...)` throughout its own service
// layer with no polyfill, including reading `url.searchParams` off those instances. Do not
// override global.URL: an earlier version of this file replaced it app-wide (as a workaround
// for a since-fixed, unrelated crash - see git history), and that replacement's `URL` made
// Shaka Player's manifest/segment resolution hang forever on every load().
//
// The one piece that IS broken natively is the *standalone* `new URLSearchParams(str)`
// constructor (as opposed to `.searchParams` read off a URL instance, which works) - the
// @jellyfin/sdk's internal `setSearchParams` helper uses exactly that standalone form for
// every GET request with query params, and every such request was silently going out with no
// query string at all, surfacing as a 400 from the server (confirmed via Quick Connect's
// `?secret=...` param vanishing). Polyfilling only URLSearchParams, and leaving native URL
// alone, fixes that without reintroducing the Shaka hang.
import { URLSearchParams } from 'whatwg-url-without-unicode';
global.URLSearchParams = URLSearchParams;

import { AppRegistry } from 'react-native';
import { App } from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
