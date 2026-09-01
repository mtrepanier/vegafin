import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from '@amazon-devices/react-native-svg';

/**
 * Material Icons (Filled, 24dp) path data, keyed by the same name strings this app already used
 * with `@amazon-devices/react-native-vector-icons/MaterialIcons`. Drawn as plain SVG instead of
 * a font glyph - `@amazon-devices/react-native-svg` is a system-deployed Kepler library (no
 * manual linking, see `ScreenBackdrop.tsx`'s own comment), unlike `react-native-vector-icons`'s
 * `vector_icons_2` native module, which turned out not to be present on every real device: the
 * Amazon Developer Console rejected Fire TV Stick HD (2nd gen) - and, implicitly, other
 * lower-end/older devices - specifically over that one capability. Swapping every icon usage in
 * the app to this component removes the dependency (and the `needs.module` entry it autolinked
 * into `manifest.toml`) entirely, at the cost of only supporting the fixed icon set drawn below
 * instead of the full MaterialIcons font - add a new `d` entry here (from Google's Material
 * Symbols/Icons, Apache-2.0) rather than reaching for the font package again.
 */
const ICON_PATHS: Record<string, string> = {
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  'arrow-back': 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  'arrow-downward': 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
  'arrow-upward': 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  'check-circle': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  'check-circle-outline':
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z',
  'chevron-left': 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
  'chevron-right': 'M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z',
  'closed-caption':
    'M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8.15 10c-.28.28-.72.28-1 0l-.7-.7c-.28-.28-.28-.72 0-1l.7-.7c.28-.28.72-.28 1 0 .2.19.51.19.71 0l.5-.5c.28-.28.28-.72 0-1l-1-1c-.28-.28-.72-.28-1 0l-2 2c-.28.28-.28.72 0 1l2 2c.28.28.72.28 1 0l1-1c.28-.28.28-.72 0-1l-.5-.5c-.2-.19-.51-.19-.71 0zm7.5 0c-.28.28-.72.28-1 0l-.7-.7c-.28-.28-.28-.72 0-1l.7-.7c.28-.28.72-.28 1 0 .2.19.51.19.71 0l.5-.5c.28-.28.28-.72 0-1l-1-1c-.28-.28-.72-.28-1 0l-2 2c-.28.28-.28.72 0 1l2 2c.28.28.72.28 1 0l1-1c.28-.28.28-.72 0-1l-.5-.5c-.2-.19-.51-.19-.71 0z',
  'delete-outline': 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  favorite: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  'favorite-border':
    'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  'keyboard-arrow-down': 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z',
  'keyboard-arrow-up': 'M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z',
  'library-music': 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zM6 3H2v4h4V3zm0 6H2v4h4V9zm0 6H2v4h4v-4z',
  'live-tv': 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12zM8.5 16v-10l8 5-8 5z',
  logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
  'menu-book':
    'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
  movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  'music-video':
    'M20 4H8C6.9 4 6 4.9 6 6v6.18C5.69 12.07 5.35 12 5 12c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h12v11H8v2h12c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9.5 8L8 10.5v-4L10.5 8v4z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  'photo-camera-back':
    'M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z',
  'photo-library': 'M22 16V4c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2zM11 12l2.03 2.71L16 11l4 5H8l3-4zM2 6v14c0 1.1.9 2 2 2h14v-2H4V6H2z',
  'play-arrow': 'M8 5v14l11-7z',
  'queue-music': 'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  settings:
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  shuffle:
    'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.42 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  'swap-horiz': 'M6.99 11L3 15l3.99 4v-3H14v-2H6.99v-3zM21 9l-3.99-4v3H10v2h7.01v3L21 9z',
  theaters:
    'M18 4V3c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v1H2v6h1v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V10h1V4h-4zM7 3h10v1H7V3zm2 15H5v-2h4v2zm0-4H5v-2h4v2zm0-4H5V8h4v2zm5 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2zm5 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V8h4v2z',
  'video-library': 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 9-5 3V8l5 3z',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Drop-in replacement for `@amazon-devices/react-native-vector-icons/MaterialIcons`'s default
 * export - same `name`/`size`/`color` props, so every call site only had to change its import.
 * `style` is applied to the wrapping `View` (not the `Svg` itself) since the one caller that
 * passes one (`IconButton.tsx`) uses it for a sized/bordered/colored circular button background
 * around the icon, not to restyle the glyph. */
export function Icon({ name, size = 24, color = '#000', style }: IconProps) {
  const path = ICON_PATHS[name];
  return (
    <View style={[styles.center, style]}>
      {path ? (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d={path} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});

export default Icon;
