import React, { createContext, useContext, useMemo, useState } from 'react';
import { palettes } from './palettes';
import type { AppThemeColorName, ColorScheme } from './types';

interface ThemeContextValue {
  colors: ColorScheme;
  themeName: AppThemeColorName;
  dark: boolean;
  setThemeName: (name: AppThemeColorName) => void;
  setDark: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Equivalent to WholphinTheme() in ui/theme/Theme.kt. Wraps the app once, near the root.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<AppThemeColorName>('purple');
  const [dark, setDark] = useState(true);

  const value = useMemo<ThemeContextValue>(() => {
    const palette = palettes[themeName];
    return {
      colors: dark ? palette.dark : palette.light,
      themeName,
      dark,
      setThemeName,
      setDark,
    };
  }, [themeName, dark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used within a <ThemeProvider>');
  }
  return ctx;
}
