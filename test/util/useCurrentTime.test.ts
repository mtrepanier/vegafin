import { renderHook, act } from '@testing-library/react-native';
import { useCurrentTime } from '../../src/util/useCurrentTime';

beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-06-19T13:02:00Z')));
afterEach(() => jest.useRealTimers());

describe('useCurrentTime', () => {
  it('starts at the current time', () => {
    const { result } = renderHook(() => useCurrentTime());
    expect(result.current).toEqual(new Date('2026-06-19T13:02:00Z'));
  });

  it('advances after the interval elapses', () => {
    const { result } = renderHook(() => useCurrentTime(30_000));
    act(() => jest.advanceTimersByTime(30_000));
    expect(result.current).toEqual(new Date('2026-06-19T13:02:30Z'));
  });

  it('does not advance before the interval elapses', () => {
    const { result } = renderHook(() => useCurrentTime(30_000));
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current).toEqual(new Date('2026-06-19T13:02:00Z'));
  });
});
