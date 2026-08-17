import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { jellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { serverRepository } from '../../services/storage/ServerRepository';
import { useTheme } from '../../theme/ThemeContext';
import type { SetupStackParamList } from '../../navigation/types';

type Route = RouteProp<SetupStackParamList, 'UserList'>;

// ui/setup/UserList.kt equivalent - public user picker + username/password login form.
// Note: no explicit navigation call on successful login - App.tsx swaps SetupNavigator
// for RootNavigator automatically once useCurrentUser() reports a restored session.
export function UserListScreen() {
  const { colors } = useTheme();
  const { params } = useRoute<Route>();
  const entry = serverRepository.listServers().find((s) => s.server.id === params.serverId);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [publicUsers, setPublicUsers] = useState<{ Id?: string | null; Name?: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    const api = jellyfinClient.update(entry.server.url, null);
    if (!api) return;
    getUserApi(api)
      .getPublicUsers()
      .then(({ data }) => setPublicUsers(data))
      .catch(() => setPublicUsers([]));
  }, [entry]);

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.onBackground }}>Unknown server</Text>
      </View>
    );
  }

  const login = async (name: string, pw: string) => {
    setError(null);
    const api = jellyfinClient.update(entry.server.url, null);
    if (!api) return;
    try {
      const { data } = await getUserApi(api).authenticateUserByName({
        authenticateUserByName: { Username: name, Pw: pw },
      });
      if (!data.AccessToken || !data.User?.Id) {
        throw new Error('Server did not return an access token');
      }
      const newUser = {
        id: data.User.Id,
        name: data.User.Name ?? name,
        serverId: entry.server.id,
        accessToken: data.AccessToken,
        pin: null,
        requireLogin: false,
        lastUsed: new Date().toISOString(),
        uiLanguage: null,
        appPreferences: {
          preferredAudioLanguage: 'USE_USER_PROFILE',
          preferredSubtitleLanguage: 'USE_USER_PROFILE',
          subtitleMode: 'USE_USER_PROFILE' as const,
        },
      };
      await serverRepository.changeUser(entry.server, newUser);
      // Navigating away happens automatically: RootNavigator swaps to the main app once
      // useCurrentUser() reports a session (see App.tsx).
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>
        {entry.server.name ?? entry.server.url}
      </Text>

      <FlatList
        horizontal
        data={publicUsers}
        keyExtractor={(u) => u.Id ?? u.Name ?? ''}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setUsername(item.Name ?? '')}
            style={[styles.userChip, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.onBackground }}>{item.Name}</Text>
          </Pressable>
        )}
      />

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username"
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.onSurfaceVariant}
        secureTextEntry
        style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
      />
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      <Pressable
        onPress={() => login(username, password)}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={{ color: colors.onPrimary }}>Sign in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { padding: 12, borderRadius: 8, alignItems: 'center' },
  userChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginRight: 8 },
});
