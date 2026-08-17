import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { layout } from '../../../theme/types';
import { DetailActionButtons } from '../DetailActionButtons';

interface Props {
  episode: BaseItemDto;
  onPlay: (episode: BaseItemDto) => void;
  onToggleFavorite: (episode: BaseItemDto) => void;
  onToggleWatched: (episode: BaseItemDto) => void;
}

/** Play/Resume + favorite/watched for whichever episode is focused (`FocusedEpisodeFooter.kt`). */
export function FocusedEpisodeFooter({ episode, onPlay, onToggleFavorite, onToggleWatched }: Props) {
  return (
    <View style={styles.container}>
      <DetailActionButtons
        item={episode}
        onPlay={() => onPlay(episode)}
        onToggleFavorite={() => onToggleFavorite(episode)}
        onToggleWatched={() => onToggleWatched(episode)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.contentPadding,
    paddingBottom: layout.rowTitleGap,
  },
});
