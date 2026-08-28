/**
 * The canonical catalog - every other language (`fr.ts`) is typed as `Record<TranslationKey,
 * string>` against this one's keys, so TypeScript itself catches a translation falling out of
 * sync (a key added here without a French counterpart is a compile error, not a silent
 * English fallback discovered later on a French device). Keys are namespaced by screen/concern
 * (`settings.*`, `nav.*`, `player.*`, ...), not full sentences, per usual i18n practice - see
 * `src/i18n/translate.ts` for the `{placeholder}` interpolation syntax used in values below.
 *
 * `common.*` holds strings reused verbatim across multiple unrelated screens (e.g. "More Like
 * This" on both Movie detail and Series overview) - one key, not one per call site, so a
 * translation only needs updating in one place.
 */
export const en = {
  // Side nav (MainDrawerNavigator.tsx)
  'nav.search': 'Search',
  'nav.home': 'Home',
  'nav.favorites': 'Favorites',
  'nav.settings': 'Settings',

  // Reused across multiple screens - see the file-level comment above.
  'common.play': 'Play',
  'common.resume': 'Resume',
  'common.playAll': 'Play All',
  'common.shuffle': 'Shuffle',
  'common.trailer': 'Trailer',
  'common.trailers': 'Trailers',
  'common.favorite': 'Favorite',
  'common.markAsWatched': 'Mark as Watched',
  'common.markAsUnwatched': 'Mark as Unwatched',
  'common.castAndCrew': 'Cast & Crew',
  'common.moreLikeThis': 'More Like This',
  'common.guestStars': 'Guest Stars',
  'common.movies': 'Movies',
  'common.tvShows': 'TV Shows',
  'common.episodes': 'Episodes',
  'common.viewAll': 'View All',
  'common.back': 'Back',
  'common.close': 'Close',
  'common.cancel': 'Cancel',
  'common.off': 'Off',
  'common.user': 'User',
  'common.library': 'Library',
  'common.unknownServer': 'Unknown server',
  'common.trailerFallback': 'Trailer {number}',
  'common.dismiss': 'Dismiss',

  // Settings screen
  'settings.title': 'Settings',
  'settings.section.interface': 'Interface',
  'settings.section.playback': 'Playback',
  'settings.section.userSettings': 'User Settings',
  'settings.section.about': 'About',
  'settings.showClock': 'Show Clock',
  'settings.playThemeMusic': 'Play Theme Music',
  'settings.themeMusic.disabled': 'Disabled',
  'settings.themeMusic.low': 'Low',
  'settings.themeMusic.medium': 'Medium',
  'settings.themeMusic.high': 'High',
  'settings.themeMusic.full': 'Full',
  'settings.hideControlsAfter': 'Hide Playback Controls After',
  'settings.skipForward': 'Skip Forward',
  'settings.skipBackward': 'Skip Backward',
  'settings.showNextUp': 'Show Next Up',
  'settings.showNextUp.atEnd': 'At the End of Playback',
  'settings.showNextUp.duringCredits': 'During End Credits',
  'settings.showNextUp.never': 'Never',
  'settings.autoPlayNextUp': 'Auto Play Next Up',
  'settings.skipIntro': 'Skip Intro',
  'settings.skipOutro': 'Skip Outro',
  'settings.skipSegment.ask': 'Ask',
  'settings.skipSegment.auto': 'Auto-Skip',
  'settings.skipSegment.off': 'Off',
  'settings.interfaceLanguage': 'Interface Language',
  'settings.language.system': 'Device Default',
  'settings.language.en': 'English',
  'settings.language.fr': 'Français',
  'settings.version': 'Version',
  'settings.updates': 'Updates',
  'settings.updates.notAvailable': 'Not available yet',
  'settings.seconds': '{value}s',

  // Time/date formatting (util/format.ts)
  'time.left': '{value} left',
  'time.hoursMinutes': '{hours}h {minutes}m',
  'time.minutes': '{minutes}m',
  'season.numbered': 'Season {number}',
  'season.specials': 'Specials',
  'season.fallback': 'Season',
  'episode.badge': 'E{number}',
  'episode.seasonEpisode': 'S{season} E{episode}',

  // Detail pages (Movie/Collection/Person/Series)
  'detail.person.bornOn': 'Born {date}',
  'detail.person.diedOn': 'Died {date}',

  // Playback
  'player.preparingPlayback': 'Preparing playback...',
  'player.preparingPlaybackAttempt': 'Preparing playback... (attempt {attempt})',
  'player.startingVideoAttempt': 'Starting video... (attempt {attempt})',
  'player.buffering': 'Buffering...',
  'player.stalledBuffering': 'Playback stalled. Buffering...',
  'player.playbackFailed': 'Playback failed.',
  'player.audio': 'Audio',
  'player.subtitles': 'Subtitles',
  'player.trackFallback': 'Track {number}',
  'player.shakaTimeout': 'Playback timed out after {seconds}s.',
  'player.streamEngineError': 'Stream engine error {code} (category {category})',
  'player.playNow': 'Play Now',
  'player.nextUpCountdown': 'Playing in {seconds}s',
  'player.skipIntro': 'Skip Intro',
  'player.skipOutro': 'Skip Outro',

  // Setup / sign-in
  'setup.addServer': 'Add a Jellyfin server',
  'setup.connect': 'Connect',
  'setup.selectUser': 'Select User',
  'setup.addUser': 'Add User',
  'setup.switchServers': 'Switch servers',
  'setup.enterServerAddress': 'Enter a server address.',
  'setup.unableToReachServer': 'Unable to reach the server.',
  'setup.username': 'Username',
  'setup.password': 'Password',
  'setup.signIn': 'Sign in',
  'setup.signInWithCode': 'Sign in with a code',
  'setup.quickConnectInstructions': 'On your phone or computer, open Jellyfin, go to Quick Connect, and enter this code.',
  'setup.couldNotStartQuickConnect': 'Could not start Quick Connect: {detail}',
  'setup.quickConnectSignInFailed': 'Quick Connect sign-in failed: {detail}',
  'setup.loginFailed': 'Login failed',
  'setup.enterPinFor': 'Enter PIN for {name}',
  'setup.incorrectPin': 'Incorrect PIN',
  'setup.serverDidNotReturnUserId': 'Server did not return a user id',
  'setup.serverDidNotReturnAccessToken': 'Server did not return an access token',

  // Library browsing
  'library.sortPrefix': 'Sort: {label}',
  'library.grid': 'Grid',
  'library.list': 'List',
  'library.browse': 'Browse',
  'library.sort.folder': 'Folder',
  'library.sort.name': 'Name',
  'library.sort.dateAdded': 'Date Added',
  'library.sort.releaseDate': 'Release Date',
  'library.sort.rating': 'Rating',
  'library.sort.direction.aToZ': 'A to Z',
  'library.sort.direction.zToA': 'Z to A',
  'library.sort.direction.newestFirst': 'Newest First',
  'library.sort.direction.oldestFirst': 'Oldest First',
  'library.sort.direction.highestFirst': 'Highest First',
  'library.sort.direction.lowestFirst': 'Lowest First',
  'library.sort.direction.foldersFirst': 'Folders First',
  'library.sort.direction.foldersLast': 'Folders Last',

  // Home rows
  'home.continueWatching': 'Continue Watching',
  'home.nextUp': 'Next Up',
  'home.latestLibrary': 'Latest {libraryName}',

  // Live TV
  'livetv.guide': 'Live TV',
  'livetv.noChannels': 'No channels available',
  'livetv.noGuideData': 'No listings available',
  'livetv.onNow': 'On Now',
  'livetv.live': 'LIVE',

  // Search
  'search.placeholder': 'Search movies, shows, people...',
  'search.searching': 'Searching...',
  'search.noResults': 'No results for "{query}"',
  'search.section.movies': 'Movies',
  'search.section.series': 'TV Shows',
  'search.section.episodes': 'Episodes',
  'search.section.collections': 'Collections',
  'search.section.people': 'People',

  // Placeholder screens not built yet (Phase 2/3) - see StubScreen.tsx
  'stub.phase1': 'Phase 1',
  'stub.phase2': 'Phase 2',
  'stub.phase3': 'Phase 3',
  'stub.homeSettings': 'Home Settings',
  'stub.subtitleSettings': 'Subtitle Settings',
  'stub.userPreferences': 'User Preferences',
  'stub.debug': 'Debug',
  'stub.mediaItem': 'Media Item',
  'stub.recordings': 'Recordings',
  'stub.updateApp': 'Update App',
  'stub.licenses': 'Licenses',
  'stub.nowPlaying': 'Now Playing',
  'stub.discover': 'Discover',
  'stub.discoveredItem': 'Discovered Item',
  'stub.discoverMoreResults': 'Discover More Results',
} as const;

export type TranslationKey = keyof typeof en;
