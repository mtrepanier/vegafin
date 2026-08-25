import React from 'react';
import { Text, type TextStyle } from 'react-native';
import type { HeroInfoSegment } from '../util/format';

interface Props {
  segments: HeroInfoSegment[];
  color: string;
  fontSize: number;
  fontWeight?: TextStyle['fontWeight'];
  numberOfLines?: number;
}

const STAR_COLOR = '#FFC107';

/**
 * Renders a `formatHeroInfoLine` result - shared by `HomeHero.tsx` and `MovieDetail.tsx` (any
 * screen showing the "year/S1E5 · runtime/date · ratings · remaining time" line). Takes the
 * segment array rather than a plain string specifically so the community rating's star can get
 * its own color/size (gold, a couple points larger than the surrounding text - a plain "★"
 * glyph renders visibly smaller than the 🍅 emoji next to it at the same nominal `fontSize`),
 * which a flat joined string couldn't do.
 */
export function HeroInfoLine({ segments, color, fontSize, fontWeight = '700', numberOfLines = 2 }: Props) {
  if (segments.length === 0) {
    return null;
  }
  return (
    <Text numberOfLines={numberOfLines} style={{ color, fontSize, fontWeight }}>
      {segments.map((segment, index) => (
        <Text key={index}>
          {index > 0 ? '   ·   ' : ''}
          {segment.kind === 'communityRating' ? (
            <>
              <Text style={{ color: STAR_COLOR, fontSize: fontSize + 2 }}>★</Text> {segment.value}
            </>
          ) : (
            segment.value
          )}
        </Text>
      ))}
    </Text>
  );
}
