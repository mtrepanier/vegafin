import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createDrawerNavigator, type DrawerContentComponentProps } from '@amazon-devices/react-navigation__drawer';
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
import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

// The persistent left-hand menu, matching NavDrawer.kt. Only a curated subset of
// DrawerParamList routes are surfaced here - the rest (MediaItem, SeriesOverview, etc.)
// are pushed onto this same navigator from elsewhere so they keep the drawer/backdrop
// chrome (Backdrop.kt) without being menu entries themselves.
function DrawerContent({ navigation, state }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const items: { label: string; route: keyof DrawerParamList }[] = [
    { label: 'Home', route: 'Home' },
    { label: 'Search', route: 'Search' },
    { label: 'Favorites', route: 'Favorites' },
    { label: 'Discover', route: 'Discover' },
  ];
  const containerStyle = [styles.container, { backgroundColor: colors.surface }];
  return (
    <View style={containerStyle}>
      {items.map((item) => {
        const focused = state.routeNames[state.index] === item.route;
        const rowStyle = [styles.row, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
        const labelStyle = [styles.label, { color: focused ? colors.onPrimaryContainer : colors.onSurface }];
        return (
          <Pressable key={item.route} onPress={() => navigation.navigate(item.route as never)} style={rowStyle}>
            <Text style={labelStyle}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 16, gap: 8 },
  row: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  label: { fontSize: 16 },
});

export function MainDrawerNavigator() {
  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false, drawerType: 'permanent', drawerStyle: { width: 240 } }}
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
  );
}
