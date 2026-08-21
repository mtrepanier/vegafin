import { renderHook, act } from '@testing-library/react-native';
import { useLastFocusedIndex } from '../../src/focus/useLastFocusedIndex';

describe('useLastFocusedIndex', () => {
  it('defaults focusedIndex to 0', () => {
    const { result } = renderHook(() => useLastFocusedIndex());
    expect(result.current.focusedIndex).toBe(0);
  });

  it('honors a custom initialIndex', () => {
    const { result } = renderHook(() => useLastFocusedIndex(3));
    expect(result.current.focusedIndex).toBe(3);
  });

  it('onItemFocus updates focusedIndex to the given index', () => {
    const { result } = renderHook(() => useLastFocusedIndex());

    act(() => result.current.onItemFocus(4));
    expect(result.current.focusedIndex).toBe(4);

    act(() => result.current.onItemFocus(0));
    expect(result.current.focusedIndex).toBe(0);
  });

  it('keeps a stable onItemFocus reference across re-renders', () => {
    const { result } = renderHook(() => useLastFocusedIndex());
    const first = result.current.onItemFocus;

    act(() => result.current.onItemFocus(2));

    expect(result.current.onItemFocus).toBe(first);
  });
});
