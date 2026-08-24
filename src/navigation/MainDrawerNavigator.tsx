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

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.surface, width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH },
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
  const { expanded, reveal, release } = useFocusGroupExpanded();
  const expandedContextValue = useMemo(() => ({ expanded, reveal, release }), [expanded, reveal, release]);

  return (
    <DrawerExpandedContext.Provider value={expandedContextValue}>
      <Drawer.Navigator
        screenOptions={{
          headerShown: false,
          drawerType: 'permanent',
          drawerStyle: { width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH },
        }}
        drawerContent={DrawerContent}
      >
        <Drawer.Screen name="Home" component={HomeScreen} />
        <Drawer.Screen name="Search" component={SearchScreen} />
        <Drawer.Screen name="SeriesOverview" component={SeriesOverviewScreen} />
        <Drawer.Screen name="MediaItem" component={MediaItemScreen} />
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
  );
}
