import { renderHook, act } from '@testing-library/react-native';
import { useDeferredKeyboardFocus } from '../../src/focus/useDeferredKeyboardFocus';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useDeferredKeyboardFocus', () => {
  it('starts with showSoftInputOnFocus false, so gaining focus alone never opens the keyboard', () => {
    const { result } = renderHook(() => useDeferredKeyboardFocus());
    expect(result.current.showSoftInputOnFocus).toBe(false);
  });

  it('onPress flips showSoftInputOnFocus to true and blurs-then-refocuses the input', () => {
    const { result } = renderHook(() => useDeferredKeyboardFocus());
    const blur = jest.fn();
    const focus = jest.fn();
    (result.current.ref as { current: unknown }).current = { blur, focus };

    act(() => result.current.onPress());
    expect(result.current.showSoftInputOnFocus).toBe(true);
    expect(blur).toHaveBeenCalledTimes(1);
    expect(focus).not.toHaveBeenCalled();

    act(() => jest.runOnlyPendingTimers());
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('a second onPress while already showing the keyboard is a no-op', () => {
    const { result } = renderHook(() => useDeferredKeyboardFocus());
    const blur = jest.fn();
    const focus = jest.fn();
    (result.current.ref as { current: unknown }).current = { blur, focus };

    act(() => result.current.onPress());
    act(() => jest.runOnlyPendingTimers());
    blur.mockClear();
    focus.mockClear();

    act(() => result.current.onPress());
    expect(blur).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it('onBlur resets showSoftInputOnFocus back to false', () => {
    const { result } = renderHook(() => useDeferredKeyboardFocus());
    (result.current.ref as { current: unknown }).current = { blur: jest.fn(), focus: jest.fn() };

    act(() => result.current.onPress());
    expect(result.current.showSoftInputOnFocus).toBe(true);

    act(() => result.current.onBlur());
    expect(result.current.showSoftInputOnFocus).toBe(false);
  });
});
