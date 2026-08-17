import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  name: string;
  phase: 'Phase 1' | 'Phase 2' | 'Phase 3';
  detail?: string;
}

/**
 * Placeholder rendered by every not-yet-built screen so the full navigation graph from
 * Destination.kt can be exercised end-to-end before real screens land. Remove call sites
 * as each screen gets built for real.
 */
export function StubScreen({ name, phase, detail }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{name}</Text>
      <Text style={[styles.phase, { color: colors.primary }]}>{phase}</Text>
      {detail ? <Text style={[styles.detail, { color: colors.onSurfaceVariant }]}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
  },
  phase: {
    fontSize: 16,
  },
  detail: {
    fontSize: 14,
  },
});
