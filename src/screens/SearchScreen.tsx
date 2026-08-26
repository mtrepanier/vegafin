import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@amazon-devices/react-navigation__native';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { fetchSearchResults, type SearchResults } from '../services/jellyfin/search';
import { PosterRow } from '../components/PosterRow';
import { useT } from '../i18n/useTranslation';
import type { AppNavigationProp, DrawerParamList } from '../navigation/types';

/** Matches Wholphin's `SearchPage.kt` debounce - long enough that a few keystrokes in a row
 * only fire one request, short enough that results still feel responsive. */
const SEARCH_DEBOUNCE_MS = 750;

// ui/detail/search/SearchForDialog.kt / ui/main/SearchPage.kt equivalent.
export function SearchScreen() {
  const { colors } = useTheme();
  const t = useT();
  const navigation = useNavigation<AppNavigationProp<'Search'>>();
  const route = useRoute<RouteProp<DrawerParamList, 'Search'>>();
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;

  const [query, setQuery] = useState(route.params?.query ?? '');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!userId || trimmed.length === 0) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchSearchResults(userId, trimmed).then((data) => {
        if (!cancelled) {
          setResults(data);
          setLoading(false);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, query]);

  const hasAnyResults =
    !!results && results.movies.length + results.series.length + results.episodes.length + results.collections.length + results.people.length > 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.onBackground }]}>{t('nav.search')}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('search.placeholder')}
        placeholderTextColor={colors.onSurfaceVariant}
        autoCapitalize="none"
        autoCorrect={false}
        hasTVPreferredFocus
        style={[styles.input, { borderColor: colors.border, color: colors.onSurface }]}
      />

      {loading ? (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.onSurfaceVariant }}>{t('search.searching')}</Text>
        </View>
      ) : null}

      {!loading && results && !hasAnyResults ? (
        <Text style={[styles.status, { color: colors.onSurfaceVariant }]}>{t('search.noResults', { query: query.trim() })}</Text>
      ) : null}

      {!loading ? (
        <>
          <PosterRow title={t('search.section.movies')} items={results?.movies ?? []} navigation={navigation} autoFocus={false} />
          <PosterRow title={t('search.section.series')} items={results?.series ?? []} navigation={navigation} autoFocus={false} />
          <PosterRow title={t('search.section.episodes')} items={results?.episodes ?? []} navigation={navigation} autoFocus={false} />
          <PosterRow title={t('search.section.collections')} items={results?.collections ?? []} navigation={navigation} autoFocus={false} />
          <PosterRow title={t('search.section.people')} items={results?.people ?? []} navigation={navigation} autoFocus={false} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.contentPadding,
    paddingTop: 64,
    paddingBottom: layout.contentPadding,
    gap: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  input: {
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
