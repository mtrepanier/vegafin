import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@amazon-devices/react-navigation__native';
import type { NativeStackNavigationProp } from '@amazon-devices/react-navigation__native-stack';
import { serverRepository } from '../../services/storage/ServerRepository';
import { useTheme } from '../../theme/ThemeContext';
import { generateId } from '../../util/uuid';
import type { SetupStackParamList } from '../../navigation/types';

// ui/setup/ServerList.kt equivalent - lists known servers and lets the user add a new one.
export function ServerListScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<SetupStackParamList, 'ServerList'>>();
  const [url, setUrl] = useState('');
  const servers = serverRepository.listServers();

  const addServer = async () => {
    if (!url.trim()) return;
    const server = {
      id: generateId(),
      name: null,
      url: url.trim(),
      version: null,
      lastUsed: new Date().toISOString(),
    };
    await serverRepository.addAndChangeServer(server);
    navigation.navigate('UserList', { serverId: server.id });
    setUrl('');
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
      <Pressable
        hasTVPreferredFocus
        onPress={addServer}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={{ color: colors.onPrimary }}>Connect</Text>
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
