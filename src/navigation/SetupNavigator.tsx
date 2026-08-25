import React, { useState } from 'react';
import { createNativeStackNavigator } from '@amazon-devices/react-navigation__native-stack';
import { ServerListScreen } from '../screens/setup/ServerListScreen';
import { UserListScreen } from '../screens/setup/UserListScreen';
import { PinEntryScreen } from '../screens/setup/PinEntryScreen';
import { serverRepository } from '../services/storage/ServerRepository';
import type { SetupStackParamList } from './types';

const Stack = createNativeStackNavigator<SetupStackParamList>();

// Pre-auth flow, mirroring SetupNavigationManager.kt / SetupDestination. Also reused post-auth,
// as the side nav's "switch user" destination - App.tsx swaps to this navigator (a fresh
// mount) any time the active session is cleared, regardless of why.
export function SetupNavigator() {
  // Read once, synchronously, right as this navigator mounts - if the side nav's avatar button
  // just cleared the session for a specific server, this opens straight to that server's user
  // picker instead of ServerListScreen's "add a server" flow, which a genuine cold start (no
  // server ever known) should still see first. Lazy useState, not a plain const, specifically
  // so the consume-and-clear only happens once per mount rather than on every render.
  const [pendingServerId] = useState(() => serverRepository.consumePendingUserSwitchServerId());

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={pendingServerId ? 'UserList' : 'ServerList'}>
      <Stack.Screen name="ServerList" component={ServerListScreen} />
      <Stack.Screen name="UserList" component={UserListScreen} initialParams={pendingServerId ? { serverId: pendingServerId } : undefined} />
      <Stack.Screen name="PinEntry" component={PinEntryScreen} />
    </Stack.Navigator>
  );
}
