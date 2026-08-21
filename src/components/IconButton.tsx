import React from 'react';
import { Pressable, StyleSheet, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
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
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 22,
    borderWidth: layout.focusBorderWidth,
    overflow: 'hidden',
  },
});
