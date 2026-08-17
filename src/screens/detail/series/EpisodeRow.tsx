import React from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { layout } from '../../../theme/types';
import { primaryImageUrl } from '../../../services/jellyfin/images';
import { ItemRow } from '../../../components/ItemRow';
import { PosterCard } from '../../../components/cards/PosterCard';

interface Props {
  episodes: BaseItemDto[];
  onFocusEpisode: (episode: BaseItemDto) => void;
  onPressEpisode: (episode: BaseItemDto) => void;
  initialFocusEpisodeId?: string;
}

function episodeLabel(episode: BaseItemDto): string {
  return episode.IndexNumber != null ? `${episode.IndexNumber}. ${episode.Name ?? ''}` : (episode.Name ?? '');
}

/** Horizontal episode row for the selected season - the focused card drives
 * `FocusedEpisodeHeader`/`FocusedEpisodeFooter` above it. */
export function EpisodeRow({ episodes, onFocusEpisode, onPressEpisode, initialFocusEpisodeId }: Props) {
  const initialIndex = Math.max(
    0,
    initialFocusEpisodeId ? episodes.findIndex((episode) => episode.Id === initialFocusEpisodeId) : 0,
  );

  return (
    <ItemRow
      items={episodes}
      initialFocusedIndex={initialIndex}
      keyExtractor={(episode, index) => episode.Id ?? String(index)}
      renderItem={(episode, _index, hasTVPreferredFocus, onFocus) => (
        <PosterCard
          uri={primaryImageUrl(episode, layout.landscape.width)}
          metrics={layout.landscape}
          title={episodeLabel(episode)}
          watched={episode.UserData?.Played ?? false}
          favorite={episode.UserData?.IsFavorite ?? false}
          progressPercent={episode.UserData?.PlayedPercentage ?? undefined}
          hasTVPreferredFocus={hasTVPreferredFocus}
          onFocus={() => {
            onFocus();
            onFocusEpisode(episode);
          }}
          onPress={() => onPressEpisode(episode)}
        />
      )}
    />
  );
}
