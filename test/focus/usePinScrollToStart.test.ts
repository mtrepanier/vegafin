import { renderHook } from '@testing-library/react-native';
import { usePinScrollToStart } from '../../src/focus/usePinScrollToStart';

const PIN_DURATION_MS = 1000;
const PIN_INTERVAL_MS = 100;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('usePinScrollToStart', () => {
  it('calls scrollToStart repeatedly on the interval', () => {
    const scrollToStart = jest.fn();
    renderHook(() => usePinScrollToStart(scrollToStart));

    jest.advanceTimersByTime(PIN_INTERVAL_MS * 3);

    expect(scrollToStart).toHaveBeenCalledTimes(3);
  });

  it('stops calling scrollToStart once the pin window elapses', () => {
    const scrollToStart = jest.fn();
    renderHook(() => usePinScrollToStart(scrollToStart));

    jest.advanceTimersByTime(PIN_DURATION_MS);
    const callsAtWindowEnd = scrollToStart.mock.calls.length;

    jest.advanceTimersByTime(PIN_INTERVAL_MS * 5);

    expect(scrollToStart).toHaveBeenCalledTimes(callsAtWindowEnd);
  });

  it('stops calling scrollToStart once unmounted, even mid-window', () => {
    const scrollToStart = jest.fn();
    const { unmount } = renderHook(() => usePinScrollToStart(scrollToStart));

    jest.advanceTimersByTime(PIN_INTERVAL_MS);
    const callsBeforeUnmount = scrollToStart.mock.calls.length;
    unmount();

    jest.advanceTimersByTime(PIN_DURATION_MS);

    expect(scrollToStart).toHaveBeenCalledTimes(callsBeforeUnmount);
  });
});
