# VegaFin

A Jellyfin TV client for Amazon's **Vega OS** (the Linux-based successor to Fire OS, built on
**React Native for Vega**, the platform formerly called "Kepler").

VegaFin is **inspired by** [Wholphin](https://github.com/damontecres/Wholphin) — an Android TV
Jellyfin client — but is its own independent project, not a port or a fork: it's a
from-scratch React Native/TypeScript codebase, and none of Wholphin's Kotlin/Compose code
runs here. Early architecture and UI decisions borrowed heavily from Wholphin as a reference
(and some code comments still point at the specific Kotlin file that inspired a given piece,
useful provenance for anyone cross-referencing the two), but VegaFin is free to diverge where
Vega OS's platform, form factor, or product direction calls for something different.

Wholphin's source, if you want to compare, lives at
[damontecres/Wholphin](https://github.com/damontecres/Wholphin) and is referenced in some
code comments as "the Kotlin source."

## Status: Phase 1 (home, library, detail, playback)

Phase 0's scaffold (navigation graph, auth/session, theming) is done, and Phase 1 now adds:

- A **focus-managed card/row system** (`components/ItemRow.tsx`, `components/ItemGrid.tsx`,
  `components/cards/`) built on native `TVFocusGuideView`/`hasTVPreferredFocus` rather than any
  custom D-pad plumbing — see [Focus system](#focus-system) below.
- The **Home screen**, with a fixed set of rows (Continue Watching + Next Up combined, one
  Recently Added row per library) rather than Kotlin's user-configurable row settings, which is
  Phase 2 territory.
- **Library grid/list browsing** (`FilteredCollection`/`ItemGrid`/`MoreHomeRow`/`Favorites`),
  with sort and a grid/list view toggle.
- **Detail pages** for Movie, Episode, Collection (box set), and Person, plus a full
  binge-style `SeriesOverview` page (season tabs + focused-episode header/footer + episode row)
  for series browsing generally — Phase 1 didn't build the classic non-binge `SeriesDetails`.
- **Core playback**: direct play → direct stream → transcode negotiation, resume position, 5s
  progress reporting, and basic controls (play/pause/seek via the native player chrome, plus a
  custom audio/subtitle track picker) via `@amazon-devices/react-native-w3cmedia`'s
  `VideoPlayer`/`KeplerVideoView` — see the correction below.

Still not implemented: settings screens, search, subtitle customization/delay, trickplay, skip
intro/outro, live TV, music playback, Seerr/Jellyseerr discover. See [Roadmap](#roadmap).

### Correction: no Shaka Player

An earlier draft of this README said playback would use "Shaka Player for adaptive
streaming." That's wrong: there is no Shaka Player, and no JS ABR/manifest-parsing library at
all, anywhere in this project's dependency tree. `@amazon-devices/react-native-w3cmedia`'s
`VideoPlayer` implements the standard W3C `HTMLVideoElement` interface — `src` is a plain
string setter, exactly like a browser `<video>` tag — so HLS/DASH URLs returned by Jellyfin's
`PlaybackInfo` negotiation are simply assigned to `videoPlayer.src`, and adaptive
bitrate/manifest parsing happens natively on the device. See `services/jellyfin/playback.ts`.

### Focus system

Compose TV's D-pad focus model (`Modifier.focusGroup()` + `focusRestorer()` +
`focusProperties { onEnter }`) has no direct RN equivalent, but the underlying idea —
remember which child last had focus, restore it on re-entry — turns out not to need custom
focus-redirection logic on Vega. The native TV primitives already in `react-native-kepler`
cover it directly:

- `hasTVPreferredFocus`, set dynamically on whichever card a row/grid last remembered focusing
  (`focus/useLastFocusedIndex.ts`), is what the platform's focus engine actually honors on
  re-entry — no `TVFocusGuideView.destinations` ref-juggling required for the common case.
- `TVFocusGuideView` (`focus/FocusGroup.tsx`) is used more narrowly, to trap focus at a row's
  or grid's edges (`trapFocusUp/Down/Left/Right`) rather than to redirect it.
- Rows/grids scroll the remembered card into view themselves (`FlatList.scrollToIndex`) rather
  than relying on any built-in "bring into view" behavior.

### SDK-verified

This scaffold started as a hand-built guess (no Vega SDK access), then got corrected against
the real thing. With the Vega SDK installed (0.24.9914) and `vega project generate --template
helloWorld` run as a reference, several of the original guesses turned out wrong and were
fixed — most importantly, module resolution does **not** work the way the first draft assumed
(see [How Vega package resolution actually works](#how-vega-package-resolution-actually-works)).
The scaffold now:

- Installs clean: `npm install` — no `ERESOLVE` conflicts, no `.npmrc` overrides needed.
- Passes `npm run typecheck` (`tsc --noEmit`) and `npm run lint` (0 errors; the ~29 remaining
  warnings are Amazon's own informational "system distributed library" notices and a couple of
  minor style nits — see below).
- **Actually builds**: `npm run build:debug` produces real, valid `.vpkg` packages for all
  three architectures (aarch64, armv7, x86_64) via `react-native build-vega`, and
  `manifest.toml`'s `[needs.module]` list is auto-populated by the build's autolinking step
  from `package.json` — don't hand-edit that section, just rebuild after changing dependencies.
- Requires **Node.js ≥ 22** (`@amazon-devices/react-native-kepler` requires `>= 22.14.0`,
  and Metro's terminal reporter needs `util.styleText`, added after Node 20.11). Use
  `nvm install --lts && nvm alias default 'lts/*'` if you're on an older Node.

Not yet verified: actually launching on a Vega Virtual Device or physical Fire TV device
(`vega virtual-device start` + `vega run-app`) — the build artifacts exist but haven't been
booted. That remains the reasonable next step to actually exercise Phase 1's UI/focus/playback
behavior, none of which can be verified by `typecheck`/`lint` alone.

## Architecture map

| Concern | Kotlin source | This repo |
|---|---|---|
| Navigation graph | `ui/nav/Destination.kt` | `src/navigation/types.ts` (param lists), `src/navigation/RootNavigator.tsx`, `MainDrawerNavigator.tsx` |
| Session/auth | `data/ServerRepository.kt` | `src/services/storage/ServerRepository.ts` |
| Server/user models | `data/model/JellyfinServer.kt` | `src/services/storage/types.ts` |
| Jellyfin API access | Jellyfin Kotlin SDK | `src/services/jellyfin/JellyfinClient.ts`, `images.ts`, `homeRows.ts`, `library.ts`, `detail.ts`, `playback.ts` (`@jellyfin/sdk`) |
| Theming | `ui/theme/Theme.kt`, `ui/theme/colors/*.kt` | `src/theme/ThemeContext.tsx`, `src/theme/palettes/*.ts`, `src/theme/types.ts` (layout tokens) |
| Setup/login screens | `ui/setup/*.kt` | `src/screens/setup/*.tsx` |
| Focus-managed cards/rows | `ui/cards/`, `ui/detail/CardGrid.kt` | `src/components/{ItemRow,ItemGrid,PosterRow}.tsx`, `src/components/cards/`, `src/focus/` |
| Home | `ui/main/HomePage.kt` | `src/screens/HomeScreen.tsx` |
| Library browsing | `ui/components/CollectionFolderView.kt` | `src/screens/library/LibraryScreens.tsx`, `src/screens/FavoritesScreen.tsx` |
| Detail pages | `ui/detail/{movie,episode,collection,series}/*`, `PersonPage.kt` | `src/screens/MediaItemScreen.tsx`, `src/screens/detail/`, `src/screens/SeriesOverviewScreen.tsx` |
| Playback | `ui/playback/PlaybackViewModel.kt`, `util/TrackActivityPlaybackListener.kt` | `src/screens/playback/PlaybackScreens.tsx`, `src/services/jellyfin/playback.ts` |
| Everything else (live TV, music, Seerr/Jellyseerr discover) | `ui/discover/`, live TV/music screens | not started — Phase 2/3 |

### Navigation

Wholphin's `Destination` sealed class carries a `fullScreen` flag that decides whether a
screen shows the persistent nav drawer + blurred backdrop chrome, or takes over the whole
screen. This repo keeps that same split:

- **`DrawerParamList`** (`fullScreen = false` in the Kotlin source) — `Home`, `Search`,
  `SeriesOverview`, `MediaItem`, `Recordings`, `FilteredCollection`, `ItemGrid`,
  `MoreHomeRow`, `Favorites`, `Discover`, `DiscoveredItem`, `DiscoverMoreResult`. Rendered
  inside `MainDrawerNavigator` (`@amazon-devices/react-navigation__drawer`), matching `NavDrawer.kt` +
  `Backdrop.kt`. Only a handful of these show up as literal menu items in the drawer's
  `drawerContent` (matching what `NavDrawer.kt` actually shows) — the rest are pushed onto
  the same navigator from elsewhere in the app so they keep the drawer/backdrop chrome
  without cluttering the menu.
- **`RootStackParamList`** (`fullScreen = true`) — `Settings`, `SubtitleSettings`,
  `Playback`, `PlaybackList`, `Slideshow`, `NowPlaying`, etc. Pushed as bare full-screen
  stack screens over `Main` (which hosts the drawer navigator).
- **`SetupStackParamList`** — the pre-auth flow (`ServerList` → `UserList` → `PinEntry`),
  mirroring `SetupNavigationManager.kt`'s separate back stack.

`src/App.tsx` mirrors `MainActivity.kt`: it boots the session (`ServerRepository.init()`),
then renders `SetupNavigator` or `RootNavigator` depending on whether a session restored.

### Auth/session

`ServerRepository.ts` ports `ServerRepository.kt`'s responsibilities: add a server, sign in
a user, restore a session on relaunch, remove a server/user, switch users. Room + a
`StateFlow` become a JSON blob in `AsyncStorage` plus a plain subscriber list, exposed to
React via `useSyncExternalStore` in `ServerRepositoryContext.tsx`. This is intentionally
simple for Phase 0 — if the server/user list ever grows large enough for JSON-blob
read/write to matter, swap in `@amazon-devices/react-native-mmkv` (already used elsewhere
in the Vega ecosystem) rather than reaching for a full SQLite/Room equivalent.

PIN-protected profiles (`JellyfinUser.pin`) are supported end-to-end: `restoreSession()`
returns `null` if the resolved user has a PIN set, and the setup flow should route to
`PinEntryScreen` in that case (this routing isn't wired up yet — `App.tsx` currently only
distinguishes "no session" vs "session," not "session needs a PIN").

### Theming

All 8 palettes from `ui/theme/colors/*.kt` (Purple — the default, Blue, Bold Blue, Brown,
Green, OLED Black, Orange, Red) are ported with their real hex values, light and dark
variants, in `src/theme/palettes/`. `useTheme()` (`ThemeContext.tsx`) is the equivalent of
reading `LocalTheme`/`MaterialTheme.colorScheme` in Compose. Only the `purple` (default)
scheme is wired up as the active theme right now — a settings screen to switch palettes is
Phase 2 work, matching `AppThemeColors` preference handling.

## How Vega package resolution actually works

**Correction**: an earlier draft of this scaffold assumed community package names (like
`'@react-navigation/native'`) get silently swapped for their `@amazon-devices/*` port at
bundle time via `@amazon-devices/kepler-module-resolver-preset`. That's wrong for a normal
Vega app — diffing against a real `vega project generate --template helloWorld` output showed
that preset isn't part of the generated project at all. (It exists for a narrower case:
sharing source with an *existing* iOS/Android app that already hardcodes community import
names — see its own README. Not this app's situation.)

**What's actually true, confirmed by a real build**:

- `react-native` itself is a genuine plain dependency (`"react-native": "0.83.0"`) installed
  *alongside* `"@amazon-devices/react-native-kepler": "~4.0.0"`. The Vega CLI/Metro toolchain
  (via the `@amazon-devices/kepler-cli-platform` devDependency, which plugs into
  `@react-native-community/cli`) resolves `import ... from 'react-native'` to the kepler
  package automatically when you run `react-native start`/`build-vega`. Jest doesn't go
  through that CLI plugin, so `jest.config.json` maps it explicitly via `moduleNameMapper`.
- Every other Vega-specific library is imported **directly by its real
  `@amazon-devices/*` name** — there is no aliasing for these. `@react-navigation/native`
  is not a dependency of this project at all; source imports
  `'@amazon-devices/react-navigation__native'` directly, confirmed against Amazon's own
  React Native for Vega navigation docs and by a successful build. Same pattern for
  `@amazon-devices/react-native-screens`, `@amazon-devices/react-native-async-storage__async-storage`,
  `@amazon-devices/react-native-reanimated`, `@amazon-devices/react-native-w3cmedia`, etc.
- `babel.config.js` and `metro.config.js` are the **stock, unmodified** RN config
  (`module:@react-native/babel-preset`, `@react-native/metro-config`'s `getDefaultConfig`) —
  no custom resolver plugins needed.
- `package.json`'s `"kepler"` field (`projectType`, `appName`, `targets`) and
  `@amazon-devices/*` dependency version ranges (`~`, not `^` — enforced by
  `@amazon-devices/eslint-plugin-kepler`'s `sdl-package-version-check` rule: these are
  "system distributed libraries" already present on-device, and a `^` range risking a
  minor/major bump could pull in a version the device doesn't have) feed the manifest
  autolinker.
- `manifest.toml`'s `[needs.module]` list is **generated, not hand-written** — `npm run
  build:debug`/`build:release` autolinks it from `package.json` dependencies and rewrites
  the file in place. After adding a dependency that ships a Vega native module, rebuild once
  to pick it up rather than editing the list by hand.
- The entry file must be named exactly `index.js` (not `.js`'s TS equivalent) — the build
  tool's `findEntryFiles` only recognizes `index.js`, `service.js`, or `task.js` at the
  project root. `src/` can and does stay TypeScript; only the root registration file can't.

If you see an `sdl-package-version-check-imports` **warning** (not error) on an
`@amazon-devices/*` import, that's expected and informational — see the linked docs if you
want to silence it once you understand the implication (device fleets on an older OS version
may not have that system library yet).

## Getting started

Requires Node.js ≥ 22 and the [Vega SDK](https://developer.amazon.com/docs/vega/latest/install-vega-sdk.html)
(Amazon developer account required) for the `vega`/`build-vega` commands:

```bash
curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh | bash && source ~/vega/env
vega --version   # confirm it's on PATH
```

Then, from this directory:

```bash
npm install
npm run typecheck        # tsc --noEmit
npm run lint

npm run build:debug      # produces a .vpkg per architecture under build/<arch>-debug/
npm run build:release    # release build

# Not yet exercised by this scaffold, but the documented next step:
vega virtual-device start
vega run-app build/aarch64-debug/vegafin_aarch64.vpkg
```

(The `.vpkg` filename derives from `package.json`'s `name` field, now `vegafin` after the
rename from `wholphin-vega` — unverified in this environment since `build:debug` couldn't run
here, so double check the actual filename build-vega produces once you run it.)

## Roadmap

- **Phase 1** (done) — Home page rows, library grid/list browsing, Movie/Episode/
  Collection/Person detail pages plus a binge-style Series overview, core playback
  (`@amazon-devices/react-native-w3cmedia`'s native `VideoPlayer`, direct play/stream/
  transcode negotiation, resume position, basic controls), and a focus-managed card/row
  system built on native `TVFocusGuideView`/`hasTVPreferredFocus` (see
  [Focus system](#focus-system)). Deliberately out of Phase 1's scope: user-configurable home
  rows, alphabet-jump library browsing, trickplay, skip intro/outro, subtitle
  search/download/delay, WebSocket remote-control commands — see the scope notes throughout
  `src/services/jellyfin/` and `src/screens/`.
- **Phase 2** — Settings screens, search, subtitle customization, trickplay, skip
  intro/outro, multi-server/user switching UI, PIN-lock routing.
- **Phase 3** — Live TV guide + DVR, music playback (now playing/visualizer/lyrics),
  Jellyseerr discover integration, screensaver/slideshow, photo albums.

## Project layout

```
src/
  App.tsx                     Root component: theme + session bootstrap + navigator switch
  navigation/                 Route graph (mirrors ui/nav/Destination.kt), navigateToItem.ts
  theme/                      Color palettes + ThemeContext (mirrors ui/theme/) + layout tokens
  focus/                      FocusGroup.tsx, useLastFocusedIndex.ts - see Focus system above
  services/
    jellyfin/                 JellyfinClient.ts (@jellyfin/sdk wrapper), images.ts, ItemPager.ts,
                               homeRows.ts, library.ts, detail.ts, playback.ts
    storage/ServerRepository.ts   Session/auth (mirrors data/ServerRepository.kt)
  components/                 ItemRow/ItemGrid/PosterRow, cards/, IconButton.tsx
  screens/
    HomeScreen.tsx, FavoritesScreen.tsx, SeriesOverviewScreen.tsx, MediaItemScreen.tsx
    library/                  FilteredCollection/ItemGrid/MoreHomeRow screens
    detail/                   Movie/Episode/Collection/Person detail, series/ (SeriesOverview parts)
    playback/                 PlaybackScreen, PlaybackListScreen
  types/                      Ambient .d.ts augmentations (react-native-kepler/vector-icons gaps)
index.js                       AppRegistry entry point (must be .js - see build note above)
app.json                       App name; must match manifest.toml's main component id
manifest.toml                  Vega app manifest ([needs.module] is autolinked, not hand-written)
```
