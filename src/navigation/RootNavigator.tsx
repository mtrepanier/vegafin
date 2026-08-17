import React from 'react';
import { createNativeStackNavigator } from '@amazon-devices/react-navigation__native-stack';
import { MainDrawerNavigator } from './MainDrawerNavigator';
import {
  HomeSettingsScreen,
  SettingsScreen,
  SubtitleSettingsScreen,
  UserAppPreferencesScreen,
} from '../screens/settings/SettingsScreens';
import { PlaybackScreen, PlaybackListScreen } from '../screens/playback/PlaybackScreens';
import { SlideshowScreen } from '../screens/SlideshowScreen';
import { NowPlayingScreen } from '../screens/music/NowPlayingScreen';
import { UpdateAppScreen } from '../screens/UpdateAppScreen';
import { LicenseScreen } from '../screens/LicenseScreen';
import { DebugScreen } from '../screens/DebugScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Hosts every `fullScreen = true` Destination from Destination.kt as a plain stack push
 * (no drawer chrome), with "Main" holding the drawer-chrome destinations
 * (MainDrawerNavigator / DrawerParamList).
 */
export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainDrawerNavigator} />
      <Stack.Screen name="HomeSettings" component={HomeSettingsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="SubtitleSettings" component={SubtitleSettingsScreen} />
      <Stack.Screen name="UserAppPreferences" component={UserAppPreferencesScreen} />
      <Stack.Screen name="Playback" component={PlaybackScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="PlaybackList" component={PlaybackListScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Slideshow" component={SlideshowScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="NowPlaying" component={NowPlayingScreen} />
      <Stack.Screen name="UpdateApp" component={UpdateAppScreen} />
      <Stack.Screen name="License" component={LicenseScreen} />
      <Stack.Screen name="Debug" component={DebugScreen} />
    </Stack.Navigator>
  );
}
