import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../../src/theme/ThemeContext';
import { palettes } from '../../src/theme/palettes';

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('useTheme', () => {
  it('throws when used outside a ThemeProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useTheme();
      } catch (e) {
        return e as Error;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toBe('useTheme() must be used within a <ThemeProvider>');
  });

  it('defaults to the dark variant of the purple palette', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.themeName).toBe('purple');
    expect(result.current.dark).toBe(true);
    expect(result.current.colors).toEqual(palettes.purple.dark);
  });

  it('switches to the light variant of the current palette when setDark(false)', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setDark(false));

    expect(result.current.dark).toBe(false);
    expect(result.current.colors).toEqual(palettes.purple.light);
  });

  it('resolves colors from the newly selected palette when setThemeName changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setThemeName('blue'));

    expect(result.current.themeName).toBe('blue');
    expect(result.current.colors).toEqual(palettes.blue.dark);
  });

  it('re-resolves colors from the new palette after both dark and theme changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => result.current.setThemeName('oledBlack'));
    act(() => result.current.setDark(false));

    expect(result.current.colors).toEqual(palettes.oledBlack.light);
  });
});
