import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import Icon from '@amazon-devices/react-native-vector-icons/MaterialIcons';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { useTheme } from '../../theme/ThemeContext';
import { layout } from '../../theme/types';
import { primaryImageUrl } from '../../services/jellyfin/images';
import { libraryIconName } from '../../services/jellyfin/libraryIcons';

const TILE_WIDTH = 160;
const TILE_HEIGHT = 90;

interface Props {
  library: BaseItemDto;
  hasTVPreferredFocus?: boolean;
  onFocus?: () => void;
  onPress: () => void;
}

/** Top-of-home library shortcut - the library's own Primary image (getUserViews returns each
 * library's ImageTags just like any other item) when it has one, falling back to a
 * CollectionType-keyed icon otherwise, with the name below the tile rather than overlaid on
 * the artwork. Mirrors AmbientFlare/astra-tv's LibraryNav (a separate Jellyfin-for-Vega client
 * tested on real Fire TV hardware), simplified to one image per library rather than its
 * artwork-collage tiles. */
export function LibraryTile({ library, hasTVPreferredFocus, onFocus, onPress }: Props) {
  const { colors } = useTheme();
  const iconName = libraryIconName(library);
  const imageUri = primaryImageUrl(library, TILE_WIDTH);
  const hasImage = Boolean(library.ImageTags?.Primary);

  return (
    <Pressable hasTVPreferredFocus={hasTVPreferredFocus} onFocus={onFocus} onPress={onPress}>
      {({ focused }: PressableStateCallbackType) => {
        const tileStyle = [
          styles.tile,
          { backgroundColor: colors.surfaceVariant, borderColor: focused ? colors.border : 'transparent' },
        ];
        const labelStyle = [styles.label, { color: colors.onBackground }];
        return (
          <View>
            <View style={tileStyle}>
              {hasImage && imageUri ? (
                <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Icon name={iconName} size={28} color={colors.onSurfaceVariant} />
              )}
            </View>
            <Text numberOfLines={1} style={labelStyle}>
              {library.Name}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 8,
    borderWidth: layout.focusBorderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
});
