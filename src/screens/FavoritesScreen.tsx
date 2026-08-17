import React, { useCallback, useState } from 'react';
import { useCurrentUser } from '../services/storage/ServerRepositoryContext';
import { fetchLibraryPage, LIBRARY_SORT_OPTIONS, type LibrarySortField, type SortDirection } from '../services/jellyfin/library';
import { LibraryGrid } from './library/LibraryScreens';

// ui/detail/FavoritesPage.kt equivalent.
export function FavoritesScreen() {
  const currentUser = useCurrentUser();
  const userId = currentUser?.user.id;
  const [sort, setSort] = useState<{ sortBy: LibrarySortField; direction: SortDirection }>({
    sortBy: LIBRARY_SORT_OPTIONS[0].value,
    direction: 'Ascending',
  });

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
      title="Favorites"
      fetchPage={fetchPage}
      sortable
      onSortChange={(sortBy, direction) => setSort({ sortBy, direction })}
    />
  );
}
