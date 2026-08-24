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
- A **collapsible side nav** (avatar/username/server, Search/Home/Favorites, one row per
  library, all with icons) that expands on focus and collapses otherwise, with full D-pad
  travel between it and the main content — see [Side nav](#side-nav-maindrawernavigatortsx)
  under Navigation below.
- The **Home screen** ("My Media"), with a library-shortcut row at the top (artwork + name per
  library, linking straight to that library's full grid) followed by a fixed set of rows —
  separate Continue Watching and Next Up rows (an earlier version merged them client-side with
  a SeriesId dedup, which just meant genuinely in-progress items got crowded out whenever a
  same-series "next up" entry happened to load first — split apart to match the server's own
  `/Items/Resume` and `/Shows/NextUp` results directly), one Recently Added row per library —
  rather than Kotlin's user-configurable row settings, which is Phase 2 territory.
- **Library grid/list browsing** (`FilteredCollection`/`ItemGrid`/`MoreHomeRow`/`Favorites`),
  with sort and a grid/list view toggle.
- **Detail pages** for Movie, Episode, Collection (box set), and Person, plus a full
  binge-style `SeriesOverview` page (season tabs + focused-episode header/footer + episode row)
  for series browsing generally — Phase 1 didn't build the classic non-binge `SeriesDetails`.
- **Core playback**: `negotiatePlayback` always forces server-side HLS transcoding (see the
  correction below for why direct play was dropped), resume position, 5s progress reporting,
  full remote-control input (play/pause, fast-forward/rewind, back, all confirmed working on
  the Vega Virtual Device), a custom on-screen title/play-pause/progress-bar/track-picker UI
  that auto-hides after 5s of inactivity (matching the Android client's behavior), and Quick
  Connect sign-in alongside username/password. See the correction below for the actual player
  architecture — it's not what an earlier draft of this README described.

Still not implemented: settings screens, search, subtitle customization/delay, trickplay, skip
intro/outro, live TV, music playback, Seerr/Jellyseerr discover. See [Roadmap](#roadmap).

### Correction: playback uses KeplerVideoSurfaceView + a vendored Shaka Player, not KeplerVideoView

Two earlier drafts of this README each got playback wrong in opposite directions — worth
recording both since the real answer is easy to reinvent-and-reject a second time.

The first draft assumed Shaka Player. The second draft "corrected" that to say playback was
simple native-`<video>`-style delegation: `@amazon-devices/react-native-w3cmedia`'s
`KeplerVideoView` wrapper with `src` assigned directly, no JS-side ABR/manifest parsing
anywhere. That did work, but only partially: `KeplerVideoView`'s built-in `showControls`
chrome never routed hardware remote events (play/pause, FF/RW, D-pad) to the player at all,
and direct-played raw files failed to seek at the native layer
(`DefaultMediaPlayer.cpp seekWithRate: Seek failed. Internal error 0`).

The actual, current architecture (confirmed working end-to-end on the Vega Virtual Device):

- `negotiatePlayback` (`services/jellyfin/playback.ts`) always requests transcoded HLS
  (`EnableDirectPlay: false, EnableDirectStream: false`) — HLS's segment-based seeking works
  reliably where raw-file byte-range seeking didn't.
- `KeplerVideoSurfaceView` (the w3cmedia README's "pre-buffering mode": a manual
  surface-handle handshake, `onSurfaceViewCreated`/`onSurfaceViewDestroyed`) replaces
  `KeplerVideoView`, paired with a bare `VideoPlayer` instance and fully custom on-screen
  controls (`screens/playback/PlaybackScreens.tsx`) — this is what makes hardware remote
  events (via `useTVEventHandler`) actually reach the player.
- A vendored, compiled Shaka Player (`src/w3cmedia/shakaplayer/`, MSE-based adaptive
  streaming) drives HLS playback, wrapped by `ShakaPlayer.ts` and a set of DOM/URL/fetch
  polyfills (`src/w3cmedia/polyfills/`) needed to run Shaka in Kepler's JS environment. This
  whole `src/w3cmedia/` tree was ported from a separate, already-working Jellyfin-for-Vega
  client rather than written from scratch, and is excluded from lint (`.eslintrc`
  `ignorePatterns`) since it's vendored/compiled, not hand-written.

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
- Scrolling the focused card into view is left entirely to the platform's own
  `focusItemAlignment="start"` prop (set on every `ScrollView`/`FlatList` in this codebase —
  type-augmented in `src/types/react-native-augmentations.d.ts` since stock RN's types don't
  know about it). An earlier version also drove an explicit `FlatList.scrollToIndex` from
  `ItemRow`'s own `onFocus`, redundant with `focusItemAlignment`; the two scroll computations
  disagreeing slightly left the newly-focused card only partially in view instead of flush,
  so that manual call was removed.

**Gotcha #1 — pages opening scrolled away from the top.** Vega's native TV focus engine
auto-scrolls the nearest scrollable ancestor to reveal whichever element first receives
`hasTVPreferredFocus`, and its default alignment behaves like "center" rather than "start" —
confirmed by `ScrollViewPropsKepler`'s `focusItemAlignment` prop existing at all (see above).
Setting `focusItemAlignment="start"` everywhere fixes alignment *within* a given scrollable,
but on its own doesn't stop a *parent* `ScrollView` from scrolling down to reveal a
below-the-fold focused row in the first place. `focus/usePinScrollToStart.ts` is the
belt-and-suspenders fix for that: it repeatedly re-asserts scroll position 0 on an interval
for a short window after each screen mounts (a single delayed correction was tried first and
lost the race against a later native auto-scroll pass, e.g. as poster images finished loading
and shifted layout), and is wired into every page-level `ScrollView` plus `ItemRow`/`ItemGrid`
— skipping itself wherever a deliberate deep-link target exists (e.g. `EpisodeRow` jumping
straight to a specific episode), so it doesn't fight genuinely intentional initial scroll.

**Gotcha #2 — the actual root cause on Home, more fundamental than #1.** Every `ItemRow`/
`ItemGrid` on a screen independently defaults its own remembered focus index to 0 via
`useLastFocusedIndex`, so with nothing else guarding it, *every row on Home simultaneously
claimed* `hasTVPreferredFocus` on its own first card — the Play button, the Cast row's first
person, the "More Like This" row's first poster, all at once on a detail page; every row's
first card at once on Home. With multiple simultaneous claims, the platform resolves the
ambiguity to *some* element that isn't necessarily the intended one, and no amount of
scroll-position correction can fix that, since the actually-focused element (wherever the
engine picked) keeps getting re-revealed on every subsequent layout/focus event. The fix is an
`autoFocus` prop threaded through `ItemRow`, `ItemGrid`, `PosterRow`, `CastRow`, `SeasonTabs`,
and `DetailActionButtons` (default `true`, matching the old always-on behavior): exactly one
focusable region per screen now leaves it at the default, every other region on that same
screen explicitly passes `autoFocus={false}`. See each screen's call sites for which region
won that role (e.g. Home's library-shortcut row; a detail page's Play button; `SeriesOverview`'s
episode row rather than its season tabs or footer).

### SDK-verified

This scaffold started as a hand-built guess (no Vega SDK access), then got corrected against
the real thing. With the Vega SDK installed (0.24.9914) and `vega project generate --template
helloWorld` run as a reference, several of the original guesses turned out wrong and were
fixed — most importantly, module resolution does **not** work the way the first draft assumed
(see [How Vega package resolution actually works](#how-vega-package-resolution-actually-works)).
The scaffold now:

- Installs clean: `npm install` — no `ERESOLVE` conflicts, no `.npmrc` overrides needed.
- Passes `npm run typecheck` (`tsc --noEmit`) and `npm run lint` (0 errors, 0 warnings — the
  Amazon "system distributed library" notice is silenced repo-wide in `.eslintrc` via the
  plugin's own documented override, since it fired on essentially every `@amazon-devices/*`
  import; the version-range check that actually matters, `sdl-package-version-check`, stays on).
- **Actually builds**: `npm run build:debug` produces real, valid `.vpkg` packages for all
  three architectures (aarch64, armv7, x86_64) via `react-native build-vega`, and
  `manifest.toml`'s `[needs.module]` list is auto-populated by the build's autolinking step
  from `package.json` — don't hand-edit that section, just rebuild after changing dependencies.
- Requires **Node.js ≥ 22** (`@amazon-devices/react-native-kepler` requires `>= 22.14.0`,
  and Metro's terminal reporter needs `util.styleText`, added after Node 20.11). Use
  `nvm install --lts && nvm alias default 'lts/*'` if you're on an older Node.

**Verified on the Vega Virtual Device**: full app boot, sign-in (password and Quick Connect),
navigation/focus, and playback including remote-control play/pause/seek — all confirmed
working end-to-end via `vega virtual-device start` + `vega device install-app`/`launch-app`.
Testing has been scoped to the Virtual Device only; a physical Fire TV/Fire Stick has not been
tested against this codebase.

**App icon**: the manifest's `[package] icon` field takes a `@image/<filename>.png` reference,
not a plain path — `vpt validate` errors on anything else (`Icon names must follow
'@image/<icon_file_name>' format`), and the actual requirement (512x512 PNG, placed under
`assets/image/`) isn't in any SDK error message; it only turned up in the Vega app manifest
knowledge-base doc bundled with the "Kepler Studio" VS Code extension. `assets/image/icon.png`
+ `icon = "@image/icon.png"` in `manifest.toml` is what satisfies it.

**Icon fonts silently render nothing without a manual asset step**: `@amazon-devices/
react-native-vector-icons` doesn't autolink its font files the way it does on stock RN
(Xcode "Copy Bundle Resources" / Android's `fonts.gradle`) - on Kepler, `<Icon name="..." />`
just renders blank space unless the font file has separately been placed at
`assets/raw/fonts/<FontFamily>.ttf` in the project root (confirmed in the package's own
README, under its "Kepler" section - `react-native.config.js`'s autolinking comment doesn't
mention this at all, since it isn't an autolinking step). This project only uses
`MaterialIcons`, so `assets/raw/fonts/MaterialIcons.ttf` (copied from
`node_modules/@amazon-devices/react-native-vector-icons/Fonts/`) is the only one needed. This
had been silently broken since the very first `Icon` usage — every icon in the app was
rendering as nothing, not just a wrong glyph — and only became obvious once the side nav's
collapsed state left an icon-only row with nothing else to visually mask the gap.

### Native `URL`/`URLSearchParams` gotcha — and the `@jellyfin/sdk` patch that fixes it for real

Worth documenting at length since it cost significant debugging time across two separate
incidents, and the eventual fix is a patched dependency, which is easy to trip over later.

Kepler's native `URL` implementation works correctly for construction and reads — `new
URL(...)`, `.pathname`, `.hash`, `.searchParams` read off an instance — and `index.js` does
**not** polyfill or override `global.URL` (an earlier version did, as a workaround for an
unrelated crash, but that override made Shaka Player's manifest/segment resolution hang
forever on every `load()`).

What's broken is **writing** a query string back onto a `URL` instance, and it's broken in two
different ways stacked on top of each other:

1. The whole-string assignment `url.search = someString` silently no-ops.
2. Mutating `url.searchParams` directly (`.set()`/`.append()`/`.delete()`) *seems* like the
   fix — and is the pattern this codebase's own code uses successfully everywhere it builds
   URLs by hand — but it doesn't help here specifically because nothing downstream reads
   `.searchParams` back off the object. It's a red herring for this particular call path, not
   a working alternative.

The `@jellyfin/sdk`'s generated client hits both. Its shared `setSearchParams` helper
(`node_modules/@jellyfin/sdk/lib/generated-client/common.js`) is used by **every** generated
API method that takes query params — home rows, library sort/filter/pagination, Quick
Connect, all of it — and originally did `url.search = searchParams.toString()` (bug #1). A
separate `toPathString(url)` helper, called immediately afterward by each generated method to
build the final request URL, independently does `url.pathname + url.search + url.hash` — so
even switching `setSearchParams` to mutate `url.searchParams` instead (bug #2's trap) doesn't
fix anything, because `toPathString` was never going to read `.searchParams` in the first
place; it only ever looks at `.search`.

**First incident**: this surfaced as Quick Connect 400ing with `"secret field is required"`
even though the code was passing a `secret` param. Fixed narrowly at the time: `UserListScreen.tsx`'s
`getQuickConnectState` bypasses the generated method entirely and builds the request via
`api.getUri(path, params)` + `api.axiosInstance.get(...)` instead, which serializes query
params through axios rather than through the SDK's helper. That fix is still in place and
still works, but is now redundant given the patch below — it just hasn't been reverted.

**Second incident**: months of app usage later (in wall-clock terms of this project's
development, not necessarily yours), every "Latest X" row on the Home screen was showing
*identical* content regardless of library, because `getLatestMedia`'s `parentId` filter was
being silently dropped the same way. This is when the bug's real scope became clear — it
wasn't a Quick-Connect-specific quirk, it was every query-param request in the app, degrading
silently (unfiltered/unpaginated results) rather than erroring, which is exactly why it took
this long to notice elsewhere.

**The actual fix** (`patches/@jellyfin+sdk+0.13.0.patch`, applied automatically via
`patch-package`'s `postinstall` script — see `package.json`): `setSearchParams` computes the
query string as before, then stashes it on a plain custom property, `url.__vegafinSearch`,
instead of trying to write it through any native `URL` accessor at all. `toPathString` is
patched to prefer that property when present, falling back to `url.search` otherwise. Neither
half of the fix depends on any native `URL` write path behaving correctly, which is what makes
it actually work where both `.search =` and `.searchParams` mutation didn't.

This patch is regression-tested at `test/thirdPartyPatches/jellyfinSdkSearchParams.test.ts` —
worth reading the comment there too, since Jest runs on Node's (spec-compliant) `URL` and
can't reproduce the platform bug itself; that test only pins the patch's own input/output
contract, so it won't catch this regressing on-device, only catch someone "cleaning up" the
patch's logic without understanding why it's shaped this way.

If `@jellyfin/sdk` is ever upgraded, `patch-package` will fail loudly (not silently) if the
patch no longer applies cleanly — re-diff `common.js`'s `setSearchParams`/`toPathString` by
hand and regenerate the patch (`npx patch-package @jellyfin/sdk`) rather than skipping it.

`global.URLSearchParams` is still polyfilled (`whatwg-url-without-unicode`) in `index.js`,
since the standalone `new URLSearchParams(str)` constructor needed it on its own — unrelated
to the bug above, and confirmed fine independently.

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
| Playback | `ui/playback/PlaybackViewModel.kt`, `util/TrackActivityPlaybackListener.kt` | `src/screens/playback/PlaybackScreens.tsx`, `src/services/jellyfin/playback.ts`, `src/w3cmedia/` (vendored Shaka Player + polyfills) |
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
  without cluttering the menu. `Discover` is registered but deliberately left out of the
  visible menu (see below) — it's a Phase 3 stub, not a dead route.
- **`RootStackParamList`** (`fullScreen = true`) — `Settings`, `SubtitleSettings`,
  `Playback`, `PlaybackList`, `Slideshow`, `NowPlaying`, etc. Pushed as bare full-screen
  stack screens over `Main` (which hosts the drawer navigator).
- **`SetupStackParamList`** — the pre-auth flow (`ServerList` → `UserList` → `PinEntry`),
  mirroring `SetupNavigationManager.kt`'s separate back stack.

`src/App.tsx` mirrors `MainActivity.kt`: it boots the session (`ServerRepository.init()`),
then renders `SetupNavigator` or `RootNavigator` depending on whether a session restored.

#### Side nav (`MainDrawerNavigator.tsx`)

A collapsible icon rail, not the earlier plain text menu: the signed-in user's avatar
(`getUserApi(api).getCurrentUser()` + `images.ts`'s `userImageUrl`, falling back to a person
icon) + username + server name at top, then Search/Home/Favorites each with an icon, then one
row per Jellyfin library (icon keyed off `CollectionType` via `services/jellyfin/
libraryIcons.ts` — shared with `LibraryTile.tsx`'s Home-screen row so both stay in sync),
linking straight to that library's `ItemGrid`.

- **Collapse/expand**: starts collapsed (~72px, icons only) and expands (~240px, icons +
  labels) while focus is anywhere inside it, via `focus/useFocusGroupExpanded.ts` - each row's
  `onFocus`/`onBlur` bubbles up to a shared counter, since neither the drawer package nor
  Kepler's `TVFocusGuideView` expose a built-in "focus is somewhere inside this group"
  callback. The width toggle is instant, not animated - `drawerStyle.width` is a plain
  `screenOptions` value passed to a third-party navigator, and it wasn't clear that driving it
  from an `Animated.Value` would actually animate through that layer, so animating this
  further is a possible follow-up rather than something already attempted and abandoned.
- **D-pad escape between the rail and content**: the rail's rows are wrapped in a `FocusGroup`
  with `trapFocusUp`/`trapFocusDown` (stop at the first/last row rather than escaping into
  whatever's above/below on screen) but no left/right trap (so focus can escape right into
  the main content). Content escaping back left into the rail required removing `ItemGrid`'s
  `trapFocusLeft` (see [Focus system](#focus-system)) - grids used to trap all horizontal
  escape, which made the rail completely unreachable from any library grid.
- **Scrolling**: the row list (fixed items + every library) is wrapped in a `ScrollView`
  rather than a plain `View`, so a long library list scrolls instead of silently overflowing
  past the bottom of the screen with no way to reach the cut-off rows.

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
npm run test             # jest — see Testing below

npm run build:debug      # produces build/private/kepler/vegafin/undefined/vega/<arch>/Debug/vegafin_<arch>.vpkg
npm run build:release    # release build

# Run on the Vega Virtual Device (the only target this project has been tested against —
# see the note above on physical Fire TV not being tested):
vega virtual-device start
vega device install-app --directory . -b Debug
vega device launch-app --directory .
```

(The `.vpkg` filename derives from `package.json`'s `name` field, `vegafin`.)

### Testing

`npm run test` runs the Jest suite under `test/` (jest requires tests to live there, not
colocated with `src/` — see `jest.config.json`'s `testRegex`). Coverage is intentionally
scoped to the **service/business-logic layer**, not screens or components:

- Auth/session (`ServerRepository`), server URL scheme resolution/probing (`serverUrl`,
  `JellyfinClient`), the Jellyfin API layer (`playback` negotiation + progress reporting,
  `homeRows` including the Continue Watching/Next Up split, `library`, `detail`, `images`
  including the Continue Watching Thumb/Primary fallback and the side nav's avatar lookup,
  `libraryIconName`'s CollectionType→icon mapping, the `ItemPager` pagination hook), theming
  (`ThemeContext`), and the focus system's `useLastFocusedIndex`, `usePinScrollToStart`, and
  `useFocusGroupExpanded` hooks (the last one backs the side nav's collapse/expand-on-focus
  behavior - pulled out of `MainDrawerNavigator.tsx` specifically so it has an independent
  test rather than only being exercised as part of the nav component itself).
- `test/thirdPartyPatches/jellyfinSdkSearchParams.test.ts` — a regression test for the patched
  `@jellyfin/sdk` dependency itself (see the URL/URLSearchParams gotcha above). Pins the
  patch's own input/output contract; can't reproduce the platform bug it fixes, since Jest
  runs on Node's spec-compliant `URL`.
- Deliberately **not** covered: `HomeScreen`/library/detail screens, `PlaybackScreens.tsx`,
  navigation, and the setup screens. These are tightly coupled to native Kepler view
  components (`KeplerVideoSurfaceView`, `useTVEventHandler`, `VideoPlayer`, drawer/stack
  navigators) that would need heavy, low-confidence mocking to exercise under Jest. As with
  the rest of this project, those are verified by actually running the app on the Vega
  Virtual Device (see [Getting started](#getting-started) above), not by unit tests.
- Also not covered: `src/w3cmedia/` (vendored/compiled Shaka Player + polyfills — same
  "vendored, not hand-written" reasoning that excludes it from lint).

`.github/workflows/test.yml` runs `typecheck`/`lint`/`test` on every push to `main` and every
PR. It does **not** run `build:debug`/`build:release` — those need the Vega SDK toolchain
(Amazon developer account, `vega`/`vtbuild`), which isn't available on a public GitHub-hosted
runner.

## Roadmap

- **Phase 1** (done, verified on the Vega Virtual Device) — Home page ("My Media": a
  library-shortcut row plus separate Continue Watching/Next Up/Recently-Added rows), library
  grid/list browsing, Movie/Episode/Collection/Person detail pages plus a binge-style Series
  overview, core playback (`KeplerVideoSurfaceView` + a vendored Shaka Player over
  always-transcoded HLS, full remote-control input, auto-hiding custom controls — see the
  correction above), Quick Connect + password sign-in, a focus-managed card/row system built
  on native `TVFocusGuideView`/`hasTVPreferredFocus` (see [Focus system](#focus-system)), and a
  real app icon (see the app-icon note above). Deliberately out of Phase 1's scope:
  user-configurable home rows, alphabet-jump library browsing, trickplay, skip intro/outro,
  subtitle search/download/delay, WebSocket remote-control commands — see the scope notes
  throughout `src/services/jellyfin/` and `src/screens/`.
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
  focus/                      FocusGroup.tsx, useLastFocusedIndex.ts, usePinScrollToStart.ts,
                               useFocusGroupExpanded.ts - see Focus system above
  services/
    jellyfin/                 JellyfinClient.ts (@jellyfin/sdk wrapper), images.ts, ItemPager.ts,
                               homeRows.ts, library.ts, detail.ts, playback.ts, libraryIcons.ts
    storage/ServerRepository.ts   Session/auth (mirrors data/ServerRepository.kt)
  components/                 ItemRow/ItemGrid/PosterRow, cards/ (incl. LibraryTile.tsx - Home's
                               library-shortcut row), IconButton.tsx
  screens/
    HomeScreen.tsx, FavoritesScreen.tsx, SeriesOverviewScreen.tsx, MediaItemScreen.tsx
    library/                  FilteredCollection/ItemGrid/MoreHomeRow screens
    detail/                   Movie/Episode/Collection/Person detail, series/ (SeriesOverview parts)
    playback/                 PlaybackScreen, PlaybackListScreen (KeplerVideoSurfaceView + ShakaPlayer)
    setup/                     ServerList/UserList (password + Quick Connect)/PinEntry screens
  w3cmedia/                   Vendored Shaka Player + DOM/URL/fetch polyfills - see the playback
                               correction above. Excluded from lint (.eslintrc ignorePatterns).
  types/                      Ambient .d.ts augmentations (react-native-kepler/vector-icons gaps,
                               ScrollView/FlatList's focusItemAlignment - see Focus system above)
assets/image/icon.png          512x512 app icon - see the app-icon note above
assets/raw/fonts/MaterialIcons.ttf  Icon font asset - see the icon-fonts note above
patches/                       patch-package diffs, applied via package.json's postinstall -
                                see the URL/URLSearchParams gotcha above for what and why
index.js                       AppRegistry entry point (must be .js - see build note above)
app.json                       App name; must match manifest.toml's main component id
manifest.toml                  Vega app manifest ([needs.module] is autolinked, not hand-written;
                                [package] icon is hand-written - see the app-icon note above)
```
