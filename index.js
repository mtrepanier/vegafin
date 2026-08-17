// @jellyfin/sdk's generated client needs URL/URLSearchParams on the global scope, which
// React Native (and Vega's RN fork) only partially implement. Must be the first import.
//
// react-native-url-polyfill's own URL export reads NativeModules.BlobModule at import
// time for its (unused here) createObjectURL support, which on Kepler throws
// "__fbBatchedBridgeConfig is not set" before global.nativeModuleProxy is wired up. Its
// underlying whatwg-url-without-unicode package is pure JS with no such native touch, so
// import that directly instead.
import { URL, URLSearchParams } from 'whatwg-url-without-unicode';
global.URL = URL;
global.URLSearchParams = URLSearchParams;

import { AppRegistry } from 'react-native';
import { App } from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
