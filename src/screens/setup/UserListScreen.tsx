import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableStateCallbackType } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import type { NativeStackNavigationProp } from '@amazon-devices/react-navigation__native-stack';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api';
import { getQuickConnectApi } from '@jellyfin/sdk/lib/utils/api/quick-connect-api';
import type { Api } from '@jellyfin/sdk/lib/api';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import type { QuickConnectResult } from '@jellyfin/sdk/lib/generated-client/models/quick-connect-result';
import { jellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { serverRepository } from '../../services/storage/ServerRepository';
import { userImageUrl } from '../../services/jellyfin/images';
import { useTheme } from '../../theme/ThemeContext';
import { useT } from '../../i18n/useTranslation';
import type { TFunction } from '../../i18n/useTranslation';
import { useDeferredKeyboardFocus } from '../../focus/useDeferredKeyboardFocus';
import type { JellyfinServer, JellyfinUser } from '../../services/storage/types';
import type { SetupStackParamList } from '../../navigation/types';

type Route = RouteProp<SetupStackParamList, 'UserList'>;

const QUICK_CONNECT_POLL_MS = 2000;
const AVATAR_SIZE = 96;

/** Calls GET /QuickConnect/Connect?secret=... directly via `api.getUri()`/`api.axiosInstance`
 * instead of the SDK's generated `getQuickConnectApi(api).getQuickConnectState()`. That
 * generated helper builds its query string via `url.search = searchParams.toString()` on a
 * native `URL` instance, and that whole-string assignment silently no-ops here (confirmed:
 * the request went out as bare `/QuickConnect/Connect` with no query string at all, and the
 * server correctly 400'd with "secret field is required"). `api.getUri()` builds the same
 * query string through axios's own serialization instead, which doesn't hit this - it's the
 * same call pattern already used for stream URLs elsewhere in this codebase. */
async function getQuickConnectState(api: Api, secret: string): Promise<QuickConnectResult> {
  const url = api.getUri('/QuickConnect/Connect', { secret });
  const { data } = await api.axiosInstance.get<QuickConnectResult>(url, {
    headers: { Authorization: api.authorizationHeader },
  });
  return data;
}

/** Builds the local JellyfinUser record and commits the session, shared by both the
 * password and Quick Connect sign-in paths - a *new* sign-in, not switching to an
 * already-known local profile (that's `serverRepository.changeUser` called directly with the
 * existing stored record instead - see `UserListScreen`'s `selectUser` - since rebuilding a
 * fresh record here would silently wipe that profile's own pin/appPreferences). */
async function signInUser(server: JellyfinServer, user: UserDto, accessToken: string, t: TFunction) {
  if (!user.Id) {
    throw new Error(t('setup.serverDidNotReturnUserId'));
  }
  const newUser = {
    id: user.Id,
    name: user.Name ?? t('common.user'),
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
  const t = useT();
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
      .catch((initiateError) => {
        console.error('[VegaFin] Quick Connect initiate failed:', initiateError);
        if (!cancelledRef.current) {
          const detail = initiateError instanceof Error ? initiateError.message : String(initiateError);
          onError(t('setup.couldNotStartQuickConnect', { detail }));
        }
      });

    const poll = setInterval(async () => {
      if (!secretRef.current || cancelledRef.current) {
        return;
      }
      try {
        const data = await getQuickConnectState(api, secretRef.current);
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
          throw new Error(t('setup.serverDidNotReturnAccessToken'));
        }
        await signInUser(server, auth.User, auth.AccessToken, t);
      } catch (pollError) {
        const axiosLike = pollError as { config?: { url?: string }; response?: { status?: number; data?: unknown } };
        console.error(
          '[VegaFin] Quick Connect poll failed:',
          pollError,
          'url:', axiosLike?.config?.url,
          'status:', axiosLike?.response?.status,
          'body:', JSON.stringify(axiosLike?.response?.data),
        );
        if (!cancelledRef.current) {
          setAuthenticating(false);
          const detail = pollError instanceof Error ? pollError.message : String(pollError);
          const bodyText = JSON.stringify(axiosLike?.response?.data);
          onError(`${t('setup.quickConnectSignInFailed', { detail })} | url: ${axiosLike?.config?.url} | body: ${bodyText}`);
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
          <Text style={[styles.quickConnectHelp, { color: colors.onSurfaceVariant }]}>{t('setup.quickConnectInstructions')}</Text>
        </>
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
      <Pressable onPress={onCancel}>
        {({ focused }: PressableStateCallbackType) => {
          const cancelStyle = [styles.quickConnectCancel, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
          return (
            <View style={cancelStyle}>
              <Text style={{ color: colors.primary }}>{t('common.cancel')}</Text>
            </View>
          );
        }}
      </Pressable>
    </View>
  );
}

/** One known local profile's avatar tile ("Select User" row) - switches to it directly (no
 * re-auth needed, it already has a stored access token) unless it's PIN-protected, in which
 * case it routes to PinEntryScreen instead. A separate "Sign out" row beneath the label forgets
 * this profile (`serverRepository.removeUser`) - its own focusable Pressable, not folded into
 * the avatar's, so a remote user has to deliberately navigate down to it rather than risk
 * hitting it via the same press that switches profiles. */
function UserTile({
  user,
  avatarUri,
  busy,
  hasTVPreferredFocus,
  onPress,
  onSignOut,
}: {
  user: JellyfinUser;
  avatarUri?: string;
  busy: boolean;
  hasTVPreferredFocus?: boolean;
  onPress: () => void;
  onSignOut: () => void;
}) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={styles.userTile}>
      <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress}>
        {({ focused }: PressableStateCallbackType) => {
          const avatarStyle = [styles.userAvatar, { borderColor: focused ? colors.border : 'transparent', backgroundColor: colors.surfaceVariant }];
          return (
            <View style={avatarStyle}>
              {busy ? (
                <ActivityIndicator color={colors.primary} />
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Icon name="person" size={36} color={colors.onSurfaceVariant} />
              )}
            </View>
          );
        }}
      </Pressable>
      <Text numberOfLines={1} style={[styles.userTileLabel, { color: colors.onBackground }]}>
        {user.name}
      </Text>
      <Pressable onPress={onSignOut}>
        {({ focused }: PressableStateCallbackType) => {
          const signOutStyle = [styles.signOutRow, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
          return (
            <View style={signOutStyle}>
              <Icon name="logout" size={12} color={colors.onSurfaceVariant} />
              <Text style={[styles.signOutLabel, { color: colors.onSurfaceVariant }]}>{t('setup.signOut')}</Text>
            </View>
          );
        }}
      </Pressable>
    </View>
  );
}

function AddUserTile({ hasTVPreferredFocus, onPress }: { hasTVPreferredFocus?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const avatarStyle = [styles.userAvatar, { borderColor: focused ? colors.border : 'transparent', backgroundColor: colors.surfaceVariant }];
        return (
          <View style={styles.userTile}>
            <View style={avatarStyle}>
              <Icon name="add" size={36} color={colors.onSurfaceVariant} />
            </View>
            <Text numberOfLines={1} style={[styles.userTileLabel, { color: colors.onBackground }]}>
              {t('setup.addUser')}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

// ui/setup/UserList.kt equivalent - "Select User" avatar picker for known local profiles on
// this server, an "Add User" tile revealing username/password + Quick Connect sign-in, and a
// way back to the server list. Reused both pre-auth (SetupNavigator, no session restored yet)
// and post-auth (the side nav's avatar button calls serverRepository.switchServerOrUser(),
// which clears the active session without forgetting any known server/user - App.tsx's own
// currentUser check then swaps back and forth between this navigator and the main app
// automatically, so this screen doesn't need to know or care which case it's in).
// Note: no explicit navigation call on successful login/switch - App.tsx swaps SetupNavigator
// for RootNavigator automatically once useCurrentUser() reports a session.
export function UserListScreen() {
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<SetupStackParamList, 'UserList'>>();
  const { params } = useRoute<Route>();
  const entry = serverRepository.listServers().find((s) => s.server.id === params.serverId);
  const localUsers = entry?.users ?? [];
  // Stable key for the avatar-fetch effect below - `entry` itself is a fresh object every
  // render (`listServers()` isn't memoized), so depending on `entry` directly re-ran that
  // effect (and its own `setAvatarByUserId` call) on every render, hammering `getCurrentUser()`
  // in a tight infinite loop - confirmed on-device via a native SIGSEGV traced back to
  // GET /Users/Me firing repeatedly within the same millisecond. Only changes when the server
  // or the actual set of known users/tokens changes.
  const avatarFetchKey = entry ? `${entry.server.url}|${entry.users.map((u) => `${u.id}:${u.accessToken}`).join(',')}` : '';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const usernameField = useDeferredKeyboardFocus();
  const passwordField = useDeferredKeyboardFocus();
  // Each known local profile's own avatar URL, keyed by user id - fetched with that profile's
  // own stored access token (see the effect below) rather than via getPublicUsers(), which
  // returns nothing useful whenever a server has public user listing disabled.
  const [avatarByUserId, setAvatarByUserId] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [quickConnecting, setQuickConnecting] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);
  // Only ever revealed by explicitly tapping the "Add User" tile - even with zero known
  // profiles, the picker (with its own "Add User" tile) is what should be in front of you, not
  // a username/password form you didn't ask for yet.
  const [addUserOpen, setAddUserOpen] = useState(false);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    Promise.all(
      entry.users.map(async (user) => {
        try {
          const api = jellyfinClient.createApiFor(entry.server.url, user.accessToken);
          const { data } = await getUserApi(api).getCurrentUser();
          return [user.id, userImageUrl(data, AVATAR_SIZE)] as const;
        } catch {
          return [user.id, undefined] as const;
        }
      }),
    ).then((pairs) => {
      if (!cancelled) setAvatarByUserId(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarFetchKey]);

  if (!entry) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.onBackground }}>{t('common.unknownServer')}</Text>
      </View>
    );
  }

  const selectUser = async (user: JellyfinUser) => {
    if (user.pin) {
      navigation.navigate('PinEntry', { serverId: entry.server.id, userId: user.id });
      return;
    }
    setError(null);
    setSwitchingUserId(user.id);
    try {
      // The existing stored record, unchanged - not rebuilt via signInUser, which would reset
      // this profile's own pin/appPreferences back to defaults.
      await serverRepository.changeUser(entry.server, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('setup.loginFailed'));
    } finally {
      setSwitchingUserId(null);
    }
  };

  // Forgets this local profile (`serverRepository.removeUser` already handles clearing the
  // active session if it happened to be this one). `setAvatarByUserId` here is doing double
  // duty - dropping the stale cached avatar and forcing this component to re-render, since
  // `entry`/`localUsers` are read fresh from `serverRepository.listServers()` every render
  // rather than through a subscribed store (see `avatarFetchKey`'s own comment above).
  const signOutUser = async (user: JellyfinUser) => {
    await serverRepository.removeUser(user);
    setAvatarByUserId((prev) => {
      const next = { ...prev };
      delete next[user.id];
      return next;
    });
  };

  const login = async (name: string, pw: string) => {
    setError(null);
    const api = jellyfinClient.update(entry.server.url, null);
    if (!api) return;
    try {
      const { data } = await getUserApi(api).authenticateUserByName({
        authenticateUserByName: { Username: name, Pw: pw },
      });
      if (!data.AccessToken || !data.User) {
        throw new Error(t('setup.serverDidNotReturnAccessToken'));
      }
      await signInUser(entry.server, data.User, data.AccessToken, t);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('setup.loginFailed'));
    }
  };

  const quickConnectButtonStyle = [styles.button, { borderWidth: 1, borderColor: colors.primary }];

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{t(addUserOpen ? 'setup.addUser' : 'setup.selectUser')}</Text>
      <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{entry.server.name ?? entry.server.url}</Text>

      <View style={styles.userTiles}>
        {localUsers.map((user, index) => (
          <UserTile
            key={user.id}
            user={user}
            avatarUri={avatarByUserId[user.id]}
            busy={switchingUserId === user.id}
            hasTVPreferredFocus={index === 0}
            onPress={() => selectUser(user)}
            onSignOut={() => signOutUser(user)}
          />
        ))}
        <AddUserTile hasTVPreferredFocus={localUsers.length === 0} onPress={() => setAddUserOpen(true)} />
      </View>

      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}

      <Pressable onPress={() => navigation.navigate('ServerList')}>
        {({ focused }: PressableStateCallbackType) => {
          const switchServersStyle = [styles.button, styles.switchServersButton, { borderColor: colors.border, backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
          return (
            <View style={switchServersStyle}>
              <Icon name="swap-horiz" size={18} color={colors.onSurfaceVariant} />
              <Text style={{ color: colors.onSurfaceVariant }}>{t('setup.switchServers')}</Text>
            </View>
          );
        }}
      </Pressable>

      {addUserOpen ? (
        <View style={styles.addUserForm}>
          <TextInput
            ref={usernameField.ref}
            value={username}
            onChangeText={setUsername}
            placeholder={t('setup.username')}
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            showSoftInputOnFocus={usernameField.showSoftInputOnFocus}
            onPress={usernameField.onPress}
            onBlur={usernameField.onBlur}
            style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
          />
          <TextInput
            ref={passwordField.ref}
            value={password}
            onChangeText={setPassword}
            placeholder={t('setup.password')}
            placeholderTextColor={colors.onSurfaceVariant}
            secureTextEntry
            showSoftInputOnFocus={passwordField.showSoftInputOnFocus}
            onPress={passwordField.onPress}
            onBlur={passwordField.onBlur}
            style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
          />
          <Pressable hasTVPreferredFocus onPress={() => login(username, password)}>
            {({ focused }: PressableStateCallbackType) => (
              <View style={[styles.button, { backgroundColor: focused ? colors.onBackground : colors.primary }]}>
                <Text style={{ color: focused ? colors.background : colors.onPrimary }}>{t('setup.signIn')}</Text>
              </View>
            )}
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
            <Pressable onPress={() => { setError(null); setQuickConnecting(true); }}>
              {({ focused }: PressableStateCallbackType) => {
                const codeButtonStyle = [...quickConnectButtonStyle, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
                return (
                  <View style={codeButtonStyle}>
                    <Text style={{ color: colors.primary }}>{t('setup.signInWithCode')}</Text>
                  </View>
                );
              }}
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 32, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 8 },
  userTiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24 },
  userTile: { alignItems: 'center', width: AVATAR_SIZE + 16, gap: 8 },
  userAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userTileLabel: { fontSize: 14, fontWeight: '600' },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  signOutLabel: { fontSize: 11 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { padding: 12, borderRadius: 8, alignItems: 'center' },
  switchServersButton: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 20 },
  addUserForm: { gap: 16, maxWidth: 420, alignSelf: 'center', width: '100%' },
  quickConnect: { borderWidth: 1, borderRadius: 8, padding: 20, alignItems: 'center', gap: 12 },
  quickConnectCode: { fontSize: 40, fontWeight: '700', letterSpacing: 8 },
  quickConnectCancel: { marginTop: 4 },
  quickConnectHelp: { textAlign: 'center' },
});
