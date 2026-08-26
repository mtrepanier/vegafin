import React, { useCallback, useState } from 'react';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { serverRepository } from '../services/storage/ServerRepository';
import { fetchLibraryPage, resolveLibrarySort } from '../services/jellyfin/library';
import { useT } from '../i18n/useTranslation';
import { LibraryGrid } from './library/LibraryScreens';

// Fixed - there's only one Favorites view per user, unlike the library/filtered-collection
// screens which need a per-instance key.
const SORT_KEY = 'favorites';

// ui/detail/FavoritesPage.kt equivalent.
export function FavoritesScreen() {
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const t = useT();
  const [sort, setSort] = useState(() => resolveLibrarySort(currentUser?.user.librarySort?.[SORT_KEY]));

  const fetchPage = useCallback(
    (startIndex: number, limit: number) =>
      fetchLibraryPage(userId ?? '', {
        isFavorite: true,
        recursive: true,
        sortBy: sort.sortBy,
        sortDirection: sort.direction,
      })(startIndex, limit),
    [userId, sort],
  );

  if (!userId) {
    return null;
  }
  return (
    <LibraryGrid
      title={t('nav.favorites')}
      fetchPage={fetchPage}
      sort={sort}
      onSortChange={(sortBy, direction) => {
        setSort({ sortBy, direction });
        serverRepository.setLibrarySort(SORT_KEY, sortBy, direction);
      }}
    />
  );
}
