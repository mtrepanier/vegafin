import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { createDrawerNavigator, type DrawerContentComponentProps } from '@amazon-devices/react-navigation__drawer';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { SeriesOverviewScreen } from '../screens/SeriesOverviewScreen';
import { MediaItemScreen } from '../screens/MediaItemScreen';
import { RecordingsScreen } from '../screens/RecordingsScreen';
import { FavoritesScreen } from '../screens/FavoritesScreen';
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
import { jellyfinClient } from '../services/jellyfin/JellyfinClient';
import { fetchUserLibraries } from '../services/jellyfin/homeRows';
import { userImageUrl } from '../services/jellyfin/images';
import { libraryIconName } from '../services/jellyfin/libraryIcons';
import { ScreenBackdropContext } from './screenBackdropContext';
import { ScreenBackdrop } from '../screens/ScreenBackdrop';
import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 72;

const FIXED_ITEMS: { label: string; route: keyof DrawerParamList; icon: string }[] = [
  { label: 'Search', route: 'Search', icon: 'search' },
  { label: 'Home', route: 'Home', icon: 'home' },
  { label: 'Favorites', route: 'Favorites', icon: 'favorite' },
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
      if (!cancelled) setLibraries(items);
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
      <View style={styles.header}>
        <View style={avatarStyle}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <Icon name="person" size={20} color={colors.onSurfaceVariant} />
          )}
        </View>
        {expanded ? (
          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.username, { color: colors.onSurface }]}>
              {currentUser?.user.name ?? 'User'}
            </Text>
            <Text numberOfLines={1} style={[styles.serverName, { color: colors.onSurfaceVariant }]}>
              {currentUser?.server.name ?? currentUser?.server.url}
            </Text>
          </View>
        ) : null}
      </View>

      {/* trapFocusUp/Down: reaching the first/last row should stop there, not escape into
          whatever's above/below the drawer on screen. Left/right are left untrapped - the
          drawer must let focus escape right into the main content, and the main content's own
          screens (Home's rows, library grids) let focus escape left back in, see ItemGrid.tsx's
          trapFocusLeft removal. */}
      <FocusGroup trapFocusUp trapFocusDown style={styles.rowsGroup}>
        <ScrollView focusItemAlignment="start" contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
          {FIXED_ITEMS.map((item) => (
            <DrawerRow
              key={item.route}
              icon={item.icon}
              label={item.label}
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
                  label={library.Name ?? 'Library'}
                  expanded={expanded}
                  onFocus={reveal}
                  onBlur={release}
                  onPress={() =>
                    library.Id && navigation.navigate('ItemGrid', { title: library.Name ?? 'Library', parentId: library.Id })
                  }
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </FocusGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  transparentScene: { backgroundColor: 'transparent' },
  container: { flex: 1, paddingTop: 24, paddingHorizontal: 12, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingVertical: 12, marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerText: { flex: 1, gap: 2 },
  username: { fontSize: 15, fontWeight: '700' },
  serverName: { fontSize: 12 },
  rowsGroup: { flex: 1 },
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
            {/* sceneStyle transparent on Home and MediaItem only: every Drawer.Screen is
                wrapped by the navigator's own Screen/Background, which unconditionally paints
                an opaque colors.background over the whole content pane and would otherwise
                hide ScreenBackdrop completely, not just behind the nav rail. MediaItem covers
                Movie/Episode/Collection/Person detail (see MediaItemScreen.tsx) - only
                MovieDetail.tsx currently sets a backdrop, so the others just fall through to
                this View's own colors.background below, same as before. Every other screen
                keeps the navigator's default opaque background. */}
            <Drawer.Screen name="Home" component={HomeScreen} options={{ sceneStyle: styles.transparentScene }} />
            <Drawer.Screen name="Search" component={SearchScreen} />
            <Drawer.Screen name="SeriesOverview" component={SeriesOverviewScreen} />
            <Drawer.Screen name="MediaItem" component={MediaItemScreen} options={{ sceneStyle: styles.transparentScene }} />
            <Drawer.Screen name="Recordings" component={RecordingsScreen} />
            <Drawer.Screen name="FilteredCollection" component={FilteredCollectionScreen} />
            <Drawer.Screen name="ItemGrid" component={ItemGridScreen} />
            <Drawer.Screen name="MoreHomeRow" component={MoreHomeRowScreen} />
            <Drawer.Screen name="Favorites" component={FavoritesScreen} />
            <Drawer.Screen name="Discover" component={DiscoverScreen} />
            <Drawer.Screen name="DiscoveredItem" component={DiscoveredItemScreen} />
            <Drawer.Screen name="DiscoverMoreResult" component={DiscoverMoreResultScreen} />
          </Drawer.Navigator>
        </DrawerExpandedContext.Provider>
      </View>
    </ScreenBackdropContext.Provider>
  );
}
