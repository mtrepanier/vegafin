import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@amazon-devices/react-navigation__native';
import type { NativeStackNavigationProp } from '@amazon-devices/react-navigation__native-stack';
import { getSystemApi } from '@jellyfin/sdk/lib/utils/api/system-api';
import { jellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { getServerUrlCandidates } from '../../services/jellyfin/serverUrl';
import { serverRepository } from '../../services/storage/ServerRepository';
import { useTheme } from '../../theme/ThemeContext';
import { generateId } from '../../util/uuid';
import type { SetupStackParamList } from '../../navigation/types';

// ui/setup/ServerList.kt equivalent - lists known servers and lets the user add a new one.
export function ServerListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<SetupStackParamList, 'ServerList'>>();
  const [url, setUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const servers = serverRepository.listServers();

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
        throw new Error('Enter a server address.');
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
        throw firstError instanceof Error ? firstError : new Error('Unable to reach the server.');
      }

      const server = {
        id: generateId(),
        name: serverName,
        url: resolvedUrl,
        version: serverVersion,
        lastUsed: new Date().toISOString(),
      };
      await serverRepository.addAndChangeServer(server);
      navigation.navigate('UserList', { serverId: server.id });
      setUrl('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to reach the server.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>Add a Jellyfin server</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="https://jellyfin.example.com"
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
      />
      {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
      <Pressable
        hasTVPreferredFocus
        onPress={addServer}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        {connecting ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={{ color: colors.onPrimary }}>Connect</Text>}
      </Pressable>

      <FlatList
        style={styles.list}
        data={servers}
        keyExtractor={(item) => item.server.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('UserList', { serverId: item.server.id })}
            style={[styles.row, { borderColor: colors.surfaceVariant }]}
          >
            <Text style={{ color: colors.onBackground }}>{item.server.name ?? item.server.url}</Text>
          </Pressable>
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
});
