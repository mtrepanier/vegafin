import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, type PressableStateCallbackType } from 'react-native';
import { useNavigation } from '@amazon-devices/react-navigation__native';
import type { NativeStackNavigationProp } from '@amazon-devices/react-navigation__native-stack';
import Icon from '../../components/Icon';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { jellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { getServerUrlCandidates } from '../../services/jellyfin/serverUrl';
import { serverRepository } from '../../services/storage/ServerRepository';
import type { JellyfinServer } from '../../services/storage/types';
import { useTheme } from '../../theme/ThemeContext';
import { generateId } from '../../util/uuid';
import { useT } from '../../i18n/useTranslation';
import { useDeferredKeyboardFocus } from '../../focus/useDeferredKeyboardFocus';
import type { SetupStackParamList } from '../../navigation/types';

// ui/setup/ServerList.kt equivalent - lists known servers and lets the user add a new one.
export function ServerListScreen() {
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation<NativeStackNavigationProp<SetupStackParamList, 'ServerList'>>();
  const [url, setUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlField = useDeferredKeyboardFocus();
  // `serverRepository.listServers()` isn't itself reactive (see UserListScreen.tsx's own
  // avatar-fetch bug for why depending on its *object* identity is dangerous) - this screen just
  // re-reads it fresh every render, and `forgetTick` exists purely to force one of those renders
  // right after removeServer() actually changes the underlying list.
  const [, setForgetTick] = useState(0);
  const servers = serverRepository.listServers();

  const forgetServer = async (server: JellyfinServer) => {
    await serverRepository.removeServer(server);
    setForgetTick((n) => n + 1);
  };

  const addServer = async () => {
    if (!url.trim() || connecting) return;
    setError(null);
    setConnecting(true);
    try {
      // The user's typed URL is never stored as-is: a schemeless or mixed-case one breaks the
      // native media pipeline later even though JS-side API calls tolerate it fine (see
      // serverUrl.ts). Probe candidates against the real server and persist whichever answers.
      const candidates = getServerUrlCandidates(url);
      if (!candidates.length) {
        throw new Error(t('setup.enterServerAddress'));
      }

      let resolvedUrl: string | null = null;
      let serverName: string | null = null;
      let serverVersion: string | null = null;
      let firstError: unknown;

      for (const candidate of candidates) {
        try {
          const api = jellyfinClient.update(candidate, null);
          if (!api) continue;
          const { data } = await getSystemApi(api).getPublicSystemInfo();
          resolvedUrl = candidate;
          serverName = data.ServerName ?? null;
          serverVersion = data.Version ?? null;
          break;
        } catch (e) {
          firstError = firstError ?? e;
        }
      }

      if (!resolvedUrl) {
        throw firstError instanceof Error ? firstError : new Error(t('setup.unableToReachServer'));
      }

      // Reuse an already-known server's own id when the resolved URL matches one - a fresh
      // generateId() here regardless created a second, duplicate entry for the same server
      // (upsertServer only dedupes by id, and a brand new id never matches an existing one)
      // whenever someone re-entered a URL they'd already connected to before.
      const existingId = serverRepository.listServers().find((s) => s.server.url === resolvedUrl)?.server.id;
      const server = {
        id: existingId ?? generateId(),
        name: serverName,
        url: resolvedUrl,
        version: serverVersion,
        lastUsed: new Date().toISOString(),
      };
      await serverRepository.addAndChangeServer(server);
      navigation.navigate('UserList', { serverId: server.id });
      setUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('setup.unableToReachServer'));
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{t('setup.addServer')}</Text>
      <TextInput
        ref={urlField.ref}
        value={url}
        onChangeText={setUrl}
        placeholder="https://jellyfin.example.com"
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        autoCorrect={false}
        showSoftInputOnFocus={urlField.showSoftInputOnFocus}
        onPress={urlField.onPress}
        onBlur={urlField.onBlur}
        style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
      />
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      <Pressable hasTVPreferredFocus onPress={addServer}>
        {({ focused }: PressableStateCallbackType) => {
          const buttonStyle = [styles.button, { backgroundColor: focused ? colors.onBackground : colors.primary }];
          const labelColor = focused ? colors.background : colors.onPrimary;
          return (
            <View style={buttonStyle}>
              {connecting ? <ActivityIndicator color={labelColor} /> : <Text style={{ color: labelColor }}>{t('setup.connect')}</Text>}
            </View>
          );
        }}
      </Pressable>

      <FlatList
        style={styles.list}
        data={servers}
        keyExtractor={(item) => item.server.id}
        initialNumToRender={8}
        windowSize={5}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews
        renderItem={({ item }) => (
          <View style={styles.serverRow}>
            <Pressable style={styles.serverRowMain} onPress={() => navigation.navigate('UserList', { serverId: item.server.id })}>
              {({ focused }: PressableStateCallbackType) => {
                const rowStyle = [styles.row, { borderColor: colors.surfaceVariant, backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
                return (
                  <View style={rowStyle}>
                    <Text style={{ color: colors.onBackground }}>{item.server.name ?? item.server.url}</Text>
                  </View>
                );
              }}
            </Pressable>
            <Pressable onPress={() => forgetServer(item.server)}>
              {({ focused }: PressableStateCallbackType) => {
                const forgetButtonStyle = [styles.forgetButton, { backgroundColor: focused ? colors.primaryContainer : 'transparent' }];
                return (
                  <View style={forgetButtonStyle}>
                    <Icon name="delete-outline" size={20} color={colors.onSurfaceVariant} />
                  </View>
                );
              }}
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 32, gap: 16 },
  title: { fontSize: 24, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  button: { padding: 12, borderRadius: 8, alignItems: 'center' },
  list: { marginTop: 24 },
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  serverRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  serverRowMain: { flex: 1 },
  forgetButton: { padding: 10, borderRadius: 8 },
});
