# VegaFin — Developer Guide

> Looking for what VegaFin *is* rather than how it's built? See [README.md](README.md).
> This document is the technical/architecture reference: what's implemented, why it's built
> the way it is, platform gotchas, and how to build and test it yourself.

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

## Status: Phase 1 done, Phase 2 in progress, Phase 3 started (Live TV)

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
  with a directly-selectable sort picker (any field/direction combination in one press - see
  [Library sort picker](#library-sort-picker-libraryscreenstsx) below) and a grid/list view
  toggle.
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
- **An end-of-playback Next Up card**, wiring up Show Next Up/Auto Play Next Up to real
  behavior - see [Next Up prompt](#next-up-prompt-nextupcardtsx) below.
- **Multi-server/user switching** from the side nav's avatar/username row, without a full
  re-login - see [Switching servers/users](#switching-serversusers-userlistscreentsx) below.
- **Skip Intro/Skip Outro**, driven by the server's Intro Skipper plugin data (Jellyfin's
  MediaSegments API) rather than anything detected client-side - see
  [Skip Intro/Outro](#skip-introoutro-skipsegmentbuttontsx) below.
- **Hold-to-fast-seek on the remote's dedicated FF/RW buttons** - a tap skips the same amount
  as the D-pad arrow, holding ramps into a faster repeating seek - see
  [Hold-to-fast-seek](#hold-to-fast-seek-on-the-remotes-ffrw-buttons) below.
- **A directly-selectable, per-library/per-user library sort picker**, and a series
  unwatched-episode-count corner badge on every card list that can show one - see
  [Library sort picker](#library-sort-picker-libraryscreenstsx) and
  [Series unwatched-episode badge](#series-unwatched-episode-badge-seriesbadgets) below.
- **Search** - Movies/TV Shows/Episodes/Collections/People, each as its own labeled row - see
  [Search](#search-searchscreentsx-searchts) below.
- **Live TV channel list + program guide** (Phase 3's first slice) - browse channels, see
  what's on, tune in and watch live - see [Live TV](#live-tv-guide-livetvguidescreentsx-
  livetvplayerscreentsx-livetvts) below. DVR (recording, scheduling) is not part of this slice.

Still not implemented: the *behavior* behind Play Theme Music, update checking,
subtitle customization/delay, trickplay, DVR/recording scheduling, music playback,
Seerr/Jellyseerr discover, a third+ language. See [Roadmap](#roadmap).

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

- `negotiatePlayback` (`services/jellyfin/playback.ts`) requests transcoded HLS by default
  (`EnableDirectPlay: false, EnableDirectStream: false`) — HLS's segment-based seeking works
  reliably where raw-file byte-range seeking didn't. VOD (every call site except Live TV) always
  gets this default; Live TV opts out via `allowDirectPlayback` since there's no seeking on a
  live stream for the seek-reliability reasoning to apply to - see
  [Live TV guide](#live-tv-guide-livetvguidescreentsx-livetvplayerscreentsx-livetvts) below.
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

### Next Up prompt (`NextUpCard.tsx`)

Wires up the Settings screen's `showNextUp`/`autoPlayNextUp` (previously persisted but inert)
to an actual end-of-playback card, only on `PlaybackScreen` (a single episode the user chose
directly) - `PlaybackListScreen` (an explicit Play All/Shuffle playlist) always auto-advances
through its own list regardless of these settings, since that's the whole point of choosing
Play All, a different concept from the Jellyfin "recommended next episode" feature these
settings actually govern.

- **No real chapter/credits-marker data is available to base "during end credits" on.**
  Jellyfin's MediaSegments API has an actual `Outro` marker type for this, but it isn't
  integrated in this app - `NEXT_UP_THRESHOLD_SEC` (`PlaybackScreens.tsx`) is a fixed
  remaining-seconds threshold per `showNextUp` value instead (15s for "At the End of
  Playback", 60s for "During End Credits"), not real credits detection. The card also forces
  itself visible once the native `ended` event fires, regardless of the threshold, so a
  same-length video with no measurable "remaining time" window still gets offered a next
  episode instead of just cutting to black.
- **The next episode is fetched via `getTvShowsApi().getNextUp({ seriesId, limit: 1 })`
  (`fetchNextUpEpisode`, `playback.ts`), not by walking `IndexNumber` client-side** - the
  server already resolves season-boundary and special-episode edge cases that a naive
  `IndexNumber + 1` walk would get wrong. Fetched once the currently-playing item's own
  metadata resolves (need its `SeriesId`); `null` for a movie or the last episode of a series,
  in which case the card never shows and playback ending behaves exactly as before this
  feature existed.
- **`onEndedEvent` no longer decides what happens next itself - it only sets `ended` state.**
  It's registered once per surface (`activePlayer.addEventListener('ended', ...)` inside
  `createPlayer`), so a value it captured directly (like `nextUpItem`, fetched *after* the
  player/listeners are already wired up) would stay stale for that listener's whole lifetime -
  the same closure-staleness class of bug this file's `positionMsRef`/`sourceRef`/etc. mutable
  mirrors already exist to avoid. `setEnded` is a plain state setter, which doesn't have that
  problem, so a separate `useEffect` watching `ended`/`nextUpItem` (fresh closure every render)
  makes the actual "exit, or let the card take over" decision instead.
- **The Auto Play Next Up countdown owns its whole lifecycle in one `useEffect`**, not split
  across a "start it" effect and a "fire at zero" effect - simpler than syncing two effects
  through a shared piece of state for what's really one continuous timer.
- **Pressing the remote's back button while the card is visible dismisses the card instead of
  exiting playback** - the video is still playing (or already ended) behind it either way, and
  "back cancels the pending transition, doesn't leave" matches the convention other TV players
  use. Every other back-press behavior in this file (exiting, or - a pre-existing, unrelated
  gap - not closing the track picker first) is unchanged.

### Skip Intro/Outro (`SkipSegmentButton.tsx`)

Wires up two new Settings screen preferences, Skip Intro and Skip Outro, each independently
`Ask` (show a button, don't move playback without an explicit press) / `Auto-Skip` (seek past
it the moment it starts, no prompt) / `Off` (ignore the segment entirely) - `Ask` is the
default for both, matching the reasoning in `defaultAppSettings()`: silently jumping playback
forward the first time someone sees this feature reads as broken, not helpful.

- **Segment data comes from Jellyfin's MediaSegments API, not anything detected client-side.**
  `fetchMediaSegments` (`playback.ts`) calls `getMediaSegmentsApi().getItemSegments({ itemId,
  includeSegmentTypes: [Intro, Outro] })` - populated server-side by the Intro Skipper plugin
  having already scanned the library. An item the plugin hasn't scanned just returns an empty
  list, which this feature treats identically to "no segments," not an error state. Commercial/
  Preview/Recap segment types exist in the same API but aren't requested or surfaced here -
  Skip Intro/Outro only, matching what was actually asked for.
- **Fetched once per item (keyed on `itemId`), independent of `enableNextUp`** - unlike the
  Next Up card (an episode-to-episode "recommended next" concept, opted into by `PlaybackScreen`
  only), segment data is a per-item property that applies equally to `PlaybackListScreen`'s
  Play All/Shuffle flow and to movies, not just single episodes played directly.
- **Which segment is "active" is derived, not polled on a timer** - `activeSegment` is a
  `useMemo` over the already-tracked `positionSec` (updated by the player's own `timeupdate`
  event) and the fetched segment list, rather than a separate `setInterval` re-checking
  position against segment ranges the way the Kotlin reference implementation does. `timeupdate`
  already fires often enough; a second poll loop would just be redundant work.
- **`seekBy` (relative, used by the skip-forward/back remote buttons) is now built on a new
  `seekTo` (absolute)** - Auto-Skip and the button's manual skip both need to jump to a segment's
  exact `EndTicks`, not to "current position + N seconds," so the shared clamping/fastSeek logic
  was pulled out into `seekTo` first rather than duplicated.
- **A `skippedSegmentIdsRef` (a ref, not state) guards against re-firing Auto-Skip on every
  position tick while still inside the same segment** - the seek itself is asynchronous, so
  several `timeupdate` events can still land inside `[start, end)` before it actually lands;
  without the guard, each one would re-trigger another `seekTo` call. It's a ref rather than
  state because nothing needs to re-render off it changing on its own - the seek that follows
  already advances `positionSec`, which is what the UI actually reacts to.
- **A separate `dismissedSegmentId` (state, not a ref) tracks an explicit "Ask" dismissal
  without skipping** - pressing the remote's back button while the button is visible hides it
  for that one segment (same "back cancels the overlay, doesn't exit" convention the Next Up
  card uses) without seeking anywhere. Unlike the ref above, this needs to be state: nothing
  else about position changes on a dismiss, so nothing else would trigger the re-render hiding
  the button needs.
- **The button is suppressed whenever the Next Up card is visible** (`skipButtonVisible`
  checks `!nextUpVisible`), rather than letting both render at once - both would claim
  `hasTVPreferredFocus` on mount, which is exactly the "more than one focus claim per screen at
  once" class of bug this project's Focus system section warns about, and if Next Up is already
  showing the current item is basically over anyway, so skipping its outro doesn't matter much.

### Hold-to-fast-seek on the remote's FF/RW buttons

The remote's dedicated fast-forward/rewind buttons (`forward`/`skip_forward` and
`rewind`/`skip_backward` `HWEvent` types - distinct from the D-pad's `right`/`left`, which
stay single-skip-only and unchanged) now behave like a real FF/RW button: a single press skips
by the same `skipForwardSec`/`skipBackwardSec` amount as the D-pad arrow, but holding it down
ramps into a faster, repeating seek the longer it's held.

- **There's no native "key held" signal to read directly.** `HWEvent.eventKeyAction` exists in
  the type (`-1 | 1 | 0 | number`) but the app's own already-confirmed-on-device behavior (see
  `KEY_EVENT_DEDUPE_MS`'s own comment, and this same fact independently re-confirmed in
  Wholphin-vega/astra-tv's separate `useRemoteInput.ts`) is that **a single physical press
  always delivers exactly two events - its down and up phases, and for some keys a distinct
  `<key>_up` type - never more.** That's a real, tested constant, not a guess, and it's what
  hold detection is built on: a *third* same-direction event arriving without a release gap in
  between can only mean the button is still physically held (native key-repeat), since a lone
  click is confirmed to top out at two. `SEEK_HOLD_MIN_EVENTS_TO_RAMP = 3` in
  `PlaybackScreens.tsx` encodes exactly that threshold, and reuses `KEY_EVENT_DEDUPE_MS`'s own
  350ms value as the release-gap rather than a second tuned constant, since it's the same
  underlying platform behavior being measured either way.
- **Forward/rewind bypass the generic per-key dedupe entirely**, unlike every other key
  (`handleTVEvent`'s early-return branch for these two types) - the generic dedupe's whole job
  is collapsing a click's own down+up pair into one action, which is exactly the information
  hold-detection needs to see raw, not have hidden from it.
- **Detecting "held" and actually seeking are two separate, decoupled mechanisms.** Raw events
  only drive a `seekHoldRef` state machine (event count, and a release-watchdog `setTimeout`
  that fires once no further same-direction event arrives within the gap window) - the actual
  repeated `seekBy` calls run on the component's own `setInterval` (`SEEK_HOLD_TICK_MS`, 400ms),
  not once per raw event. This matters because native key-repeat rate is unknown and could be
  much faster than 400ms once it kicks in; seeking on every raw event during a hold would risk
  a runaway, uncontrollably fast seek rather than a smooth ramp.
- **The ramp doubles the per-tick seek multiplier every `SEEK_HOLD_RAMP_TICKS` (3) ticks,
  capped at `SEEK_HOLD_MAX_MULTIPLIER` (8x)** - a DVR-style "gets faster the longer you hold it"
  curve rather than an instant jump to max speed or a flat repeated skip.
- **This whole mechanism is a best-effort design, not something verified against a real key-
  repeat trace** - there's no way to log/inspect the Vega Virtual Device's exact native
  key-repeat timing from outside the app itself, so the 3-events-means-held threshold and the
  400ms/8x ramp curve are tuned from the one platform fact that *is* independently confirmed
  (single press = exactly 2 events), not from having seen what a real hold's event stream looks
  like. If a hold on-device doesn't ramp the way it should, the next step is temporary raw
  `HWEvent` logging during a manual hold test (the same technique that originally nailed down
  the play/pause `eventType` mismatch below), not more guessing from code alone.

### Live TV guide (`LiveTvGuideScreen.tsx`, `LiveTvPlayerScreen.tsx`, `liveTv.ts`)

Phase 3's first slice, deliberately scoped down from the Roadmap's full "Live TV guide + DVR" -
this is channel list + program guide + watching a channel live, **not** recording. Wholphin's
own reference implementation (`ui/detail/livetv/`) is ~2200 lines across 8 files just for this
area, roughly the size of its entire playback view-model - building the whole thing (a
synchronized channels×timeline EPG grid, plus timer/series-timer scheduling) in one pass would
have been a much bigger, riskier undertaking than every other feature in this README, so this
was scoped down first: read-only guide + live playback now, recording scheduling later if
wanted.

- **No separate streaming endpoint for a channel - it's the exact same `negotiatePlayback`
  (`playback.ts`) VOD already uses, but with direct play/stream allowed instead of forced off.**
  A Live TV channel is just another `BaseItemDto` with its own `Id`, so `getPostedPlaybackInfo`
  is the same call VOD makes, not a different client call - but VOD's own `EnableDirectPlay:
  false, EnableDirectStream: false` (forced so seeking into a direct-played raw file doesn't hit
  this platform's seek failure - see the playback correction above) doesn't apply here at all,
  since there's nothing to seek on a live stream. **Confirmed on-device as a real bug**: forcing
  transcode-only the same way VOD does meant the server never populated `TranscodingUrl` for a
  channel, and playback just never started. `negotiatePlayback` now takes an
  `allowDirectPlayback` option (`liveTv`'s `LiveTvPlayerScreen.tsx` is the only caller that
  passes it) that requests direct play/stream *enabled* instead, and falls back to building a
  URL straight from `MediaSourceInfo.Path` (`SupportsDirectPlay`/`SupportsDirectStream`) when
  the server chooses that over transcoding - which is expected for Live TV, since Jellyfin's own
  LiveTV pipeline typically already remuxes tuner input to HLS on its own end before this app
  ever asks. VOD's own call site never passes the option, so its exact previously-tested
  behavior (transcode-only, unconditionally) is unchanged.
- **The lower-level `OpenLiveStream`/`LiveStreamId`/`closeLiveStream` cleanup path exists in the
  SDK too, but isn't wired up here** - it applies to a raw tuner-backed stream opened directly,
  not the HLS URL (whether transcoded or direct-play/stream) this negotiation returns either
  way. If channel-switching turns out to exhaust tuners on some servers, that's the first place
  to look.
- **A separate, much simpler player (`LiveTvPlayerScreen.tsx`), not a parameterized reuse of
  `PlaybackScreens.tsx`'s `PlaybackBody`.** A channel has no duration, can't be seeked or
  resumed, and has no Next Up/Skip Intro-Outro (both depend on a finite timeline or per-item
  segment data a channel doesn't have) - threading all of that through `PlaybackBody` as extra
  conditionals would have made an already-long file harder to follow for both cases. What *is*
  shared: the same low-level primitives (`KeplerVideoSurfaceView`'s manual surface-handle
  handshake, `VideoPlayer`, `ShakaPlayer`) and the same hard-won lifecycle shape - generation
  tracking so a stale, superseded player's late events can't corrupt current state, and the
  same belt-and-suspenders unmount cleanup backing up `onSurfaceViewDestroyed` (which is not
  reliably fired - see the playback correction above for how that was originally confirmed).
  No seek bar, no track picker, no resume position - reported progress is just elapsed
  wall-clock watch time since tune-in (`Date.now() - watchStartedAtRef.current`), the same
  approximation other Jellyfin clients use for a live session, since there's nothing to resume.
- **Channel switching remounts the player body via `key={channelId}`**, the same trick
  `PlaybackScreen`'s own Next Up already uses to swap to a new episode - the outer
  `LiveTvPlayerScreen` holds `channelId` state and the already-fetched channel list (so
  channel-up/down doesn't need to refetch), while the keyed inner body gets a fully fresh
  lifecycle (surface, player, generation counter) per channel rather than trying to hot-swap the
  source on a live player instance.
- **`up`/`channel_up` and `down`/`channel_down` `HWEvent` types drive channel-up/down** -
  `TVTypes.d.ts`'s own `HWEvent` union lists dedicated channel-up/down key types alongside the
  D-pad's plain `up`/`down`, so both are handled the same way (next/previous channel in the
  already-sorted list, wrapping around at either end).
- **A real synchronized channels×timeline grid** - channels pinned in a fixed left column, a
  shared time header pinned at top, and every channel's programs laid out as proportional-width
  cells aligned to that one timeline, all scrolling together. The first version instead rendered
  each channel as its own independently-scrolling `ItemRow` (the same row primitive every other
  horizontal list in this app uses) to avoid a real EPG grid's meaningfully bigger scroll-sync
  problem - reasonable-sounding on paper, but confirmed wrong the moment it was actually seen
  on-device against real Jellyfin clients: no shared timeline, no proportional widths, nothing
  scrolling in sync, so it just didn't read as a "guide." Rebuilt as an actual grid instead of
  keeping the simpler version, per that feedback.
  - **No `FlatList`/`focusItemAlignment` here** - those solve one scroll axis for a single
    uniform list (which is what every other row/grid in this app is), not a two-axis layout
    where three separately-rendered pieces (header, channel column, body) must all move
    together. Structurally: one outer vertical `ScrollView` (channel column + body, so they
    share vertical position automatically as siblings) with a horizontal `ScrollView` nested
    inside the body for the timeline axis, mirrored to the header's own horizontal `ScrollView`
    - the classic frozen-header/frozen-column spreadsheet-grid shape.
  - **Scrolling is entirely programmatic (`scrollOffsetToReveal`, `util/scroll.ts`), not
    native scroll-follows-focus.** Every `ScrollView` here is `scrollEnabled={false}` - there's
    no touch/drag input on this platform to disable, but it also means nothing depends on an
    assumption about whether this platform's focus engine auto-scrolls a plain `ScrollView` to
    keep a newly-focused child visible, which isn't something to take on faith (this project's
    own focus/scroll history has repeatedly found exactly that kind of assumption wrong, most
    recently the side nav's own D-pad-escape gotchas - see Focus system below). Each cell's
    `onFocus` instead computes whether it's already fully visible on both axes and, if not,
    calls `scrollTo` on the body plus whichever of the header/channel-column pieces shares that
    axis.
  - **This is the highest-risk piece built this session** - a genuinely harder TV-focus problem
    than anything else in this app (`ItemGrid`'s own uniform poster grid gets scroll-follow for
    free from `FlatList`; this has no such built-in). Needs careful on-device confirmation of
    whether focus actually lands where expected as it moves between cells/rows, and whether the
    mirrored header/column scrolling visibly lags the body.
  - Fetches a fixed 4-hour window (`GUIDE_WINDOW_HOURS`) rather than paged/scrollable time
    navigation - "browse tonight's primetime lineup" is a real feature this doesn't have yet,
    not an oversight. No "now" position indicator line yet either, for the same reason.
  - **Fixed a real bug found via on-device testing right after this shipped:** channel logos
    rendered at full natural pixel size instead of scaled to fit, bleeding out of their row
    into the timeline area. Cause: `channelLogo`'s `width: '100%'` had no concrete parent width
    to resolve against - the enclosing vertical `ScrollView`'s own `style={{width:
    CHANNEL_COL_WIDTH}}` constrains its *viewport*, not the layout width of its children, and
    nothing in the `Pressable`/`View` chain down to the `Image` set an explicit width either.
    Fixed by giving the channel label's own `Pressable` an explicit `width: CHANNEL_COL_WIDTH -
    8` (`channelLabelWrap`) and adding `overflow: 'hidden'` on the label box as a safety net
    regardless of what caused an oversized child in the future.
  - **Fixed a second real bug found right after that one:** the time header and the program
    cells beneath it were visibly out of sync - cells for a channel's current program rendered
    hundreds of pixels away from the time labels actually above them, with a large empty gap in
    between. Cause: the header's horizontal `ScrollView` and the body's horizontal `ScrollView`
    each resolved their own `flex: 1` width independently (the body's inner horizontal
    `ScrollView` had no `style` at all, relying on default stretch-to-parent that - per the logo
    bug just above - isn't something to trust blindly on this platform), and the two ended up
    different widths. Fixed by measuring the available width *once*, from a single plain `View`
    in the header row (`onTimelineViewportLayout` → `viewportWidth` state), and applying that
    same explicit numeric width to both the header's `ScrollView` and the body's horizontal
    `ScrollView` - one measurement, shared, instead of two independent ones that could disagree.
  - **Added the Home hero's own `Clock` component to this screen's title row too**, gated by
    the same `showClock` setting - an EPG guide benefiting from an at-a-glance current time is
    a fairly universal convention (all of the reference clients compared against showed one),
    and `Clock.tsx` was already a plain, screen-agnostic component with no Home-specific
    dependencies, so this was a straightforward reuse, not a new component.
- **Tapping any program cell - including a channel with no guide data at all - tunes that
  channel live, regardless of which cell was pressed.** There's no way to jump to a future
  program without recording support in scope, so every tap means the same thing; a channel
  with an empty guide window still renders one placeholder cell (`livetv.noGuideData`) so it
  stays reachable rather than silently disappearing from the list.
- **The side nav's library row for a `CollectionType.Livetv` library now opens this guide
  instead of the generic `ItemGrid`** (`MainDrawerNavigator.tsx`) - a plain poster grid doesn't
  suit channels/programs the way it does every other library type. `sortLibrariesByType`
  already placed Live TV libraries in the side nav's Movies → TV Shows → Photos → Live TV
  order (see [Library sort picker](#library-sort-picker-libraryscreenstsx) above); only what
  happens on tap changed here.
- **`RecordingsScreen.tsx` stays an unwired Phase 3 stub, same as `Discover`** - recording
  scheduling (timers, series timers) is explicitly out of scope for this slice, so there's
  nothing yet for a Recordings nav entry to show.

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
| Live TV (guide + playback only, no DVR) | `ui/detail/livetv/` | `src/screens/livetv/`, `src/services/jellyfin/liveTv.ts` |
| Everything else (DVR, music, Seerr/Jellyseerr discover) | `ui/discover/`, DVR/music screens | not started — Phase 2/3 |

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
- **`backBehavior="history"` on `Drawer.Navigator`** - without it (the default is
  `initialRoute`), the hardware back button from *any* `DrawerParamList` screen always landed on
  `Home` regardless of actual navigation history, confirmed on-device as a real bug: library
  grid → item detail → back went to Home instead of back to the grid. Every drill-down screen
  (`ItemGrid`, `MediaItem`, `SeriesOverview`, `Search`, etc.) lives in this same Drawer
  navigator rather than a nested Stack (see the `fullScreen` split above - they need this
  navigator's own persistent side-nav/backdrop chrome), so React Navigation's Drawer/Tab router
  treats each as a top-level destination with no push/pop stack of its own by default;
  `'history'` instead makes it pop to whichever screen was actually focused immediately before,
  which is what a drill-down screen's back button needs. Screens never call `goBack()`
  themselves for this - the platform's own hardware-back-to-`goBack()` wiring already existed,
  this only changes what `goBack()` resolves to on this specific navigator.
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

- **Library rows are sorted by type, not left in whatever order the server returned** -
  `library.ts`'s `sortLibrariesByType` (a stable sort - ties, and any type not in the list,
  keep their original relative order) puts Movies libraries first, then TV Shows, then Photos,
  then Live TV, then everything else. `getUserViews` doesn't group by type on its own (often
  just alphabetical), so without this a Movies and a TV Shows library could land in either
  order depending on how they happen to be named. **Live TV/DVR recordings are not a nav entry
  here** - `RecordingsScreen.tsx` is a registered but unwired Phase 3 stub (matching how
  `Discover` is deliberately left out of the visible menu for the same reason - see below); a
  Live TV *library* (`CollectionType.Livetv`, if the server has one configured) still appears
  as an ordinary library row like any other, just sorted to this position, since browsing one
  already works today via the same generic `ItemGrid` every other library uses.
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

### Library sort picker (`LibraryScreens.tsx`)

The sort control shared by every library-browsing screen (`FilteredCollectionScreen`,
`ItemGridScreen`, `FavoritesScreen`) used to be a single button that cycled to the next field
on each press, always ascending - reaching, say, Rating descending meant repeatedly pressing
through every other field/direction combination first, with no way to land on it directly.
It's now a picker: pressing the button opens a panel listing every field with both its
directions as separate, directly-selectable rows ("A to Z"/"Z to A" for Name, "Newest
First"/"Oldest First" for the two date fields, "Highest First"/"Lowest First" for Rating - not
a generic "Ascending"/"Descending" for all four), so any combination is one press away instead
of several.

- **`LibraryGrid` now takes the current `{ sortBy, direction }` as a controlled prop (`sort`),
  not a `sortable` boolean plus its own separately-tracked cycle index.** The earlier version
  had two pieces of sort state that had to be kept in sync by hand - the parent screen's actual
  `sort` (driving the fetch) and `LibraryGrid`'s own local `sortIndex` (driving what the button
  displayed) - which happened to always agree only because both started at the same default and
  only ever changed together via the same cycle handler. Passing the parent's real value in
  directly removes the duplication; omitting `sort` entirely (not passing `sortable={false}`) is
  what now means "nothing to sort here," for `MoreHomeRowScreen`'s fixed-order home row.
- **Per-field direction phrasing, not one generic Ascending/Descending pair.** `library.ts`'s
  `LIBRARY_SORT_OPTIONS` gives each field a `direction: { asc, desc }` label pair pulled from
  one of three shared sets (`ALPHA_DIRECTION`/`DATE_DIRECTION`/`RATING_DIRECTION`) rather than
  a literal "Ascending"/"Descending" that would read oddly for a date or rating field.
- **The panel mirrors `PlaybackScreens.tsx`'s `TrackPicker` in shape** (grouped headings, rows,
  a Close row) without importing anything from it, since it belongs to an entirely different
  screen - including that same component's already-accepted gap where the remote's back button
  doesn't close it; there's no back-key interception on this screen to hook into, matching that
  precedent rather than adding new behavior this change wasn't asked to fix.
- **Opens with focus already on whichever row matches the current sort.** Each row conditionally
  claims `hasTVPreferredFocus` off `current.sortBy`/`current.direction` rather than always
  defaulting to the first row, so re-opening the picker to change your mind doesn't first
  require re-finding where you already were.
- **The choice is remembered per library/collection, per signed-in Jellyfin user - not
  device-global.** A new `JellyfinUser.librarySort?: Record<string, LibrarySortPreference>`
  field (`storage/types.ts`) lives on the same per-user record `appPreferences`/`pin` already
  do, not on `AppSettingsRepository` (device-local, shared across every profile - the wrong
  place for something the request specifically wanted scoped per user). Each screen keys its
  own entry with the exact same string it already used for `LibraryGrid`'s React `key` prop
  (`` `${parentId}-${includeItemTypes}` `` for `ItemGridScreen`, `` `${itemId}-${parentType}` ``
  for `FilteredCollectionScreen`, a fixed `'favorites'` for `FavoritesScreen`) - "which grid this
  is" turned out to be the same identity needed for both React reconciliation and persistence
  scoping, so no separate key scheme was invented. `ServerRepository.setLibrarySort(key, sortBy,
  direction)` is a new method (mirrors `changeUser`'s own upsert-and-persist shape, but patches
  just this one field on the current user rather than replacing the whole record) that a
  screen's `onSortChange` calls alongside its own local `setSort` - fire-and-forget, matching
  `AppSettingsRepository.update`'s calling convention elsewhere in the Settings screen.
  `library.ts`'s new `resolveLibrarySort(stored)` is what each screen reads the persisted value
  back through - `librarySort`'s `sortBy` is stored as a loose `string`, not the real
  `LibrarySortField` union, specifically so `storage/types.ts` doesn't need to import a
  different feature area's types; `resolveLibrarySort` re-validates it against the real
  `LIBRARY_SORT_OPTIONS` at read time, falling back to the default (Name, Ascending) for a
  missing entry or a stored value that no longer matches any current option.
- **Fixed a real bug found via on-device testing right after this shipped:** picking a sort in
  one library and then clicking a *different* library in the side nav kept using the sort just
  picked, instead of restoring that other library's own remembered choice. Cause:
  `ItemGridScreen`/`FilteredCollectionScreen` are React Navigation screens, and navigating to
  the same route with new params (clicking another library while already on the library-grid
  screen) updates `route.params` on the *same* mounted instance rather than remounting it - so
  `sort`'s lazy `useState` initializer, which only ever runs once at first mount, never re-ran
  for the new library. `LibraryGrid`'s own `key={sortKey}` already remounted *its* local state
  (`viewMode`, `sortPickerOpen`) correctly on a library change; the bug was that the parent
  screen's own `sort` state had no equivalent reset. Fixed with a `useEffect` keyed on `sortKey`
  that explicitly re-resolves `sort` from the new library's persisted value (or the default) any
  time the key changes - the same kind of reset-on-identity-change `LibraryGrid`'s `key` prop
  already handled, just for state that lives one level up where a `key` prop can't reach it.

### Library grids need an explicit item-type filter, or stray Folder items leak in

Found via on-device testing right after the sort picker above shipped: browsing a whole library
from the side nav's library row showed a real, unwanted tile mixed in among actual movies -
blank/imageless, with a title matching the library's own physical on-disk folder name ("movies"
for an English-named library, "films" for a French one).

**Cause**: `MainDrawerNavigator.tsx`'s library row navigated to `ItemGridScreen` with only
`parentId` set, no `includeItemTypes` - relying on `recursive: true` alone to pull in every
descendant item. Without a type filter, that recursive `getItems` call also picks up any
`Folder`-type entries nested anywhere under the library (a stray "extras"/miscellaneous
subfolder, or - as here - the library's own on-disk folder structure surfacing as an item in
its own right), not just the real `Movie`/`Series`/etc. items the grid was meant to show.

**Fix**: `library.ts`'s new `libraryItemKinds(collectionType)` maps a library's own
`CollectionType` to the real `BaseItemKind[]` its full-contents grid should filter to (`Movies`
→ `Movie`, `Tvshows` → `Series`, `Music` → `MusicAlbum`, and so on) - mirrors
`libraryIcons.ts`'s existing `CollectionType`→icon mapping, just for `includeItemTypes` instead
of an icon name. `MainDrawerNavigator.tsx`'s library row now passes
`includeItemTypes: libraryItemKinds(library.CollectionType)` alongside `parentId`, so the query
is scoped to real content items only. Returns `undefined` (no filter, same as before this
existed) for a `CollectionType` this app has no specific mapping for - not every library type
needed to be covered to fix the reported bug, just the two the screenshots showed (Movies, in
two different server display languages).

### Series unwatched-episode badge (`seriesBadge.ts`)

Every card list that can show a Series item (Home rows, library grids, Favorites, "More Like
This"/similar-items rows, Collection detail) now shows a small corner badge with the number of
episodes left to watch, for any series that isn't fully watched - not just the checkmark movies
and fully-watched series already got.

- **`seriesUnwatchedCount(item)`** (`services/jellyfin/seriesBadge.ts`) reads
  `item.UserData?.UnplayedItemCount` - a stock Jellyfin field, already populated server-side for
  Series items whenever a request carries user context, the same one Wholphin's own `GridCard`
  reads (`dto?.userData?.unplayedItemCount`) - no extra `Fields` request param needed. Returns
  `undefined` for anything that isn't a Series, or a Series with nothing left unwatched (count 0
  or missing), so callers can pass its result straight through as a prop without an `if` at each
  call site.
- **Shares the `watched` checkmark's exact corner slot in `CardImage.tsx` rather than adding a
  second, separately-positioned badge** - a series with any unwatched episodes always has
  `Played: false` and vice versa, so the two are already mutually exclusive in the data; a plain
  `unwatchedCount ? <count badge> : watched ? <checkmark> : null` reflects that directly instead
  of risking both rendering at once. Still shifts down to sit below the "E5" episode-number
  badge the same way the checkmark already did, for the rare case both are relevant on the same
  card (they aren't, in practice - `episodeBadge` only appears on Continue Watching/Next Up
  cards, which show an *Episode* item standing in for its series' poster, and `Episode` items
  don't carry their own `UnplayedItemCount`, only `Series`/`Season` parents do - kept anyway
  since it's the same one-line style rule the checkmark already followed, not new complexity).
- **Wired into every call site that already had `watched`/`favorite` props** (`HomeScreen.tsx`,
  `LibraryScreens.tsx`, `PosterRow.tsx`, `CollectionDetail.tsx`) - `EpisodeRow.tsx` and
  `CastRow.tsx` weren't, since they render individual episodes and cast members respectively,
  neither of which this badge applies to.

### Search (`SearchScreen.tsx`, `search.ts`)

Replaces the earlier stub. Results render as up to five separate labeled rows (Movies, TV
Shows, Episodes, Collections, People) rather than one flat mixed list - a direct port of
Wholphin's `SearchPage.kt` approach, since a flat list mixing a movie poster next to an episode
still next to a person's headshot read far worse than grouping does.

- **One `getItems({ searchTerm, includeItemTypes: [kind], recursive: true, limit: 20 })` call
  per type, fired in parallel (`fetchSearchResults`, `services/jellyfin/search.ts`)** - not the
  SDK's separate dedicated `SearchApi.getSearchHints()` endpoint, which exists but which
  Wholphin's own reference implementation doesn't use either; the regular Items API's
  `searchTerm` param is the same call shape every other query in this app already goes through
  (`library.ts`'s `fetchLibraryPage`), so this reuses that convention instead of introducing a
  second, differently-shaped API surface for just this one screen.
- **Scoped to the five types this app actually has a detail page/navigation target for** (see
  `navigateToItem.ts`) - Music/Audio/MusicAlbum etc. exist in `BaseItemKind` and could be
  searched too, but music playback isn't built (Phase 3), so a result there would be a dead
  end. No custom relevance re-ranking of results - the server's own default ordering is used
  as-is, matching this project's habit of trimming a first pass down to what's actually needed
  rather than porting Wholphin's fuller `SearchRelevance` scoring utility up front.
- **750ms debounce** (`SEARCH_DEBOUNCE_MS`), matching Wholphin's own `SearchPage.kt`/
  `SearchForDialog.kt` timing - long enough that a few keystrokes in a row only fire one
  request, short enough that results still feel responsive. A plain `useEffect`+`setTimeout`+
  `cancelled` guard, the same shape every other async-fetch effect in this codebase already
  uses - no separate debounce hook, since this is the only screen that needs one.
  Un-paginated - each row is capped at 20 results with no "view more" expansion, unlike the
  library grids' own infinite-scroll `ItemPager`; a search results *overview* doesn't need full
  pagination the way a dedicated library browse does, and this can be revisited if it turns out
  to matter in practice.
- **The query `TextInput` claims `hasTVPreferredFocus` directly, unlike the sign-in forms'
  own `TextInput`s** (`ServerListScreen.tsx`/`UserListScreen.tsx`, which give initial focus to
  a button below the field instead). Deliberate: a search screen's whole point is typing
  immediately, where landing in a text field by default is exactly what's wanted, unlike a
  server-connect form where that's more of a footgun. Otherwise follows the exact same plain
  `<TextInput>` convention those forms already established (no custom TV-remote keyboard
  gating à la Wholphin's `EditTextBox`/`SearchEditTextBox` - RN-TV's default focus-triggers-the-
  system-keyboard behavior is already relied on elsewhere in this app).
- **Each result row passes `autoFocus={false}`** (`PosterRow`'s own prop for "don't claim
  initial focus here") - the query field is the screen's one authoritative initial focus
  target, the same reasoning every other screen with a more specific initial-focus need already
  follows.

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
  behavior.
- **"Show Clock" (`HomeHero.tsx`), Show Next Up/Auto Play Next Up (see
  [Next Up prompt](#next-up-prompt-nextupcardtsx)), and Skip Intro/Skip Outro (see
  [Skip Intro/Outro](#skip-introoutro-skipsegmentbuttontsx)) are all wired to real behavior.**
  Play Theme Music persists correctly but doesn't drive anything yet (theme-song audio playback
  is its own separate, unbuilt feature), and Updates is an inert display row, not a fake working
  control, since there's no update-check mechanism to wire it to yet - rather than wire a
  setting up to nothing or guess at behavior, `SettingsInertRow.tsx` renders a plain `View`, not
  a `Pressable`, for anything without a real control behind it yet, so D-pad navigation skips it
  entirely instead of landing on a focusable dead end. Interface Language used to be one of
  these too, until [Internationalization](#internationalization-englishfrench) below made it a
  real control.

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

PIN-protected profiles (`JellyfinUser.pin`) are supported end-to-end for the switch-user flow
below: `UserListScreen.tsx`'s `selectUser` routes to `PinEntryScreen` when the tapped profile
has one set. `restoreSession()` (app launch) separately returns `null` for the same reason,
but that path still isn't wired to `PinEntryScreen` — `App.tsx` currently only distinguishes
"no session" vs "session," not "session needs a PIN," so a PIN-protected user's session
silently doesn't restore on relaunch rather than prompting for it.

### Switching servers/users (`UserListScreen.tsx`)

Tapping the side nav's avatar/username row (`MainDrawerNavigator.tsx`'s `DrawerContent` header,
now a `Pressable`) calls `serverRepository.switchUser(currentUser.server.id)` - clears the
active session without forgetting any known server/user. `App.tsx`'s own `currentUser ?
<RootNavigator /> : <SetupNavigator />` check does the rest: once `current` is `null`, the
*entire app* swaps to `SetupNavigator` automatically, no navigation call needed. Signing in
again (as the same user, a different one, or a different server entirely) sets `current`
again, which swaps back to `RootNavigator` just as automatically - the reason
`SetupNavigator`'s existing `ServerList`/`UserList`/`PinEntry` screens could be reused as the
switcher UI outright rather than needing a parallel set built for the post-auth case.

- **`switchUser`, not the plainer pre-existing `switchServerOrUser`, is what the avatar button
  actually calls - the difference matters.** `SetupNavigator` is a *fresh* mount every time
  `App.tsx` swaps to it, so on its own it has no way to know this particular swap was "go back
  to the server I was just on," and defaults to its first screen, `ServerListScreen`'s "add a
  server" flow - confirmed on-device as a real bug, not just a theoretical one: switching users
  landed on "connect to a server" despite already being connected to one, and re-entering that
  same URL created a *second*, duplicate entry for it (see the next bullet for why). `switchUser`
  additionally stashes the server id in a small unpersisted `pendingUserSwitchServerId` field
  (deliberately not written to `AsyncStorage` - it only needs to survive the moment between the
  button press and `SetupNavigator` mounting, in the same app run) before delegating to
  `switchServerOrUser`'s own clear-session behavior; `SetupNavigator` consumes-and-clears it via
  a lazy `useState` initializer at mount to decide its `initialRouteName`
  (`UserList`+`initialParams` instead of `ServerList`) - consumed exactly once, so a later
  genuine cold start, or an explicit "Switch servers" tap from `UserListScreen`, doesn't keep
  jumping back to the same server.
- **Fixed the duplicate-server bug that surfaced while testing the above:**
  `ServerListScreen.tsx`'s "add a server" flow called `generateId()` unconditionally, so
  re-entering a URL that was already known created a second `JellyfinServerUsers` entry for the
  same server (`upsertServer` only dedupes by id, and a fresh id never matches an existing one).
  It now looks up an existing entry by the resolved URL first and reuses that id when there's a
  match, so `upsertServer` correctly updates the existing record in place instead.

- **`UserListScreen.tsx` was rebuilt around a "Select User" avatar-tile row** (known local
  profiles for the current server - `serverRepository.listServers()`, not the server's own
  public-user directory) instead of its previous small tap-to-prefill chip list. Tapping a
  known profile switches to it *instantly* if it has no PIN (`serverRepository.changeUser`
  with its existing stored record, unchanged) - no password re-entry, since a stored access
  token is already there - or routes to `PinEntryScreen` if it does. An "Add User" tile reveals
  the same username/password + Quick Connect sign-in form this screen already had. **The form
  now only ever appears after explicitly tapping "Add User"**, regardless of how many local
  profiles exist - an earlier version auto-opened it by default whenever there was at most one
  known profile, on the theory that "I'm signed in, I want to add someone else" was the common
  case, but on-device this just meant a username/password form was in your face on a screen
  whose whole point was picking an existing avatar; the tile row (with its own "Add User" tile)
  is always what's in front of you now, matching the title too ("Add User" vs. "Select User",
  both reflecting `addUserOpen` directly). The tile row - and with it, tapping your own avatar
  to back out of adding someone without finishing the form - stays visible either way, so
  there's still a way back to the app without needing to know an escape hatch exists. A "Switch
  servers" button goes back to `ServerListScreen`.
- **Known-profile avatars are fetched per-user, authenticated with that profile's own stored
  access token - not via `getUserApi().getPublicUsers()`.** The public-user-directory endpoint
  is opt-out on the server side, and on the test server it's disabled, so `getPublicUsers()`
  silently returned nothing usable and every known profile showed a generic person icon instead
  of their real photo. Each local profile already has its own access token stored from a prior
  sign-in, so `UserListScreen` now calls `getUserApi(api).getCurrentUser()` once per profile,
  each through its own independent `Api` instance (`jellyfinClient.createApiFor(serverUrl,
  token)`, new on `JellyfinClient`) rather than the shared `jellyfinClient` singleton -
  concurrent `Promise.all` calls through the singleton would otherwise race, since `update()`
  mutates and returns the *same* `Api` instance, and one profile's fetch could steal or
  overwrite another's token mid-flight (or the singleton's own unauthenticated state, still used
  elsewhere on this screen for the "Add User" sign-in flow). `createApiFor` builds a genuinely
  separate instance via the underlying `Jellyfin.createApi()` factory instead, safe to use
  side-by-side with the singleton and with each other.
- **Fixed a real bug found while wiring the PIN path into this more:** `PinEntryScreen.tsx`
  cleared the profile's PIN (`{ ...user, pin: null }`) on every *correct* entry, silently
  disabling PIN protection after its first successful use instead of keeping it set for next
  time. Now calls `changeUser` with the stored user unchanged.

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
  (`serverUrl`, `JellyfinClient` including `createApiFor`'s standalone per-user `Api`
  instances), the Jellyfin API layer (`playback` negotiation + progress reporting +
  `fetchNextUpEpisode` + `fetchMediaSegments`, `homeRows` including the Continue Watching/Next Up split,
  `library` including `resolveLibrarySort`'s stored-value validation, `libraryItemKinds`'s
  CollectionType→item-type mapping, `sortLibrariesByType`'s side-nav ordering, and
  `ServerRepository.setLibrarySort`'s per-user persistence, `search`'s per-type parallel
  queries, `liveTv` including the guide's channel-grouping, `formatProgramTimeRange`,
  `isProgramAiring`, `layoutGuideCells`'s proportional cell positioning/window-clipping, and
  `guideTimeLabels`, `detail` including `fetchLocalTrailers` and `fetchEpisodes`'s `People`
  field, `images`
  including the hero's series-aware poster/logo fallbacks and the side nav's avatar lookup,
  `episodeBadge`'s "E5" corner-badge labeling, `seriesBadge`'s unwatched-episode-count badge,
  `libraryIconName`'s CollectionType→icon mapping,
  the `ItemPager` pagination hook), the pure formatting helpers in `util/format.ts` (including
  the shared `formatHeroInfoLine` and `formatSeasonLabel`), `util/scroll.ts`'s
  `scrollOffsetToReveal` (the Live TV guide's scroll-into-view math), `util/useCurrentTime.ts` (the hero
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

## Versioning & releases

Two separate fields track the app's version and don't sync themselves: `package.json`'s
`"version"` and `manifest.toml`'s `[package] version` — the latter is the one that actually
ships in the `.vpkg` and shows in the Amazon Appstore listing. `manifest.toml` deliberately does
**not** carry a `build_number` — that's a separate integer meant to distinguish individual
*upload attempts* within the same version, not something that belongs in a git-tracked file
(the same tagged version can need several re-uploads, e.g. after an Amazon rejection, each
needing its own build number). Leaving it unset defaults to `0`, which Amazon's own VPT upload
validation now rejects outright (`Package validation error ... build_number must be greater than
0, found: 0`, confirmed on a real submission) — so it's supplied at build time instead, via
`vega build`'s `--build-number N` flag, which `npm run release:build` (below) handles
automatically.

**One-time repo setting required before either workflow works**: Settings → Actions → General →
Workflow permissions → check "Allow GitHub Actions to create and approve pull requests." Off by
default on most repos; without it, both `gh pr create` calls below fail with `GraphQL: GitHub
Actions is not permitted to create or approve pull requests`, after already having pushed their
branch/tag/Release - confirmed on-device (so to speak) the first time this ran, leaving an
orphaned branch behind that needed manual cleanup.

**`prepare-release.yml` + `tag-release.yml`** (`.github/workflows/`) automate keeping
`package.json`/`package-lock.json`/`manifest.toml` in sync and tying each release to a GitHub
Release, in two steps rather than one:

1. Run **Prepare Release** manually (Actions tab → pick `patch`/`minor`/`major`). It bumps the
   version in all three files and opens a PR (`release/vX.Y.Z` → `main`) - it does **not** push
   to `main` directly. That's not just caution: `.github/rulesets/protect-main.json` requires
   signed commits on `main` (`required_signatures`) plus a passing `test` status check, and a
   plain `git push` from a runner produces an unsigned commit the ruleset would reject outright.
   Merging a PR through GitHub's own merge button/API produces a GitHub-signed merge commit
   automatically, which is what actually satisfies that rule - pushing straight to `main` was
   never a viable option here, not a first choice that got second-guessed. The ruleset also
   requires at least one approving review (`pull_request` rule, `bypass_actors` is empty so this
   applies to everyone including admins) - since these PRs are authored by `github-actions[bot]`,
   approving them yourself still counts (GitHub only blocks *self*-review, and the bot isn't you),
   but it does mean every automated PR below needs an explicit Approve click before it can merge,
   not just a Merge click.
2. Once that PR is reviewed and merged, **Tag Release** triggers automatically (on any
   `package.json` change landing on `main`), tags `vX.Y.Z`, and publishes a GitHub Release with
   auto-generated notes (from merged PR titles since the last release - this project's existing
   one-PR-per-feature history already reads well that way with no extra changelog upkeep). It
   only actually tags/releases when the **version field itself changed** since the immediately
   prior commit on `main` (`github.event.before`) *and* that version isn't already tagged -
   confirmed the hard way that the weaker "not already tagged" check alone isn't enough: merging
   this automation's own setup PR touched `package.json` (a new npm script, not a version bump)
   and was enough to fire the workflow and tag `v0.0.1`, a version nobody had actually released.
   Pushing a *tag* isn't subject to the branch ruleset at all - that only targets the `main`
   branch ref, not tag refs - so this step can push directly with the default `GITHUB_TOKEN`.
3. The same **Tag Release** run also copies that Release's own generated notes into
   [CHANGELOG.md](CHANGELOG.md) (newest entry on top, existing ones kept below it) and opens a
   *second* PR for that - one source of truth (the Release notes), just also mirrored into a
   repo-tracked file for browsing without leaving the source tree, and for pasting straight into
   an Amazon Appstore "what's new" field at submission time. This PR needs a merge too, for the
   same `required_signatures` reason the version-bump PR does - CHANGELOG.md isn't hand-maintained
   at any point in this flow, so there's nothing to keep in sync by hand, only a PR to approve.

**This only produces a version bump + a GitHub Release (tag, changelog) + a CHANGELOG.md
entry.** It does not build a `.vpkg` or touch the Amazon Appstore - as noted above, the Vega SDK
toolchain isn't available on a GitHub-hosted runner, so building the Release binary and
submitting it through the Amazon Developer Console both stay manual, local steps after the
version bump lands. Deliberately not a self-hosted-runner-based GitHub Action either, even
though that would technically be possible - the actual store submission still isn't scriptable
(no Amazon API for it that I've found), so automating just the build step would trade "run one
npm command" for maintaining a self-hosted runner, without actually reaching a hands-off release.

**`npm run release:build [tag] [buildNumber]`** (`scripts/release-build.sh`) is the guardrail for
that manual build step: rather than trusting whoever's building it to remember to check out the
right tag first, it does that itself - checks out the given tag (or the latest one, if none is
given), refuses to run at all with a dirty working tree (about to switch refs; would either lose
or silently carry over local changes into the build), verifies `package.json`/`manifest.toml`'s
versions actually agree with the tag before building anything (catches a tag created outside
`tag-release.yml`, or a release workflow that partially failed), then runs `npm ci` + the real
`build:release` with an explicit `--build-number` forwarded through (`npm run build:release --
--build-number N`). If no build number is given, it defaults to the current Unix timestamp -
always positive, always higher than the last one, and needs no state tracked anywhere to pick
the "next" number for a re-upload attempt. Leaves the repo in detached HEAD at the built tag on
purpose when it's done - printed at the end, along with how to get back to a branch - rather
than switching back automatically and risking whoever's about to upload the `.vpkg` believing
they built one commit when they actually built another.

## Legal & privacy

`LICENSE` (MIT) and `THIRD-PARTY-NOTICES.md` (Shaka Player, Apache-2.0, vendored under
`src/w3cmedia/shakaplayer/`; `@jellyfin/sdk`, MPL-2.0, used unmodified as a dependency) cover the
repo's own licensing. `docs/privacy.html` is the privacy policy - required by the Amazon Appstore
submission flow, which asks for a reachable URL, not just a file in the repo.

To get that URL: Settings → Pages → Source: "Deploy from a branch" → `main` / `/docs`. Once
enabled, the policy is reachable at `https://mtrepanier.github.io/vegafin/privacy.html` (GitHub
Pages takes a minute or two to build after first enabling, and after each push that changes
`docs/`). That URL is what goes in the Appstore's privacy policy field.

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
  [Internationalization](#internationalization-englishfrench)), and Show Next Up/Auto Play Next
  Up to an actual [end-of-playback card](#next-up-prompt-nextupcardtsx). The side nav's avatar
  now opens a [multi-server/user switcher](#switching-serversusers-userlistscreentsx)
  reusing the pre-auth setup screens, Skip Intro/Skip Outro are wired to a
  [server-driven skip button](#skip-introoutro-skipsegmentbuttontsx), and the remote's
  dedicated FF/RW buttons now
  [ramp into a faster seek the longer they're held](#hold-to-fast-seek-on-the-remotes-ffrw-buttons),
  and [Search](#search-searchscreentsx-searchts) now returns real, grouped results instead of a
  stub. Still open: the behavior behind Play Theme Music (theme-song audio), update checking,
  subtitle customization, trickplay, PIN-lock routing on app-launch session restore
  specifically, a third+ language.
- **Phase 3** (started) — [Live TV channel list + program guide](#live-tv-guide-livetvguidescreentsx-livetvplayerscreentsx-livetvts)
  is done (browse channels, see what's on, watch live); DVR (recording, scheduling) is not.
  Still open: music playback (now playing/visualizer/lyrics), Jellyseerr discover integration,
  screensaver/slideshow, photo albums.

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
                               useCurrentTime.ts (hero clock), uuid.ts, scroll.ts
                               (scrollOffsetToReveal - Live TV guide's scroll-into-view math)
  services/
    jellyfin/                 JellyfinClient.ts (@jellyfin/sdk wrapper), images.ts, ItemPager.ts,
                               homeRows.ts, library.ts, detail.ts, playback.ts, libraryIcons.ts,
                               episodeBadge.ts, seriesBadge.ts, search.ts, liveTv.ts
    storage/ServerRepository.ts   Session/auth (mirrors data/ServerRepository.kt),
                               AppSettingsRepository.ts/AppSettingsContext.tsx (device-local app
                               preferences - see Settings above)
  components/                 ItemRow/ItemGrid/PosterRow, cards/, Clock.tsx (hero top-right
                               clock), HeroInfoLine.tsx (shared rating/info line - see Home
                               screen above), IconButton.tsx
  screens/
    HomeScreen.tsx, HomeHero.tsx, ScreenBackdrop.tsx (full-bleed backdrop layer, shared with
    MovieDetail/SeriesOverview), homeHeroLayout.ts (shared hero/backdrop sizing),
    FavoritesScreen.tsx, SearchScreen.tsx, SeriesOverviewScreen.tsx, MediaItemScreen.tsx
    library/                  FilteredCollection/ItemGrid/MoreHomeRow screens
    detail/                   DetailHero.tsx (shared Movie/SeriesOverview header), Movie/
                               Collection/Person detail (no standalone Episode detail - episodes
                               open on SeriesOverview instead, see Navigation above),
                               TrailerListOverlay.tsx (RemoteTrailers picker, see Movie detail
                               above), series/ (SeasonTabs/EpisodeRow/FocusedEpisodeFooter - the
                               rest of SeriesOverview's parts)
    playback/                 PlaybackScreen, PlaybackListScreen (KeplerVideoSurfaceView + ShakaPlayer),
                               NextUpCard.tsx - see Next Up prompt above; SkipSegmentButton.tsx -
                               see Skip Intro/Outro above
    livetv/                   LiveTvGuideScreen.tsx, LiveTvPlayerScreen.tsx (its own separate,
                               simpler KeplerVideoSurfaceView + ShakaPlayer lifecycle) - see Live
                               TV guide above
    settings/                 SettingsScreen.tsx (real - see Settings above) plus the
                               still-Phase-2-stub HomeSettings/SubtitleSettings/
                               UserAppPreferences screens; SettingsToggle/SettingsStepper/
                               SettingsSection/SettingsInertRow row components
    setup/                     ServerList/UserList ("Select User" avatar tiles + password/Quick
                               Connect sign-in)/PinEntry - reused post-auth too as the side
                               nav's switch-user flow, see Switching servers/users above
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
