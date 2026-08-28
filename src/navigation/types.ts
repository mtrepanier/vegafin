import type { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { CompositeNavigationProp } from '@amazon-devices/react-navigation__native';
import type { DrawerNavigationProp } from '@amazon-devices/react-navigation__drawer';
import type { NativeStackNavigationProp } from '@amazon-devices/react-navigation__native-stack';

/**
 * Mirrors ui/nav/Destination.kt's sealed class. Split into two param lists along the same
 * `fullScreen` boolean the Kotlin side uses to decide drawer chrome vs. a bare full-screen
 * push: `fullScreen: false` destinations live in DrawerParamList (rendered inside the
 * persistent nav drawer, like NavDrawer.kt), `fullScreen: true` ones live in
 * RootStackParamList (pushed over everything, like Backdrop-less screens on Android).
 *
 * Kotlin's `Destination.ItemGrid<T>`/`MoreHomeRow` carry a generic `RequestHandler<T>` that
 * doesn't have a plain-data equivalent. Since Phase 1's home rows are a fixed set (see
 * `services/jellyfin/homeRows.ts`) rather than the Kotlin app's user-configurable ones,
 * `MoreHomeRow` instead carries a `HomeRowRef` identifying which fixed row to re-fetch, and
 * `ItemGrid` carries the minimal `getItems` filter needed for the grids Phase 1 actually links
 * to (a library's full contents, a genre/studio's items).
 */

export interface SeasonEpisodeIds {
  seasonId?: string;
  episodeId?: string;
}

/** Identifies one of Phase 1's fixed home rows, for `MoreHomeRowScreen` to re-fetch paged. */
export type HomeRowRef = { kind: 'continueWatching' } | { kind: 'nextUp' } | { kind: 'recentlyAdded'; libraryId: string };

export type DrawerParamList = {
  Home: { id?: number } | undefined;
  Search: { query?: string } | undefined;
  SeriesOverview: { itemId: string; type: BaseItemKind; seasonEpisode?: SeasonEpisodeIds };
  MediaItem: { itemId: string; type: BaseItemKind; collectionType?: CollectionType; initialSongId?: string };
  Recordings: { itemId: string };
  FilteredCollection: {
    itemId: string;
    parentType: BaseItemKind;
    collectionType: CollectionType;
    recursive: boolean;
  };
  ItemGrid: { title: string; parentId?: string; includeItemTypes?: BaseItemKind[]; recursive?: boolean; initialPosition?: number };
  MoreHomeRow: { title: string; row: HomeRowRef; initialPosition?: number };
  Favorites: undefined;
  LiveTvGuide: undefined;
  Discover: undefined;
  DiscoveredItem: { itemId: string };
  DiscoverMoreResult: { type: string; startIndex?: number };
};

export type RootStackParamList = {
  Main: undefined; // Hosts the drawer navigator (DrawerParamList).
  HomeSettings: undefined;
  Settings: undefined;
  SubtitleSettings: { hdr: boolean };
  UserAppPreferences: undefined;
  Playback: {
    itemId: string;
    positionMs: number;
    shuffle?: boolean;
  };
  PlaybackList: {
    itemId: string;
    startIndex?: number;
    shuffle?: boolean;
    recursive?: boolean;
  };
  LiveTvPlayback: { channelId: string };
  Slideshow: { parentId: string; itemId: string };
  NowPlaying: undefined;
  UpdateApp: undefined;
  License: undefined;
  Debug: undefined;
};

export type SetupStackParamList = {
  ServerList: undefined;
  UserList: { serverId: string };
  PinEntry: { serverId: string; userId: string };
};

/**
 * Every drawer-hosted screen (Home, detail pages, library grids, ...) needs to navigate both
 * within the drawer (another item's detail page) and out to the root stack (Playback). This
 * composes both so screens don't have to hand-roll the union themselves.
 */
export type AppNavigationProp<T extends keyof DrawerParamList> = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, T>,
  NativeStackNavigationProp<RootStackParamList>
>;
