import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useT } from '../i18n/useTranslation';
import type { TranslationKey } from '../i18n/translations';

type Phase = 'Phase 1' | 'Phase 2' | 'Phase 3';

interface Props {
  /** A translation key (`stub.*`), not a raw string - every not-yet-built screen's display
   * name is a fixed, enumerable set, so callers pass the key directly rather than this
   * component needing its own name-to-key lookup. */
  name: TranslationKey;
  phase: Phase;
  detail?: string;
}

const PHASE_KEYS: Record<Phase, TranslationKey> = {
  'Phase 1': 'stub.phase1',
  'Phase 2': 'stub.phase2',
  'Phase 3': 'stub.phase3',
};

/**
 * Placeholder rendered by every not-yet-built screen so the full navigation graph from
 * Destination.kt can be exercised end-to-end before real screens land. Remove call sites
 * as each screen gets built for real.
 */
export function StubScreen({ name, phase, detail }: Props) {
  const { colors } = useTheme();
  const t = useT();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{t(name)}</Text>
      <Text style={[styles.phase, { color: colors.primary }]}>{t(PHASE_KEYS[phase])}</Text>
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
