# Third-party notices

VegaFin is licensed under the [MIT License](LICENSE). It depends on and, in one case, bundles
third-party software under its own license terms, reproduced below.

## Shaka Player (bundled)

`src/w3cmedia/shakaplayer/dist/shaka-player.compiled.js` and `shaka-player.compiled.d.ts` are a
compiled build of [Shaka Player](https://github.com/shaka-project/shaka-player), used to
implement DASH/HLS playback via Kepler's `IW3cmedia` module. Unmodified, redistributed as-is.

```
Copyright 2016 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## npm dependencies

VegaFin's other dependencies (React, React Native, `@jellyfin/sdk`, and supporting libraries)
are pulled in via npm at build time and are not redistributed as part of this repository -
`node_modules/` is gitignored. Their licenses are declared in their own `package.json`/`LICENSE`
files; notably `@jellyfin/sdk` is MPL-2.0 (used unmodified as a dependency, not incorporated into
this repo's own source).

The `@amazon-devices/*` packages (Kepler/Vega SDK modules, installed from Amazon's own registry
as part of the Vega OS toolchain) are covered by Amazon's own developer program terms rather than
an OSS license - see each package's bundled `LICENSE` file under `node_modules/@amazon-devices/`
after installing. They are a build-time dependency of the Vega SDK, not something this repository
redistributes.
