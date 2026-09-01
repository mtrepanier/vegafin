import React from 'react';
import { Pressable, StyleSheet, type PressableStateCallbackType } from 'react-native';
import Icon from './Icon';
import { useTheme } from '../theme/ThemeContext';
import { layout } from '../theme/types';

interface Props {
  icon: string;
  active?: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
}

/** Small circular icon-only button used for favorite/watched toggles on detail pages. */
export function IconButton({ icon, active, onPress, hasTVPreferredFocus }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const iconStyle = [styles.button, { borderColor: focused ? colors.border : 'transparent', backgroundColor: colors.surfaceVariant }];
        return <Icon name={icon} size={22} color={active ? colors.primary : colors.onSurfaceVariant} style={iconStyle} />;
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: layout.focusBorderWidth,
    overflow: 'hidden',
    // `Icon` (Icon.tsx) wraps its glyph in a plain `View`, not the text node
    // `react-native-vector-icons` used to render - centers via flexbox instead of the old
    // textAlign/textAlignVertical, which only ever affected a Text node.
    alignItems: 'center',
    justifyContent: 'center',
  },
});
