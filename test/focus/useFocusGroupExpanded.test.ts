import { renderHook, act } from '@testing-library/react-native';
import { useFocusGroupExpanded } from '../../src/focus/useFocusGroupExpanded';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useFocusGroupExpanded', () => {
  it('starts collapsed', () => {
    const { result } = renderHook(() => useFocusGroupExpanded());
    expect(result.current.expanded).toBe(false);
  });

  it('expands immediately on reveal', () => {
    const { result } = renderHook(() => useFocusGroupExpanded());
    act(() => result.current.reveal());
    expect(result.current.expanded).toBe(true);
  });

  it('stays expanded across a release when nothing else fires (before the tick)', () => {
    const { result } = renderHook(() => useFocusGroupExpanded());
    act(() => result.current.reveal());
    act(() => result.current.release());
    expect(result.current.expanded).toBe(true);
  });

  it('collapses once the release tick elapses with no further reveal', () => {
    const { result } = renderHook(() => useFocusGroupExpanded());
    act(() => result.current.reveal());
    act(() => result.current.release());
    act(() => jest.runAllTimers());
    expect(result.current.expanded).toBe(false);
  });

  it('stays expanded when focus moves to a sibling (release followed by a reveal before the tick)', () => {
    const { result } = renderHook(() => useFocusGroupExpanded());
    act(() => result.current.reveal());
    act(() => {
      result.current.release();
      result.current.reveal();
    });
    act(() => jest.runAllTimers());
    expect(result.current.expanded).toBe(true);
  });

  it('only collapses once every outstanding reveal has been released', () => {
    const { result } = renderHook(() => useFocusGroupExpanded());
    act(() => {
      result.current.reveal();
      result.current.reveal();
    });
    act(() => result.current.release());
    act(() => jest.runAllTimers());
    expect(result.current.expanded).toBe(true);

    act(() => result.current.release());
    act(() => jest.runAllTimers());
    expect(result.current.expanded).toBe(false);
  });
});
