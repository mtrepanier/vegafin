import { useCallback, useEffect, useRef, useState } from 'react';

export interface PageResult<T> {
  items: T[];
  totalCount: number;
}

export type FetchPage<T> = (startIndex: number, limit: number) => Promise<PageResult<T>>;

export interface InfiniteItemList<T> {
  items: T[];
  totalCount: number | null;
  /** True while a page fetch (initial or "load more") is in flight. */
  loading: boolean;
  error: Error | null;
  /** Call from a grid/list's `onEndReached`. No-ops if already loading or fully loaded. */
  loadMore: () => void;
  refresh: () => void;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Simplified equivalent of Kotlin's `RequestPager`/`ApiRequestPager` (util/ApiRequestPager.kt).
 * That pager is a random-access `AbstractList` with an LRU page cache, needed because Compose's
 * `LazyGrid` indexes cells directly. RN's `FlatList` instead consumes a materialized, growing
 * array via `onEndReached`, so this hook just fetches the next page and appends - one hook
 * reused by every list/grid screen, parameterized by a `fetchPage(startIndex, limit)` function
 * (the equivalent of a `RequestHandler<T>` implementation).
 *
 * `fetchPage` identity matters: passing a new function (e.g. a fresh arrow function each
 * render) resets and refetches from page 0. Callers should `useCallback` it with the inputs
 * that should trigger a refetch (sort order, filter, parent id, ...).
 */
export function useInfiniteItemList<T>(fetchPage: FetchPage<T>, pageSize = DEFAULT_PAGE_SIZE): InfiniteItemList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestId = useRef(0);

  const loadPage = useCallback(
    async (startIndex: number, isRefresh: boolean) => {
      const thisRequest = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPage(startIndex, pageSize);
        if (thisRequest !== requestId.current) return; // superseded by a newer request
        setItems((prev) => (isRefresh ? result.items : [...prev, ...result.items]));
        setTotalCount(result.totalCount);
      } catch (e) {
        if (thisRequest === requestId.current) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (thisRequest === requestId.current) setLoading(false);
      }
    },
    [fetchPage, pageSize],
  );

  useEffect(() => {
    setItems([]);
    setTotalCount(null);
    loadPage(0, true);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading) return;
    if (totalCount != null && items.length >= totalCount) return;
    loadPage(items.length, false);
  }, [loading, totalCount, items.length, loadPage]);

  const refresh = useCallback(() => loadPage(0, true), [loadPage]);

  return { items, totalCount, loading, error, loadMore, refresh };
}
