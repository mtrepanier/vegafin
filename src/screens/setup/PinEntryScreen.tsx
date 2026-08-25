import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { serverRepository } from '../../services/storage/ServerRepository';
import { useTheme } from '../../theme/ThemeContext';
import { useT } from '../../i18n/useTranslation';
import type { SetupStackParamList } from '../../navigation/types';

type Route = RouteProp<SetupStackParamList, 'PinEntry'>;

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

// ui/setup/PinEntry.kt equivalent - PIN gate for a protected local profile.
export function PinEntryScreen() {
  const { colors } = useTheme();
  const t = useT();
  const { params } = useRoute<Route>();
  const entry = serverRepository.listServers().find((s) => s.server.id === params.serverId);
  const user = entry?.users.find((u) => u.id === params.userId);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const press = async (digit: string) => {
    if (digit === '') return;
    if (digit === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    const next = pin + digit;
    setPin(next);
    if (user?.pin && next.length >= user.pin.length) {
      if (next === user.pin && entry) {
        setError(false);
        await serverRepository.changeUser(entry.server, { ...user, pin: null });
      } else {
        setError(true);
        setPin('');
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{t('setup.enterPinFor', { name: user?.name ?? '' })}</Text>
      <Text style={[styles.dots, { color: colors.primary }]}>{'●'.repeat(pin.length)}</Text>
      {error ? <Text style={{ color: colors.error }}>{t('setup.incorrectPin')}</Text> : null}
      <View style={styles.pad}>
        {DIGITS.map((d, i) => (
          <Pressable
            key={i}
            disabled={d === ''}
            onPress={() => press(d)}
            style={[styles.key, { borderColor: colors.border }]}
          >
            <Text style={[styles.keyText, { color: colors.onBackground }]}>{d}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  dots: { fontSize: 28, letterSpacing: 8 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 240, justifyContent: 'center' },
  key: { width: 72, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1, margin: 4, borderRadius: 8 },
  keyText: { fontSize: 20 },
});
