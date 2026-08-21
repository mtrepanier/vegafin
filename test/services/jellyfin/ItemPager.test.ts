import { renderHook, act } from '@testing-library/react-native';
import { useInfiniteItemList } from '../../../src/services/jellyfin/ItemPager';
import type { FetchPage, InfiniteItemList, PageResult } from '../../../src/services/jellyfin/ItemPager';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function page(items: string[], totalCount: number): PageResult<string> {
  return { items, totalCount };
}

describe('useInfiniteItemList', () => {
  it('fetches page 0 on mount and exposes the result', async () => {
    const fetchPage: FetchPage<string> = jest.fn().mockResolvedValue(page(['a', 'b'], 5));
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));

    expect(result.current.loading).toBe(true);
    await act(async () => {});

    expect(fetchPage).toHaveBeenCalledWith(0, 2);
    expect(result.current.items).toEqual(['a', 'b']);
    expect(result.current.totalCount).toBe(5);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loadMore appends the next page starting at the current item count', async () => {
    const fetchPage: FetchPage<string> = jest
      .fn()
      .mockResolvedValueOnce(page(['a', 'b'], 5))
      .mockResolvedValueOnce(page(['c', 'd'], 5));
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));
    await act(async () => {});

    await act(async () => {
      result.current.loadMore();
    });

    expect(fetchPage).toHaveBeenLastCalledWith(2, 2);
    expect(result.current.items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('loadMore is a no-op once totalCount has been reached', async () => {
    const fetchPage: FetchPage<string> = jest.fn().mockResolvedValue(page(['a', 'b'], 2));
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));
    await act(async () => {});

    await act(async () => {
      result.current.loadMore();
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual(['a', 'b']);
  });

  it('loadMore is a no-op while a fetch is already in flight', async () => {
    const first = deferred<PageResult<string>>();
    const fetchPage: FetchPage<string> = jest.fn().mockReturnValue(first.promise);
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    await act(async () => {
      first.resolve(page(['a', 'b'], 10));
      await first.promise;
    });

    // Only the initial mount fetch ran; both loadMore() calls no-opped while loading.
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('refresh replaces items from page 0 instead of appending', async () => {
    const fetchPage: FetchPage<string> = jest
      .fn()
      .mockResolvedValueOnce(page(['a', 'b'], 4))
      .mockResolvedValueOnce(page(['x', 'y'], 4));
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));
    await act(async () => {});

    await act(async () => {
      result.current.refresh();
    });

    expect(fetchPage).toHaveBeenLastCalledWith(0, 2);
    expect(result.current.items).toEqual(['x', 'y']);
  });

  it('surfaces a rejected fetch as an Error and stops loading', async () => {
    const fetchPage: FetchPage<string> = jest.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));
    await act(async () => {});

    expect(result.current.loading).toBe(false);
    expect(result.current.error?.message).toBe('network down');
    expect(result.current.items).toEqual([]);
  });

  it('wraps a non-Error rejection reason in an Error', async () => {
    const fetchPage: FetchPage<string> = jest.fn().mockRejectedValue('boom');
    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));
    await act(async () => {});

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('boom');
  });

  it('discards a stale in-flight response superseded by a refresh', async () => {
    const staleFetch = deferred<PageResult<string>>();
    const fetchPage: FetchPage<string> = jest
      .fn()
      .mockReturnValueOnce(staleFetch.promise)
      .mockResolvedValueOnce(page(['fresh'], 1));

    const { result } = renderHook(() => useInfiniteItemList(fetchPage, 2));

    // Initial mount request is in flight; supersede it with a refresh before it resolves.
    await act(async () => {
      result.current.refresh();
    });

    // Now let the stale first request resolve - it should be discarded, not overwrite state.
    await act(async () => {
      staleFetch.resolve(page(['stale'], 1));
      await staleFetch.promise;
    });

    expect(result.current.items).toEqual(['fresh']);
  });

  it('resets and refetches from scratch when the fetchPage identity changes', async () => {
    const fetchPageA: FetchPage<string> = jest.fn().mockResolvedValue(page(['a'], 1));
    const fetchPageB: FetchPage<string> = jest.fn().mockResolvedValue(page(['b'], 1));

    const { result, rerender } = renderHook<InfiniteItemList<string>, { fetchPage: FetchPage<string> }>(
      ({ fetchPage }) => useInfiniteItemList(fetchPage, 2),
      { initialProps: { fetchPage: fetchPageA } },
    );
    await act(async () => {});
    expect(result.current.items).toEqual(['a']);

    await act(async () => {
      rerender({ fetchPage: fetchPageB });
    });

    expect(fetchPageB).toHaveBeenCalledWith(0, 2);
    expect(result.current.items).toEqual(['b']);
  });
});
