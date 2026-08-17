/**
 * `react-native-vector-icons` (vendored as `@amazon-devices/react-native-vector-icons`) ships
 * no TypeScript declarations of its own; each icon-set entry point default-exports a component
 * with this shape (see `lib/create-icon-set.js`). Each icon set actually used gets its own
 * exact declaration - TS only honors a *new* ambient module declaration for a specifier that
 * otherwise resolves to a real (but untyped) file when this file has no top-level
 * import/export of its own (making it a global "script" .d.ts rather than a module - a module
 * .d.ts can only *augment* already-known modules, not introduce untyped ones as typed).
 */
declare module '@amazon-devices/react-native-vector-icons/MaterialIcons' {
  import type { Component } from 'react';
  import type { ColorValue, TextProps } from 'react-native';

  export interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: ColorValue;
  }

  export default class Icon extends Component<IconProps> {}
}
