import { useCallback, useRef, useState, type RefObject } from 'react';
import { TextInput } from 'react-native';

export interface DeferredKeyboardFocus {
  ref: RefObject<TextInput | null>;
  /** Spread onto the `TextInput`'s own `showSoftInputOnFocus` prop. */
  showSoftInputOnFocus: boolean;
  /** Spread onto the `TextInput`'s own `onPress`. */
  onPress: () => void;
  /** Spread onto the `TextInput`'s own `onBlur`. */
  onBlur: () => void;
}

/**
 * A `TextInput` can show a visible focus ring (for remote/D-pad navigation) without the
 * on-screen keyboard popping up the moment focus lands on it - the keyboard only appears once
 * the user explicitly presses Select on it. `showSoftInputOnFocus={false}` alone gets the first
 * half (focus, no keyboard); getting the keyboard to open on an explicit press needs a
 * blur-then-refocus cycle, since flipping the prop while already focused doesn't retroactively
 * show the keyboard - the native view only reads it at the moment focus is (re-)gained.
 *
 * Resets on blur, so navigating away and back starts the same way (focus visible, keyboard
 * withheld) rather than the keyboard popping immediately on the second visit.
 */
export function useDeferredKeyboardFocus(): DeferredKeyboardFocus {
  const ref = useRef<TextInput>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);

  const onPress = useCallback(() => {
    if (showKeyboard) return;
    setShowKeyboard(true);
    ref.current?.blur();
    requestAnimationFrame(() => ref.current?.focus());
  }, [showKeyboard]);

  const onBlur = useCallback(() => setShowKeyboard(false), []);

  return { ref, showSoftInputOnFocus: showKeyboard, onPress, onBlur };
}
