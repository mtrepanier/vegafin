/**
 * Mirrors the Material-3-derived token set used by Wholphin's Compose ThemeColors
 * interface (ui/theme/ThemeColors.kt), so each color palette can be ported 1:1.
 */
export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  scrim: string;
  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;
  /** Focus/selection border color, used heavily for TV D-pad focus rings. */
  border: string;
}

export interface ThemePalette {
  light: ColorScheme;
  dark: ColorScheme;
}

export type AppThemeColorName =
  | 'purple'
  | 'blue'
  | 'boldBlue'
  | 'green'
  | 'orange'
  | 'oledBlack'
  | 'red'
  | 'brown';

export interface CardMetrics {
  width: number;
  height: number;
}

/**
 * Sizing/spacing constants for the card/row/grid system (ui/cards/, ui/detail/CardGrid.kt).
 * Not palette-dependent like ColorScheme, so this is a single flat constant rather than a
 * light/dark pair.
 */
export interface LayoutTokens {
  /** Portrait poster card (movies, series, episodes-as-thumbnails), ~2:3. */
  poster: CardMetrics;
  /** Landscape banner/backdrop card (BannerCard), ~16:9. */
  landscape: CardMetrics;
  /** Square card (people, genres, studios). */
  square: CardMetrics;
  /** Gap between cards within a row or grid. */
  cardSpacing: number;
  /** Horizontal inset for rows/grids from the screen edge. */
  contentPadding: number;
  /** Gap between a row's title and its card list. */
  rowTitleGap: number;
  /** Vertical gap between stacked rows on the Home screen. */
  rowSpacing: number;
  /** Border width of the focus ring drawn around a focused card. */
  focusBorderWidth: number;
  /** Scale transform applied to a card while focused. */
  focusScale: number;
}

export const layout: LayoutTokens = {
  poster: { width: 150, height: 225 },
  landscape: { width: 280, height: 158 },
  square: { width: 150, height: 150 },
  cardSpacing: 16,
  contentPadding: 48,
  rowTitleGap: 12,
  rowSpacing: 32,
  focusBorderWidth: 3,
  focusScale: 1.08,
};
