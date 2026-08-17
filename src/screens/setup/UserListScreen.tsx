import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { getQuickConnectApi } from '@jellyfin/sdk/lib/utils/api/quick-connect-api';
import type { Api } from '@jellyfin/sdk/lib/api';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { jellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { serverRepository } from '../../services/storage/ServerRepository';
import { useTheme } from '../../theme/ThemeContext';
import type { JellyfinServer } from '../../services/storage/types';
import type { SetupStackParamList } from '../../navigation/types';

type Route = RouteProp<SetupStackParamList, 'UserList'>;

const QUICK_CONNECT_POLL_MS = 2000;

/** Builds the local JellyfinUser record and commits the session, shared by both the
 * password and Quick Connect sign-in paths. */
async function signInUser(server: JellyfinServer, user: UserDto, accessToken: string) {
  if (!user.Id) {
    throw new Error('Server did not return a user id');
  }
  const newUser = {
    id: user.Id,
    name: user.Name ?? 'User',
    serverId: server.id,
    accessToken,
    pin: null,
    requireLogin: false,
    lastUsed: new Date().toISOString(),
    uiLanguage: null,
    appPreferences: {
      preferredAudioLanguage: 'USE_USER_PROFILE' as const,
      preferredSubtitleLanguage: 'USE_USER_PROFILE' as const,
      subtitleMode: 'USE_USER_PROFILE' as const,
    },
  };
  await serverRepository.changeUser(server, newUser);
}

/** Sign-in-with-a-code panel: initiates a request, displays the code, and polls until
 * another already-authenticated client (mobile app, web) approves it. Mirrors Wholphin's
 * Quick Connect support in ui/setup/UserList.kt. */
function QuickConnectPanel({
  api,
  server,
  onCancel,
  onError,
}: {
  api: Api;
  server: JellyfinServer;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const { colors } = useTheme();
  const [code, setCode] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const secretRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    getQuickConnectApi(api)
      .initiateQuickConnect()
      .then(({ data }) => {
        if (cancelledRef.current || !data.Secret || !data.Code) {
          return;
        }
        secretRef.current = data.Secret;
        setCode(data.Code);
      })
      .catch(() => {
        if (!cancelledRef.current) {
          onError('Could not start Quick Connect - is it enabled on this server?');
        }
      });

    const poll = setInterval(async () => {
      if (!secretRef.current || cancelledRef.current) {
        return;
      }
      try {
        const { data } = await getQuickConnectApi(api).getQuickConnectState({ secret: secretRef.current });
        if (!data.Authenticated || cancelledRef.current) {
          return;
        }
        clearInterval(poll);
        setAuthenticating(true);
        const { data: auth } = await getUserApi(api).authenticateWithQuickConnect({
          quickConnectDto: { Secret: secretRef.current },
        });
        if (cancelledRef.current) {
          return;
        }
        if (!auth.AccessToken || !auth.User) {
          throw new Error('Server did not return an access token');
        }
        await signInUser(server, auth.User, auth.AccessToken);
      } catch {
        if (!cancelledRef.current) {
          setAuthenticating(false);
          onError('Quick Connect sign-in failed');
        }
      }
    }, QUICK_CONNECT_POLL_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return (
    <View style={[styles.quickConnect, { borderColor: colors.border }]}>
      {authenticating ? (
        <ActivityIndicator color={colors.primary} />
      ) : code ? (
        <>
          <Text style={[styles.quickConnectCode, { color: colors.onSurface }]}>{code}</Text>
          <Text style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}>
            On your phone or computer, open Jellyfin, go to Quick Connect, and enter this code.
          </Text>
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
      <Pressable onPress={onCancel} style={styles.quickConnectCancel}>
        <Text style={{ color: colors.primary }}>Cancel</Text>
      </Pressable>
    </View>
  );
}

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
  const [quickConnecting, setQuickConnecting] = useState(false);

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
      if (!data.AccessToken || !data.User) {
        throw new Error('Server did not return an access token');
      }
      await signInUser(entry.server, data.User, data.AccessToken);
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

      {quickConnecting ? (
        <QuickConnectPanel
          api={jellyfinClient.update(entry.server.url, null)!}
          server={entry.server}
          onCancel={() => setQuickConnecting(false)}
          onError={(message) => {
            setQuickConnecting(false);
            setError(message);
          }}
        />
      ) : (
        <Pressable
          onPress={() => {
            setError(null);
            setQuickConnecting(true);
          }}
          style={[styles.button, { borderWidth: 1, borderColor: colors.primary }]}
        >
          <Text style={{ color: colors.primary }}>Sign in with a code</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { padding: 12, borderRadius: 8, alignItems: 'center' },
  userChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginRight: 8 },
  quickConnect: { borderWidth: 1, borderRadius: 8, padding: 20, alignItems: 'center', gap: 12 },
  quickConnectCode: { fontSize: 40, fontWeight: '700', letterSpacing: 8 },
  quickConnectCancel: { marginTop: 4 },
});
