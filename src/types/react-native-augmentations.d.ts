/**
 * Fills a type gap between the plain `react-native` package (what TypeScript's module
 * resolution actually sees) and `@amazon-devices/react-native-kepler` (what Metro/the Vega
 * build CLI silently substitutes at bundle time - see README's "How Vega package resolution
 * actually works"). TypeScript has no visibility into that build-time aliasing, so a Kepler
 * patch to a *stock* RN component's types needs augmenting here to keep every file importing
 * core primitives from plain 'react-native' as the rest of the codebase already does.
 */
import 'react-native';

declare module 'react-native' {
  // Kepler's Pressable (Libraries/Components/Pressable/Pressable.js) adds a `focused` field
  // to the render-prop state alongside the stock `pressed` one.
  interface PressableStateCallbackType {
    focused: boolean;
  }
}
