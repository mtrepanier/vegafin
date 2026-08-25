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

## Status: Phase 1 done, Phase 2 in progress (settings)

Phase 0's scaffold (navigation graph, auth/session, theming) is done, and Phase 1 now adds:

- A **focus-managed card/row system** (`components/ItemRow.tsx`, `components/ItemGrid.tsx`,
  `components/cards/`) built on native `TVFocusGuideView`/`hasTVPreferredFocus` rather than any
  custom D-pad plumbing — see [Focus system](#focus-system) below.
- A **collapsible side nav** (avatar/username/server, Search/Home/Favorites, one row per
  library, all with icons) that expands on focus and collapses otherwise, with full D-pad
  travel between it and the main content — see [Side nav](#side-nav-maindrawernavigatortsx)
  under Navigation below.
- The **Home screen** ("My Media" — now just the rows, since the library-shortcut row moved
  into the side nav above), a hero banner for whichever card currently has focus, and a
  fixed set of content rows — separate Continue Watching and Next Up rows (an earlier version
  merged them client-side with a SeriesId dedup, which just meant genuinely in-progress items
  got crowded out whenever a same-series "next up" entry happened to load first — split apart
  to match the server's own `/Items/Resume` and `/Shows/NextUp` results directly), one
  Recently Added row per library — rather than Kotlin's user-configurable row settings, which
  is Phase 2 territory. See [Home screen](#home-screen-homescreentsx-homeherotsx) below.
- **Library grid/list browsing** (`FilteredCollection`/`ItemGrid`/`MoreHomeRow`/`Favorites`),
  with sort and a grid/list view toggle.
- **Detail pages** for Movie, Collection (box set), and Person, plus a full binge-style
  `SeriesOverview` page (season tabs + episode row + focused-episode action buttons) that also
  covers episodes — there's no standalone episode detail page; Phase 1 didn't build the
  classic non-binge `SeriesDetails` either. Movie detail and Series overview both match the
  Home screen's hero-style look (full-bleed backdrop, logo, per-type info line) via the shared
  `DetailHero` — see [Movie detail](#movie-detail-moviedetailtsx-detailactionbuttonstsx) and
  [Series overview](#series-overview-seriesoverviewscreentsx) below; Collection/Person detail
  still use the earlier plain layout.
- **Core playback**: `negotiatePlayback` always forces server-side HLS transcoding (see the
  correction below for why direct play was dropped), resume position, 5s progress reporting,
  full remote-control input (play/pause, fast-forward/rewind, back, all confirmed working on
  the Vega Virtual Device), a custom on-screen title/play-pause/progress-bar/track-picker UI
  that auto-hides after a configurable delay (matching the Android client's behavior, now
  driven by the Settings screen below rather than a fixed 5s), and Quick Connect sign-in
  alongside username/password. See the correction below for the actual player architecture —
  it's not what an earlier draft of this README described.
- **A first Settings screen** (Phase 2's first slice): Interface (Show Clock, Play Theme Music
  volume), Playback (hide-controls delay, skip forward/backward seconds, Show Next Up timing,
  Auto Play Next Up), User Settings (Interface Language), and About (app version). Reachable
  from the side nav's last row. See [Settings](#settings-settingsscreentsx) below for what's
  actually wired to real behavior versus what's a persisted-but-inert placeholder so far.
- **Full English/French localization** - every user-facing string in the app, defaulting to the
  device's own language with an override in Settings. See
  [Internationalization](#internationalization-englishfrench) below.

Still not implemented: the *behavior* behind Play Theme Music/Show Next Up/Auto Play Next Up,
update checking, search, subtitle customization/delay, trickplay, skip intro/outro, live TV,
music playback, Seerr/Jellyseerr discover, a third+ language. See [Roadmap](#roadmap).

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
- **No standalone episode detail page.** `navigateToItem.ts` sends Episode-typed items (Home's
  Continue Watching/Next Up rows, a person's "Episodes" credits row) to `SeriesOverview` using
  the episode's own `SeriesId`/`SeasonId`, via the same `seasonEpisode` deep-link param
  `SeriesOverviewScreen.tsx` already resolved a season tab and initial focused episode from —
  same destination as tapping the series itself, just pre-aimed at the right season/episode.
  `MediaItemScreen.tsx` has no Episode case at all (unlike Series, which still self-redirects
  there for anything landing on that route with just an itemId/type pair) since redirecting
  would need a fetch just to learn the episode's series id, and every real caller already goes
  through `navigateToItem.ts` instead, which has the full item in hand.
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
libraryIcons.ts`), linking straight to that library's `ItemGrid`. The library-shortcut row
that used to sit at the top of the Home screen (`LibraryTile.tsx`) was removed once this rail
covered the same navigation — the rail is reachable from every screen, the old row only from
Home's very top.

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
- **Goes transparent behind a screen's backdrop**: the rail's own background is normally
  `colors.surface`, but turns transparent while any screen has set one, so that backdrop
  (rendered above this whole navigator - see [Full-bleed screen
  backdrops](#full-bleed-screen-backdrops-screenbackdroptsx-screenbackdropcontextts) below)
  shows through behind the icons instead of being hidden behind an opaque rail.
- **No hairline border between the rail and the content pane**: `react-native-drawer-layout`
  draws one there by default for a `permanent` drawer, colored from the navigation theme's
  `colors.border` - which `App.tsx` maps straight to this app's own `colors.border`, the TV
  focus-ring color, not a chrome/divider color, so it showed up as a stray purple line down the
  screen. `screenOptions.drawerStyle` now sets `borderRightWidth: 0` to remove it.

#### Full-bleed screen backdrops (`ScreenBackdrop.tsx`, `screenBackdropContext.ts`)

Any screen can ask for a full-bleed backdrop image behind the *entire* screen, including the
side nav rail, by calling `useScreenBackdrop().setItem(item)` - `HomeScreen.tsx` sets it to
whichever card has focus, `MovieDetail.tsx` sets it once to the page's own item and clears it on
blur (`useFocusEffect`, same pattern both screens use, since Kepler's drawer keeps inactive
screens frozen rather than unmounted - nothing else would clear a stale backdrop on navigating
away).

- **The backdrop is a separate full-screen layer, not part of whichever screen sets it.**
  `ScreenBackdrop.tsx` renders as a sibling *before* `Drawer.Navigator` in
  `MainDrawerNavigator.tsx`, so it can paint behind the side nav rail and down the whole screen
  height - nothing inside a screen's own tree can ever draw behind the rail, since the
  `permanent`-type drawer and the screen content are laid out as side-by-side flex children. The
  image only covers the top `HOME_HERO_BACKDROP_HEIGHT` pixels (`homeHeroLayout.ts`, taller than
  a typical header, on purpose) before fading into a solid `colors.background` fill via a real
  SVG `LinearGradient` (`@amazon-devices/react-native-svg`, a system-deployed Kepler library, no
  manual linking step) - not stacked flat-opacity `View`s, which band visibly against a busy
  image no matter how many/small the steps.
- **Two separate opaque layers had to go transparent for any of this to actually show behind the
  rail.** React-navigation's `Screen`/`Background` paints every `Drawer.Screen`'s whole content
  pane by default (overridden via `sceneStyle` for the `Home` and `MediaItem` routes only -
  `MediaItem` covers every detail page, but only `MovieDetail.tsx` currently sets a backdrop, so
  the others just fall through to this View's own `colors.background`, same as before), and
  `react-native-drawer-layout`'s own wrapper `Animated.View` around `drawerContent`, styled from
  `screenOptions.drawerStyle` independently of `DrawerContent`'s own inner container - both need
  the same conditional `backgroundColor` or one or the other paints over the backdrop regardless.
- **A screen showing a backdrop needs no background color of its own** for the same reason
  `HomeScreen.tsx`'s rows don't: `ScreenBackdrop.tsx`'s fade + solid fill already cover the
  entire screen height by itself, so content can render fully transparent and let it show
  through underneath - painting a background on top of it just covers it back up.

#### Home screen (`HomeScreen.tsx`, `HomeHero.tsx`)

Matches AmbientFlare/astra-tv's (a separate Jellyfin-for-Vega client tested on real Fire TV
hardware) hero-style home page rather than the earlier plain title-and-rows layout: whichever
card currently has D-pad focus drives a pinned hero at the top, with a fixed set of content
rows scrolling independently below it.

- **Hero and rows are two independent layout containers, not one shared `ScrollView`.**
  `HomeHero.tsx` (logo/title, episode title, info line, overview, the top-right `Clock`) renders
  in a fixed `HOME_HERO_CONTENT_HEIGHT`-tall `View`, a real flex sibling above the rows'
  `ScrollView` in `HomeScreen.tsx`, so it stays visible while browsing instead of scrolling away.
  Putting the hero in-flow as the `ScrollView`'s own first child (an earlier version) hits a real
  Kepler gotcha: `focusItemAlignment="start"` aligns whichever *card* just took focus to the
  viewport's top edge, not that card's whole row - so it can scroll straight past a hero-height
  spacer and pull rows up underneath a pinned hero, and separately can clip a row's own title
  (rendered above its card list) right at the edge. Fixed by giving hero and rows separate
  containers with no shared scroll offset to fight over, and by driving the rows' vertical
  scroll manually instead of via `focusItemAlignment` at all: each row's y-offset is captured
  via `onLayout` (`rowOffsetsRef`), and a card's `onFocus` scrolls to that offset -
  `scrollRowIntoView` - once per row change, not per card.
- **Continue Watching/Next Up show the parent series' poster, not the episode's own image.**
  `images.ts`'s `seriesAwarePosterImageUrl` uses `SeriesId`/`SeriesPrimaryImageTag` so these rows
  match every other row's portrait-poster shape instead of an episode's landscape still, with a
  small "E5" corner badge (`episodeBadge.ts`) so same-show episodes stay distinguishable. Movies
  pass through to their own Primary image, no badge. Cards on this screen also render with no
  title/subtitle under the art (`PosterCard`'s `title`/`subtitle` simply aren't passed) - the
  hero already shows the focused item's identity, so repeating it under every card read as
  clutter; `MovieDetail.tsx`'s "More Like This" row matches this look too now (`PosterRow`'s
  `showTitles={false}`), everywhere else `PosterRow` keeps titles since those rows have no
  persistent hero doing that job.
- **`formatHeroInfoLine` (`util/format.ts`) shapes its output per item type, and returns
  segments rather than one joined string, rendered via the shared `HeroInfoLine.tsx`** (also
  used by `MovieDetail.tsx`). An episode leads with "S1 E5" plus its full air date ("Jun 19,
  2026"); anything else gets year/runtime/official rating instead - the episode title shown
  above this line already covers identity, so repeating year/rating there would be redundant.
  Both then append `CommunityRating`/`CriticRating` ("🍅 92%") when present, and the time
  remaining ("22m left" via `formatTimeRemaining`, not a computed "Ends at" clock time) for an
  in-progress item - computed from `UserData.PlayedPercentage` in preference to
  `PlaybackPositionTicks`, since that's the field a real `/Items/Resume` response reliably
  carries (`homeRows.ts` now also requests `Overview` and `enableUserData: true` explicitly on
  all three Home row fetches, rather than relying on Jellyfin's list-endpoint defaults). Segments
  (`HeroInfoSegment[]`, not a pre-joined string) let `HeroInfoLine.tsx` give the community
  rating's star its own color/size (gold, a couple points larger than the surrounding text - a
  plain "★" glyph renders visibly smaller than the 🍅 emoji next to it at the same nominal
  `fontSize`), which a flat string couldn't.
- **Card sizing shrank app-wide** (`theme/types.ts`'s `layout` tokens, ~20-25% smaller) to match
  Wholphin's card density - global, not Home-only, since every row/grid shares these constants.

#### Movie detail (`MovieDetail.tsx`, `DetailActionButtons.tsx`)

Rebuilt to match the Home screen's hero-style look rather than the earlier plain
title-and-backdrop layout: full-bleed backdrop (see above), then the shared `DetailHero`
(`screens/detail/DetailHero.tsx` - logo or plain title text, the `HeroInfoLine`, genres; also
used by Series overview below, so both screens' headers stay visually identical instead of each
duplicating this JSX), action buttons, tagline, overview, then Cast and "More Like This" below.

- **Action buttons are icon-only until focused, then expand to an inverted light pill with the
  label alongside the icon** - `DetailActionButtons.tsx`'s local `ActionButton`, the same
  "collapsed until focus reveals more" shape as the side nav rail
  (`focus/useFocusGroupExpanded.ts`), just per-button instead of per-region. Every button
  (including Play) gets identical treatment, no separate filled-at-rest style for Play;
  `colors.onBackground`/`colors.background` (not a literal white/black) keep the inverted pill
  theme-aware across this app's 8 palettes. Covers Play/Resume, Trailer, Trailers, Favorite, and
  Watched (the two trailer buttons are separate - see below).
- **The expanded width comes from `minWidth`/`paddingHorizontal` plus the label's own content,
  not from a fixed `width: 44` overridden with `width: undefined` when focused** - the latter
  didn't reliably override the already-computed layout on-device, leaving the button visibly
  focused (color changed correctly) but stuck circular with no room for the label to show.
- **"Trailer" and "Trailers" are two different buttons for two different kinds of trailer.**
  `item.LocalTrailerCount` gates a movie icon "Trailer" button - a local trailer file, fetched
  on press (`detail.ts`'s `fetchLocalTrailers`) and played through the normal `Playback` route
  like any other item. `item.RemoteTrailers` (external links - YouTube, etc. - Jellyfin doesn't
  host itself) gates a separate `theaters` icon "Trailers" button instead, since there's no
  single obvious one to play and no in-app player for arbitrary web video: it opens
  `TrailerListOverlay.tsx`, a picker listing them by name (capped at a fixed height with an
  internal `ScrollView`, `focusItemAlignment="start"`, so an item with many trailers doesn't
  grow the panel past the screen), and selecting one hands the raw URL to `Linking.openURL` for
  the platform itself to handle - the first thing in this app to hand off a URL rather than
  handle it in-app, untested on real Fire TV/Vega hardware as of writing. The overlay is plain
  conditional JSX inside its caller (mounted/unmounted by that screen's own open state), not
  RN's `Modal` - same manual absolute-positioned-overlay approach `PlaybackScreens.tsx`'s
  `TrackPicker` already uses - and closes on the remote's back button via a
  `useTVEventHandler` subscription that only exists while it's mounted, matching how
  `PlaybackScreens.tsx` already reads a `'back'` event type off `HWEvent`. Shared with Series
  overview below - see its own "Trailers" bullet for the one wrinkle specific to that page.

#### Series overview (`SeriesOverviewScreen.tsx`)

The binge-watch page: the series' own backdrop and logo (via `DetailHero`, shared with Movie
detail) stay fixed, but the episode title, the info line, and the synopsis underneath all track
whichever episode currently has focus in the row below - genres stay series-level. Then: genre
→ synopsis → season tabs → episode row → action buttons for the focused episode → Cast & Crew →
Guest Stars → "More Like This".

- **`DetailHero` takes an optional second item to drive episode-specific content.** `item`
  (always the series) drives the logo and genres; `detailItem` (defaults to `item` itself -
  `MovieDetail.tsx` never passes one, so its own info line is unaffected) drives the episode
  title line and the info line. `SeriesOverviewScreen.tsx` passes `focusedEpisode ?? series`, so
  the info line shows "S1 E1 · <air date> · <runtime> · ratings" (the same episode-shaped output
  `formatHeroInfoLine` already gave Home's hero for an episode) instead of the series' own
  year/rating, and an episode's own synopsis renders right below the info line - both swapping
  as focus moves along the episode row. `FocusedEpisodeHeader.tsx`, an earlier version's
  separate backdrop-swapping component for this same job, is gone; the backdrop itself stays
  the series' own throughout, only the text content reacts to focus now.
- **Season tab labels are built from `IndexNumber`, not trusted from `season.Name`** -
  `util/format.ts`'s `formatSeasonLabel` ("Season 1", "Season 2", ... "Specials" for season 0).
  A season's `Name` comes straight from whatever the metadata provider set, so it isn't
  reliably in English or reliably present at all; falls back to `Name` only when there's no
  `IndexNumber` to build a label from.
- **No title under episode thumbnails** - `episodeBadgeLabel` (the same "E5" corner badge
  Home's Continue Watching/Next Up rows use) is enough to tell episodes apart at a glance, with
  the focused episode's own title already shown in the hero above.
- **Guest Stars, shown under Cast & Crew, come from the focused *episode*, not the series** -
  a second `CastRow` reading `focusedEpisode.People` filtered to `PersonKind.GuestStar`.
  Jellyfin's `People` field on a Series item is the show's regular cast/crew; guest stars are
  credited per-episode, so this has to track whichever episode is currently selected in the row
  above, not the series itself.
- **`fetchEpisodes` needs several fields requested explicitly, or episode cards/panes silently
  render as if that data doesn't exist.** `fields: [ItemFields.People, ItemFields.Overview]`
  (guest-star credits, synopsis) and `enableUserData: true` (watched checkmark, favorite heart,
  resume progress bar - same gotcha as `homeRows.ts`'s resume/next-up rows) are all omitted by
  default and gated the same way elsewhere in this codebase.
- **Action buttons sit right under the episode row, flush with its left edge, not with extra
  gaps of their own.** `ItemRow` (which `EpisodeRow` is built on) already trails itself with
  `marginBottom: layout.rowSpacing`, so the actions wrapper doesn't add its own `marginTop` on
  top of that. It doesn't add `paddingHorizontal` either, for a less obvious reason:
  `FocusedEpisodeFooter.tsx` already applies `layout.contentPadding` itself (it was originally
  rendered directly, with no wrapper) - adding the *same* padding again on the wrapper around it
  doubled the button row's left offset to 80px instead of 40, visibly out of alignment with the
  season tabs/episode row above it despite both apparently using "the same" padding constant.
- **D-pad-down from the episode row lands on Play, not whichever button the platform judges
  spatially nearest, via `destinations` rather than `hasTVPreferredFocus`.** With nothing in the
  row claiming `hasTVPreferredFocus`, D-pad-down landed on Watched (the rightmost button)
  instead. Making Play claim `hasTVPreferredFocus` fixed that but reintroduced the Focus
  system's Gotcha #2 - its claim fired at mount and won the page's *initial* focus race against
  the episode row, even when delayed ~400ms past mount (a `hasTVPreferredFocus` claim turning
  true on an already-mounted, unfocused element turns out to yank focus to it immediately on
  this platform, not just set up where a *later* entry should land - so no delay dodges this
  race safely). `DetailActionButtons` now instead wraps its row in a `FocusGroup` with a
  `destinations` prop (Kepler's `TVFocusGuideView` destinations,
  `src/types/react-native-augmentations.d.ts`) pointed at Play's node handle - a passive "if
  this group is ever entered, land here" rule rather than a proactive claim, so it can stay
  active unconditionally with no race: `FocusedEpisodeFooter.tsx` passes `autoFocus={false}`
  (Play never claims the page's initial focus) while D-pad-down still resolves to Play through
  `destinations`.
- **"More Like This" reuses `fetchSimilarItems`** (already generic across item types) and
  `PosterRow`'s `showTitles={false}`, the same textless card look as Movie detail's row.
- **The "Trailers" button (see Movie detail above) sources `series.RemoteTrailers`, not the
  focused episode's** - a show's trailer metadata generally lives on the series item itself, the
  same reasoning `DetailHero`'s logo/genres already follow, so `FocusedEpisodeFooter.tsx` takes
  an `onOpenTrailers` callback from `SeriesOverviewScreen.tsx` (sourced from `series`) rather
  than reading it off whichever episode happens to be focused.
- **The episode synopsis reserves a fixed height, not just a `numberOfLines` cap.** Without it,
  everything below (season tabs, episode row, buttons) shifted up or down as focus moved
  between episodes with different synopsis lengths - a 1-line synopsis produced a shorter block
  than a 2-line one, and an episode with no synopsis at all collapsed the block to nothing.
  `numberOfLines={2}` only bounds the *maximum*; the wrapping `overviewBox` view's fixed
  `height: 44` (2 lines' worth of `styles.overview`'s own `lineHeight`) is what actually keeps
  the space constant regardless of how much (or how little) text is actually there.

### Settings (`SettingsScreen.tsx`)

Phase 2's first slice: a flat, single-screen list of sections (Interface, Playback, User
Settings, About) rather than a nested settings navigator - `RootStackParamList`'s `Settings`
route takes no params (changed from an unused `{ screen: string }` placeholder) since there's
only one screen's worth of options so far. Reached from a new "Settings" row appended after the
side nav's library rows (`MainDrawerNavigator.tsx`) - always last, navigated via
`navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Settings')`
since Settings is a bare full-screen stack push (`RootStackParamList`), not drawer chrome
(`DrawerParamList`), the same distinction every other Settings-ish screen already followed.

- **Persistence is a new `AppSettingsRepository`, deliberately separate from
  `ServerRepository`'s existing `JellyfinUserPreferences`.** The latter is per-Jellyfin-user
  audio/subtitle language preference, saved as part of that user's own record and already
  wired up before this. `AppSettings` (device-local, `AsyncStorage` key
  `vegafin.appSettings.v1`) is global to the app install instead, not tied to whichever user is
  signed in - matching the side nav's Settings entry being a fixed menu item rather than a
  per-profile one. Same `useSyncExternalStore` + module-singleton + subscriber-list shape as
  `ServerRepository.ts` either way; `AppSettingsProvider` (`App.tsx`) needs no loading gate
  unlike `ServerRepositoryProvider` - `getSnapshot()` already returns sensible defaults before
  `init()` resolves, since nothing here needs to block on session restore the way sign-in does.
- **No slider component exists on this platform** (checked: not a public export of
  `@amazon-devices/react-native-w3cmedia`, which only uses one internally for its own seek bar,
  and no `@react-native-community/slider`-equivalent dependency exists either) **- and D-pad
  remotes have no drag gesture for one anyway.** `SettingsStepper.tsx` is the TV-native
  replacement everywhere the ask was "a slider": a `< value >` row cycling through a curated
  option list (seconds presets for the numeric settings, named options for the enums), not a
  raw min/max/step range - a real 1-120s range would mean holding D-pad right for dozens of
  presses to reach the far end.
- **Skip forward/backward and the controls auto-hide delay used to be hardcoded in
  `PlaybackScreens.tsx`** (`SEEK_FORWARD_SECONDS`/`SEEK_BACK_SECONDS`/`CONTROLS_HIDE_DELAY_MS` -
  30/10/5) **- now read from `useAppSettings()` instead**, with `defaultAppSettings()` carrying
  the exact same numbers forward so installing this didn't change anyone's actual playback
  behavior. "Show Clock" (`HomeHero.tsx`) is the only other setting wired to real behavior so
  far.
- **Play Theme Music, Show Next Up, and Auto Play Next Up persist correctly but don't drive
  anything yet, and Updates is an inert display row, not a fake working control.** Theme-song
  audio playback and an end-of-playback Next Up prompt are their own separate features that
  haven't been built, and there's no update-check mechanism to wire "Updates" to yet - rather
  than wire a setting up to nothing or guess at behavior, `SettingsInertRow.tsx` renders a
  plain `View`, not a `Pressable`, for anything without a real control behind it yet, so D-pad
  navigation skips it entirely instead of landing on a focusable dead end. Interface Language
  used to be one of these too, until [Internationalization](#internationalization-englishfrench)
  below made it a real control.

### Internationalization (English/French)

Every user-facing string in the app goes through a hand-rolled catalog (`src/i18n/`), not
`i18next`/`react-i18next` - only two languages are needed so far, and this platform is exotic
enough (see the rest of this README) that a library with its own plugin ecosystem for locale
detection, pluralization, etc. felt like more unverified surface than it was worth. Same
reasoning as `SettingsStepper.tsx` standing in for a slider component - build the TV/platform-
appropriate thing directly rather than pull in a library aimed at a different environment.

- **`src/i18n/translations/en.ts` is the canonical catalog - `fr.ts` is typed as
  `Record<TranslationKey, string>` against it,** so TypeScript itself fails the build if a key
  gets added to one without the other, rather than silently falling back to English on a French
  device. Keys are namespaced by screen/concern (`settings.*`, `nav.*`, `player.*`, `common.*`
  for strings reused verbatim across unrelated screens - "More Like This" on both Movie detail
  and Series overview is one key, not two), not full sentences. `translate(language, key,
  params?)` (`translate.ts`) does simple `{placeholder}` interpolation - not full ICU
  MessageFormat (plurals, gender) - since neither language has needed real plural rules for any
  string used here yet.
- **`useT()` (components/hooks) and `translate()` directly (pure functions) are the two ways to
  consume the catalog**, both ultimately resolving a `Language` ('en'/'fr') via `useLanguage()`/
  `resolveLanguage.ts`. `util/format.ts`, `episodeBadge.ts`, and `homeRows.ts` take an explicit
  `language`/`t` parameter rather than calling a hook themselves, since they're plain functions
  (some already called from other plain functions, like `formatQuickDetails` calling
  `formatRuntime`) - `resolveLanguage.ts` and `translate.ts` have no React dependency at all,
  so this works cleanly either way.
- **`'system'` (the default) follows the device's own locale via Kepler's `I18nManager`, an
  Amazon addition over stock RN's RTL-only I18nManager** (`getSystemLocale()`,
  `addEventListener('Locale', ...)` for a live change while the app is running - both typed via
  `src/types/react-native-augmentations.d.ts`, the same declaration-merging pattern used for
  `focusItemAlignment` and `Pressable`'s `focused` state). `useSystemLocale.ts` wraps this
  defensively (try/catch, falls back to `null`/English) since it's the first thing in this app
  to call it - unverified on real hardware as of writing, same caveat as `Linking.openURL` in
  the Trailers overlay. `resolveLanguage.ts` only matches an actual French-tagged locale
  (`fr`, `fr-FR`, `fr-CA`, ...) to French; anything else, including a failed read, is English.
- **Home row titles ("Continue Watching", "Latest {library}") are baked into
  `HomeRowConfig.title` at fetch time, not resolved reactively at render time like everywhere
  else** - `fetchDefaultHomeRowConfigs` takes a `language` param directly (same pattern as
  `formatSeasonLabel` etc.), and `HomeScreen.tsx` adds `language` to the effect that calls it,
  so changing the language setting while already on Home re-fetches (also re-fetching the
  library list, a minor redundancy) rather than leaving stale-language row titles until the
  next visit. Every other translated string in the app re-renders instantly since it's resolved
  from `useT()` at render time - this one file trades that instant reactivity for not
  restructuring `HomeRowConfig` to carry a translation key instead of a resolved string.
- **Two deliberate exceptions stay untranslated.** `ServerRepository.ts`'s "Unknown server"
  error is an internal invariant guard (`upsertUser` called for a server that was just verified
  to exist a moment earlier) rather than a normal user-facing message, and translating it would
  mean threading a `t` function through a service-layer class with no other i18n awareness for
  a string that shouldn't be reachable in practice. Quick Connect's poll-failure message
  (`UserListScreen.tsx`) translates its own static prefix but keeps the appended
  `url:`/`body:` diagnostic dump as-is - genuinely technical debug content, not something a
  translation would make more useful.

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

- Auth/session (`ServerRepository`), device-local app preferences (`AppSettingsRepository` -
  same `subscribe`/`getSnapshot`/`init` shape as `ServerRepository`, see
  [Settings](#settings-settingsscreentsx) above), server URL scheme resolution/probing
  (`serverUrl`, `JellyfinClient`), the Jellyfin API layer (`playback` negotiation + progress
  reporting, `homeRows` including the Continue Watching/Next Up split, `library`, `detail`
  including `fetchLocalTrailers` and `fetchEpisodes`'s `People` field request, `images`
  including the hero's series-aware poster/logo fallbacks and the side nav's avatar lookup,
  `episodeBadge`'s "E5" corner-badge labeling, `libraryIconName`'s CollectionType→icon mapping,
  the `ItemPager` pagination hook), the pure formatting helpers in `util/format.ts` (including
  the shared `formatHeroInfoLine` and `formatSeasonLabel`), `util/useCurrentTime.ts` (the hero
  clock's interval hook), theming (`ThemeContext`), the focus system's
  `useLastFocusedIndex`, `usePinScrollToStart`, and `useFocusGroupExpanded` hooks (the last one
  backs the side nav's collapse/expand-on-focus behavior - pulled out of
  `MainDrawerNavigator.tsx` specifically so it has an independent test rather than only being
  exercised as part of the nav component itself), and
  [Internationalization](#internationalization-englishfrench)'s `translate`/`resolveLanguage`/
  `useSystemLocale` (the last one spies on the real, jest-mocked-preset `I18nManager` rather
  than replacing the whole `react-native` module - see the test file's own comment for why that
  more obvious-looking approach trips over Kepler's `index.js` lazy-getter setup).
- `test/thirdPartyPatches/jellyfinSdkSearchParams.test.ts` — a regression test for the patched
  `@jellyfin/sdk` dependency itself (see the URL/URLSearchParams gotcha above). Pins the
  patch's own input/output contract; can't reproduce the platform bug it fixes, since Jest
  runs on Node's spec-compliant `URL`.
- Deliberately **not** covered: `HomeScreen`/library/detail/settings screens,
  `PlaybackScreens.tsx`, navigation, and the setup screens. These are tightly coupled to native
  Kepler view components (`KeplerVideoSurfaceView`, `useTVEventHandler`, `VideoPlayer`,
  drawer/stack navigators) that would need heavy, low-confidence mocking to exercise under
  Jest. As with the rest of this project, those are verified by actually running the app on the
  Vega Virtual Device (see [Getting started](#getting-started) above), not by unit tests.
- Also not covered: `src/w3cmedia/` (vendored/compiled Shaka Player + polyfills — same
  "vendored, not hand-written" reasoning that excludes it from lint).

`.github/workflows/test.yml` runs `typecheck`/`lint`/`test` on every push to `main` and every
PR. It does **not** run `build:debug`/`build:release` — those need the Vega SDK toolchain
(Amazon developer account, `vega`/`vtbuild`), which isn't available on a public GitHub-hosted
runner.

## Roadmap

- **Phase 1** (done, verified on the Vega Virtual Device) — Home page ("My Media": a
  focus-driven hero banner plus separate Continue Watching/Next Up/Recently-Added rows), a
  collapsible icon side nav (avatar/library shortcuts, replacing the earlier Home-screen
  library row), library grid/list browsing, Movie/Collection/Person detail pages plus a
  binge-style Series overview (which also covers episodes - no standalone episode detail page),
  core playback (`KeplerVideoSurfaceView` + a vendored Shaka Player over
  always-transcoded HLS, full remote-control input, auto-hiding custom controls — see the
  correction above), Quick Connect + password sign-in, a focus-managed card/row system built
  on native `TVFocusGuideView`/`hasTVPreferredFocus` (see [Focus system](#focus-system)), and a
  real app icon (see the app-icon note above). Deliberately out of Phase 1's scope:
  user-configurable home rows, alphabet-jump library browsing, trickplay, skip intro/outro,
  subtitle search/download/delay, WebSocket remote-control commands — see the scope notes
  throughout `src/services/jellyfin/` and `src/screens/`.
- **Phase 2** (in progress) — A first [Settings](#settings-settingsscreentsx) screen is done
  (Interface/Playback/User Settings/About, reachable from the side nav's last row); skip
  forward/backward and the controls auto-hide delay are wired to real playback behavior, Show
  Clock to the Home hero, Interface Language to a full English/French localization (see
  [Internationalization](#internationalization-englishfrench)). Still open: the behavior behind
  Play Theme Music (theme-song audio), Show Next Up/Auto Play Next Up (an end-of-playback
  prompt), update checking, plus search, subtitle customization, trickplay, skip intro/outro,
  multi-server/user switching UI, PIN-lock routing, a third+ language.
- **Phase 3** — Live TV guide + DVR, music playback (now playing/visualizer/lyrics),
  Jellyseerr discover integration, screensaver/slideshow, photo albums.

## Project layout

```
src/
  App.tsx                     Root component: theme + session bootstrap + navigator switch
  navigation/                 Route graph (mirrors ui/nav/Destination.kt), navigateToItem.ts,
                               screenBackdropContext.ts (full-bleed backdrop state shared with
                               the side nav - see Full-bleed screen backdrops above)
  theme/                      Color palettes + ThemeContext (mirrors ui/theme/) + layout tokens
  focus/                      FocusGroup.tsx, useLastFocusedIndex.ts, usePinScrollToStart.ts,
                               useFocusGroupExpanded.ts - see Focus system above
  i18n/                       translations/en.ts+fr.ts (the catalog), translate.ts,
                               useTranslation.ts (useT), useLanguage.ts, resolveLanguage.ts,
                               useSystemLocale.ts - see Internationalization above
  util/                       format.ts (incl. the shared formatHeroInfoLine),
                               useCurrentTime.ts (hero clock), uuid.ts
  services/
    jellyfin/                 JellyfinClient.ts (@jellyfin/sdk wrapper), images.ts, ItemPager.ts,
                               homeRows.ts, library.ts, detail.ts, playback.ts, libraryIcons.ts,
                               episodeBadge.ts
    storage/ServerRepository.ts   Session/auth (mirrors data/ServerRepository.kt),
                               AppSettingsRepository.ts/AppSettingsContext.tsx (device-local app
                               preferences - see Settings above)
  components/                 ItemRow/ItemGrid/PosterRow, cards/, Clock.tsx (hero top-right
                               clock), HeroInfoLine.tsx (shared rating/info line - see Home
                               screen above), IconButton.tsx
  screens/
    HomeScreen.tsx, HomeHero.tsx, ScreenBackdrop.tsx (full-bleed backdrop layer, shared with
    MovieDetail/SeriesOverview), homeHeroLayout.ts (shared hero/backdrop sizing),
    FavoritesScreen.tsx, SeriesOverviewScreen.tsx, MediaItemScreen.tsx
    library/                  FilteredCollection/ItemGrid/MoreHomeRow screens
    detail/                   DetailHero.tsx (shared Movie/SeriesOverview header), Movie/
                               Collection/Person detail (no standalone Episode detail - episodes
                               open on SeriesOverview instead, see Navigation above),
                               TrailerListOverlay.tsx (RemoteTrailers picker, see Movie detail
                               above), series/ (SeasonTabs/EpisodeRow/FocusedEpisodeFooter - the
                               rest of SeriesOverview's parts)
    playback/                 PlaybackScreen, PlaybackListScreen (KeplerVideoSurfaceView + ShakaPlayer)
    settings/                 SettingsScreen.tsx (real - see Settings above) plus the
                               still-Phase-2-stub HomeSettings/SubtitleSettings/
                               UserAppPreferences screens; SettingsToggle/SettingsStepper/
                               SettingsSection/SettingsInertRow row components
    setup/                     ServerList/UserList (password + Quick Connect)/PinEntry screens
  w3cmedia/                   Vendored Shaka Player + DOM/URL/fetch polyfills - see the playback
                               correction above. Excluded from lint (.eslintrc ignorePatterns).
  types/                      Ambient .d.ts augmentations (react-native-kepler/vector-icons gaps,
                               ScrollView/FlatList's focusItemAlignment - see Focus system above;
                               I18nManager's getSystemLocale/addEventListener - see
                               Internationalization above)
assets/image/icon.png          512x512 app icon - see the app-icon note above
assets/raw/fonts/MaterialIcons.ttf  Icon font asset - see the icon-fonts note above
patches/                       patch-package diffs, applied via package.json's postinstall -
                                see the URL/URLSearchParams gotcha above for what and why
index.js                       AppRegistry entry point (must be .js - see build note above)
app.json                       App name; must match manifest.toml's main component id
manifest.toml                  Vega app manifest ([needs.module] is autolinked, not hand-written;
                                [package] icon is hand-written - see the app-icon note above)
```
