import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { createDrawerNavigator, type DrawerContentComponentProps } from '@amazon-devices/react-navigation__drawer';
import type { NativeStackNavigationProp } from '@amazon-devices/react-navigation__native-stack';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SeriesOverviewScreen } from '../screens/SeriesOverviewScreen';
import { MediaItemScreen } from '../screens/MediaItemScreen';
import { RecordingsScreen } from '../screens/RecordingsScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { LiveTvGuideScreen } from '../screens/livetv/LiveTvGuideScreen';
import {
  FilteredCollectionScreen,
  ItemGridScreen,
  MoreHomeRowScreen,
} from '../screens/library/LibraryScreens';
import {
  DiscoverScreen,
  DiscoveredItemScreen,
  DiscoverMoreResultScreen,
} from '../screens/discover/DiscoverScreens';
import { useTheme } from '../theme/ThemeContext';
import { FocusGroup } from '../focus/FocusGroup';
import { useFocusGroupExpanded } from '../focus/useFocusGroupExpanded';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { serverRepository } from '../services/storage/ServerRepository';
import { jellyfinClient } from '../services/jellyfin/JellyfinClient';
import { fetchUserLibraries } from '../services/jellyfin/homeRows';
import { userImageUrl } from '../services/jellyfin/images';
import { libraryIconName } from '../services/jellyfin/libraryIcons';
import { libraryItemKinds, sortLibrariesByType } from '../services/jellyfin/library';
import { ScreenBackdropContext } from './screenBackdropContext';
import { ScreenBackdrop } from '../screens/ScreenBackdrop';
import { useT } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';
import type { DrawerParamList, RootStackParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 72;

const FIXED_ITEMS: { labelKey: TranslationKey; route: keyof DrawerParamList; icon: string }[] = [
  { labelKey: 'nav.search', route: 'Search', icon: 'search' },
  { labelKey: 'nav.home', route: 'Home', icon: 'home' },
  { labelKey: 'nav.favorites', route: 'Favorites', icon: 'favorite' },
];

/**
 * Whether the drawer is expanded (full labels) or collapsed (icon rail only), and the
 * focus-tracking calls that drive it. Threaded via context rather than props so
 * `drawerContent={DrawerContent}` can stay a stable component reference (an inline arrow
 * function there would create a new component type every render - see
 * `react/no-unstable-nested-components`).
 */
const DrawerExpandedContext = createContext<{ expanded: boolean; reveal: () => void; release: () => void }>({
  expanded: false,
  reveal: () => {},
  release: () => {},
});

function DrawerRow({
  icon,
  label,
  active,
  expanded,
  onFocus,
  onBlur,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  expanded: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onFocus={onFocus} onBlur={onBlur} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const highlighted = focused || active;
        const rowStyle = [styles.row, { backgroundColor: highlighted ? colors.primaryContainer : 'transparent' }];
        const labelStyle = [styles.label, { color: highlighted ? colors.onPrimaryContainer : colors.onSurface }];
        const iconColor = highlighted ? colors.onPrimaryContainer : colors.onSurfaceVariant;
        return (
          <View style={rowStyle}>
            <Icon name={icon} size={22} color={iconColor} />
            {expanded ? (
              <Text numberOfLines={1} style={labelStyle}>
                {label}
              </Text>
            ) : null}
          </View>
        );
      }}
    </Pressable>
  );
}

// The persistent left-hand menu, matching NavDrawer.kt. Only a curated subset of
// DrawerParamList routes are surfaced here - the rest (MediaItem, SeriesOverview, etc.)
// are pushed onto this same navigator from elsewhere so they keep the drawer/backdrop
// chrome (Backdrop.kt) without being menu entries themselves.
function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const t = useT();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const { expanded, reveal, release } = useContext(DrawerExpandedContext);
  const { item: backdropItem } = useContext(ScreenBackdropContext);
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [libraries, setLibraries] = useState<BaseItemDto[]>([]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    getUserApi(jellyfinClient.api)
      .getCurrentUser()
      .then(({ data }) => {
        if (!cancelled) setAvatarUri(userImageUrl(data, 90));
      })
      .catch(() => {});
    fetchUserLibraries(userId).then((items) => {
      if (!cancelled) setLibraries(sortLibrariesByType(items));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Transparent while the active screen has a backdrop up, so ScreenBackdrop.tsx's full-bleed
  // image (rendered one level up, behind this whole navigator) shows through instead of being
  // hidden behind the rail's own solid background - see screenBackdropContext.ts.
  const containerStyle = [
    styles.container,
    { backgroundColor: backdropItem ? 'transparent' : colors.surface, width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH },
  ];
  const avatarStyle = [styles.avatar, { backgroundColor: colors.surfaceVariant }];

  return (
    <View style={containerStyle}>
      {/* trapFocusUp/Down: reaching the header (topmost) or the last row (bottommost) should
          stop there, not escape into whatever's above/below the drawer on screen. Now wraps the
          header too, not just the row list below it - the header became focusable (the
          switch-user button) at the same time this comment was written, and trapFocusUp on a
          group covering only the rows would make the header unreachable by D-pad from within
          the rail entirely (nothing above the rail to escape *into* otherwise). Left/right stay
          untrapped - the drawer must let focus escape right into the main content, and the main
          content's own screens (Home's rows, library grids) let focus escape left back in, see
          ItemGrid.tsx's trapFocusLeft removal. */}
      <FocusGroup trapFocusUp trapFocusDown style={styles.contentGroup}>
        {/* Taps into serverRepository.switchUser() - clears the active session without
            forgetting any known server/user, which makes App.tsx's own currentUser check swap
            this whole navigator out for SetupNavigator automatically (see its ServerList/
            UserList screens - reused as the switcher UI, not a separate screen built for this).
            No explicit navigation call needed here at all. switchUser (not the plainer
            switchServerOrUser) also remembers the current server, so SetupNavigator opens
            straight to that server's user picker instead of "add a server". */}
        <Pressable
          onFocus={reveal}
          onBlur={release}
          onPress={() => currentUser && serverRepository.switchUser(currentUser.server.id)}
        >
          {({ focused }: PressableStateCallbackType) => {
            const headerStyle = [styles.header, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
            const textColor = focused ? colors.onPrimaryContainer : colors.onSurface;
            const subTextColor = focused ? colors.onPrimaryContainer : colors.onSurfaceVariant;
            return (
              <View style={headerStyle}>
                <View style={avatarStyle}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Icon name="person" size={20} color={colors.onSurfaceVariant} />
                  )}
                </View>
                {expanded ? (
                  <View style={styles.headerText}>
                    <Text numberOfLines={1} style={[styles.username, { color: textColor }]}>
                      {currentUser?.user.name ?? t('common.user')}
                    </Text>
                    <Text numberOfLines={1} style={[styles.serverName, { color: subTextColor }]}>
                      {currentUser?.server.name ?? currentUser?.server.url}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        </Pressable>

        <ScrollView focusItemAlignment="start" style={styles.rowsScroll} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
          {FIXED_ITEMS.map((item) => (
            <DrawerRow
              key={item.route}
              icon={item.icon}
              label={t(item.labelKey)}
              active={state.routeNames[state.index] === item.route}
              expanded={expanded}
              onFocus={reveal}
              onBlur={release}
              onPress={() => navigation.navigate(item.route as never)}
            />
          ))}

          {libraries.length > 0 ? (
            <View style={styles.librarySection}>
              {libraries.map((library) => (
                <DrawerRow
                  key={library.Id}
                  icon={libraryIconName(library)}
                  label={library.Name ?? t('common.library')}
                  expanded={expanded}
                  onFocus={reveal}
                  onBlur={release}
                  onPress={() => {
                    if (!library.Id) return;
                    if (library.CollectionType === CollectionType.Livetv) {
                      // A generic poster grid doesn't suit channels/programs the way it does
                      // every other library type - see LiveTvGuideScreen.tsx's own comment.
                      navigation.navigate('LiveTvGuide');
                      return;
                    }
                    if (library.CollectionType === CollectionType.Photos || library.CollectionType === CollectionType.Homevideos) {
                      // Photo libraries are organized as nested album folders, unlike the flat
                      // movie/show libraries this screen otherwise browses recursively - a
                      // recursive, Photo-only fetch would flatten every album into one grid
                      // instead of showing the top-level albums to tap into (see
                      // navigateToItem.ts's PhotoAlbum/Folder case for going a level deeper).
                      // No includeItemTypes filter, unlike every other library type: that filter
                      // exists specifically to hide stray folder tiles (see library.ts's own
                      // comment) - here the folders are exactly what should show. Homevideos
                      // ("Home Videos & Photos") is included alongside Photos - confirmed
                      // on-device that a personal photo library is commonly configured as
                      // Homevideos rather than the more narrowly-named Photos type, and it's
                      // organized the same folder-of-mixed-photos/videos way.
                      navigation.navigate('ItemGrid', {
                        title: library.Name ?? t('common.library'),
                        parentId: library.Id,
                        recursive: false,
                      });
                      return;
                    }
                    navigation.navigate('ItemGrid', {
                      title: library.Name ?? t('common.library'),
                      parentId: library.Id,
                      includeItemTypes: libraryItemKinds(library.CollectionType),
                    });
                  }}
                />
              ))}
            </View>
          ) : null}

          {/* Last row, always - Settings lives on RootStackParamList (a bare full-screen push,
              not drawer chrome, matching every other Settings-ish screen), so this navigates via
              the drawer's *parent* stack navigator rather than the drawer's own navigate(). */}
          <DrawerRow
            icon="settings"
            label={t('nav.settings')}
            expanded={expanded}
            onFocus={reveal}
            onBlur={release}
            onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Settings')}
          />
        </ScrollView>
      </FocusGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  transparentScene: { backgroundColor: 'transparent' },
  container: { flex: 1, paddingTop: 24, paddingHorizontal: 12, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 12, marginBottom: 12, borderRadius: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerText: { flex: 1, gap: 2 },
  username: { fontSize: 15, fontWeight: '700' },
  serverName: { fontSize: 12 },
  contentGroup: { flex: 1 },
  rowsScroll: { flex: 1 },
  rows: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  label: { fontSize: 15, flex: 1 },
  librarySection: { marginTop: 16, gap: 4 },
});

export function MainDrawerNavigator() {
  const { colors } = useTheme();
  const { expanded, reveal, release } = useFocusGroupExpanded();
  const expandedContextValue = useMemo(() => ({ expanded, reveal, release }), [expanded, reveal, release]);
  const [backdropItem, setBackdropItem] = useState<BaseItemDto | null>(null);
  const backdropContextValue = useMemo(() => ({ item: backdropItem, setItem: setBackdropItem }), [backdropItem]);

  return (
    <ScreenBackdropContext.Provider value={backdropContextValue}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Rendered here, not inside whichever screen set it, so it can go full-bleed behind
            the side nav rail below - a screen's own tree only ever occupies the content pane
            to the rail's right. */}
        <ScreenBackdrop item={backdropItem} />
        <DrawerExpandedContext.Provider value={expandedContextValue}>
          <Drawer.Navigator
            // Default backBehavior ('initialRoute') always sent the hardware back button to
            // Home regardless of actual navigation history - confirmed on-device: library grid
            // -> item detail -> back landed on Home instead of the grid. 'history' instead pops
            // to whichever drawer screen was actually focused before (the grid, in that case) -
            // every drill-down screen (ItemGrid, MediaItem, SeriesOverview, Search, etc.) lives
            // in this same Drawer navigator rather than a nested stack (see navigation/types.ts's
            // DrawerParamList/RootStackParamList split comment for why - they need this
            // navigator's own persistent chrome/backdrop), so this is the one place that can fix
            // this for all of them at once.
            backBehavior="history"
            screenOptions={{
              headerShown: false,
              drawerType: 'permanent',
              // backgroundColor here (not just DrawerContent's own inner container below) is
              // required for real transparency: react-native-drawer-layout wraps whatever
              // drawerContent renders in its own Animated.View, styled from this same
              // drawerStyle option plus its own colors.card default - that outer wrapper paints
              // an opaque background *in front of* HomeHeroBackdrop regardless of what
              // DrawerContent's own background is set to, so both have to go transparent
              // together.
              drawerStyle: {
                width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                backgroundColor: backdropItem ? 'transparent' : colors.surface,
                // react-native-drawer-layout draws a hairline border between a `permanent`
                // drawer and the content pane by default, colored from the navigation theme's
                // `colors.border` (App.tsx maps that straight to our own `colors.border` - the
                // TV focus-ring color, not a chrome/divider color) - showed up as a stray
                // purple line between the rail and the screen. Zeroed out rather than
                // recolored, since this app has no other use for a divider there.
                borderRightWidth: 0,
              },
            }}
            drawerContent={DrawerContent}
          >
            {/* sceneStyle transparent on Home, SeriesOverview, and MediaItem only: every
                Drawer.Screen is wrapped by the navigator's own Screen/Background, which
                unconditionally paints an opaque colors.background over the whole content pane
                and would otherwise hide ScreenBackdrop completely, not just behind the nav
                rail. MediaItem covers Movie/Episode/Collection/Person detail (see
                MediaItemScreen.tsx) - only MovieDetail.tsx currently sets a backdrop, so the
                others just fall through to this View's own colors.background below, same as
                before. Every other screen keeps the navigator's default opaque background. */}
            <Drawer.Screen name="Home" component={HomeScreen} options={{ sceneStyle: styles.transparentScene }} />
            <Drawer.Screen name="Search" component={SearchScreen} />
            <Drawer.Screen name="SeriesOverview" component={SeriesOverviewScreen} options={{ sceneStyle: styles.transparentScene }} />
            <Drawer.Screen name="MediaItem" component={MediaItemScreen} options={{ sceneStyle: styles.transparentScene }} />
            <Drawer.Screen name="Recordings" component={RecordingsScreen} />
            <Drawer.Screen name="FilteredCollection" component={FilteredCollectionScreen} />
            <Drawer.Screen name="ItemGrid" component={ItemGridScreen} />
            <Drawer.Screen name="MoreHomeRow" component={MoreHomeRowScreen} />
            <Drawer.Screen name="Favorites" component={FavoritesScreen} />
            <Drawer.Screen name="LiveTvGuide" component={LiveTvGuideScreen} />
            <Drawer.Screen name="Discover" component={DiscoverScreen} />
            <Drawer.Screen name="DiscoveredItem" component={DiscoveredItemScreen} />
            <Drawer.Screen name="DiscoverMoreResult" component={DiscoverMoreResultScreen} />
          </Drawer.Navigator>
        </DrawerExpandedContext.Provider>
      </View>
    </ScreenBackdropContext.Provider>
  );
}
