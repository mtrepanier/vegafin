import React from 'react';
import { createNativeStackNavigator } from '@amazon-devices/react-navigation__native-stack';
import { ServerListScreen } from '../screens/setup/ServerListScreen';
import { UserListScreen } from '../screens/setup/UserListScreen';
import { PinEntryScreen } from '../screens/setup/PinEntryScreen';
import type { SetupStackParamList } from './types';

const Stack = createNativeStackNavigator<SetupStackParamList>();

// Pre-auth flow, mirroring SetupNavigationManager.kt / SetupDestination.
export function SetupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ServerList" component={ServerListScreen} />
      <Stack.Screen name="UserList" component={UserListScreen} />
      <Stack.Screen name="PinEntry" component={PinEntryScreen} />
    </Stack.Navigator>
  );
}
