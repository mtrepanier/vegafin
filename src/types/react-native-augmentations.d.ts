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

  // Kepler's ScrollView adds TV-focus-scroll controls (ScrollViewPropsKepler in
  // @amazon-devices/react-native-kepler's ScrollView.d.ts) absent from stock RN's types.
  // `focusItemAlignment` controls where a newly-focused descendant lands after the native TV
  // focus engine auto-scrolls it into view - stock RN's undocumented platform default behaves
  // like 'center', which opens screens/rows scrolled past their start; 'start' pins it flush.
  // FlatList forwards unrecognized props straight through to its internal ScrollView, so this
  // applies there too even though VirtualizedListProps doesn't otherwise know about it.
  interface ScrollViewProps {
    focusItemAlignment?: 'start' | 'center' | 'end';
  }
  // ItemT must stay to match FlatListProps's own generic arity for declaration merging to apply.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  interface FlatListProps<ItemT> {
    focusItemAlignment?: 'start' | 'center' | 'end';
  }

  // Kepler adds device-locale/timezone retrieval and an app-locale override on top of stock
  // RN's RTL-only I18nManager (Libraries/ReactNative/I18nManager.d.ts's amznmod_react section) -
  // see src/i18n/useSystemLocale.ts, the only place this app reads getSystemLocale/addEventListener.
  interface I18nManagerStatic {
    getAppLocale: () => string;
    setAppLocale: (locale: string) => void;
    getSystemLocale: () => string;
    getTimezone: () => string;
    setTimezone: (timezone: string) => void;
    getSystemTimezone: () => string;
    resetLocale: () => void;
    resetTimezone: () => void;
    addListener: (eventName: string, callback: (...args: unknown[]) => void) => void;
    addEventListener: (eventName: string, callback: (...args: unknown[]) => void) => { remove: () => void };
    removeListeners: () => void;
    SettingEventName: { Locale: string; Timezone: string };
  }
}
