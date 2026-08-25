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

/** Play/Resume + favorite/watched for whichever episode is focused (`FocusedEpisodeFooter.kt`).
 *
 * `autoFocus={false}` here: the episode row above, not Play, owns this page's initial focus.
 * D-pad-down from that row still lands on Play specifically (not Watched, the rightmost button)
 * thanks to `DetailActionButtons`' own `destinations`-based `FocusGroup` - see its doc comment
 * for why that's a passive redirect rather than a proactive `hasTVPreferredFocus` claim, and why
 * a proactive claim (even delayed past mount) isn't safe to use for this instead. */
export function FocusedEpisodeFooter({ episode, onPlay, onToggleFavorite, onToggleWatched }: Props) {
  return (
    <View style={styles.container}>
      <DetailActionButtons
        item={episode}
        onPlay={() => onPlay(episode)}
        onToggleFavorite={() => onToggleFavorite(episode)}
        onToggleWatched={() => onToggleWatched(episode)}
        autoFocus={false}
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
