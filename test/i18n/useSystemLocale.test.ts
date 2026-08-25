import { renderHook } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import { useSystemLocale } from '../../src/i18n/useSystemLocale';

// Spying on the real (Kepler, jest-mocked-preset) I18nManager object rather than jest.mock('react-native', ...)
// with a replacement module - spreading the actual module inside a mock factory trips over Kepler's
// index.js lazy-getter setup (an internal ordering quirk, not something worth fighting for a test double).
let getSystemLocaleSpy: jest.SpyInstance;
let getConstantsSpy: jest.SpyInstance;
let addEventListenerSpy: jest.SpyInstance;

beforeEach(() => {
  getSystemLocaleSpy = jest.spyOn(I18nManager, 'getSystemLocale').mockReturnValue(undefined as unknown as string);
  getConstantsSpy = jest
    .spyOn(I18nManager, 'getConstants')
    .mockReturnValue({ isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: undefined });
  addEventListenerSpy = jest.spyOn(I18nManager, 'addEventListener').mockReturnValue({ remove: jest.fn() });
});

afterEach(() => {
  getSystemLocaleSpy.mockRestore();
  getConstantsSpy.mockRestore();
  addEventListenerSpy.mockRestore();
});

describe('useSystemLocale', () => {
  it('returns getSystemLocale() when available', () => {
    getSystemLocaleSpy.mockReturnValue('fr-FR');
    const { result } = renderHook(() => useSystemLocale());
    expect(result.current).toBe('fr-FR');
  });

  it('falls back to getConstants().localeIdentifier when getSystemLocale() is empty', () => {
    getConstantsSpy.mockReturnValue({ isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en-US' });
    const { result } = renderHook(() => useSystemLocale());
    expect(result.current).toBe('en-US');
  });

  it('falls back to null when neither source has a value', () => {
    const { result } = renderHook(() => useSystemLocale());
    expect(result.current).toBeNull();
  });

  it('falls back to null instead of throwing when getSystemLocale() itself throws', () => {
    getSystemLocaleSpy.mockImplementation(() => {
      throw new Error('not implemented on this platform');
    });
    const { result } = renderHook(() => useSystemLocale());
    expect(result.current).toBeNull();
  });

  it('subscribes to the native Locale change event and unsubscribes on unmount', () => {
    const remove = jest.fn();
    addEventListenerSpy.mockReturnValue({ remove });

    const { unmount } = renderHook(() => useSystemLocale());
    expect(addEventListenerSpy).toHaveBeenCalledWith('Locale', expect.any(Function));

    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
