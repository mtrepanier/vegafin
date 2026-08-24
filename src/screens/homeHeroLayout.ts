/**
 * Shared sizing for the Home screen's hero, split into two independent numbers so the
 * text/logo content panel can stay compact (matching Wholphin's own proportions) while the
 * backdrop image/gradient behind it still fades out gradually rather than cutting off hard
 * right where the text panel ends.
 */

/** Height of the fixed content panel (logo/title, cast, metadata, overview, clock) reserved
 * above the rows in `HomeScreen.tsx`, and the box `HomeHero.tsx` renders into. */
export const HOME_HERO_CONTENT_HEIGHT = 240;

/** Height of the backdrop image + its fade in `HomeHeroBackdrop.tsx` - taller than the content
 * panel on purpose, so the image has room to fade out gradually into the rows' own solid
 * background instead of being cut off right at the content panel's edge. */
export const HOME_HERO_BACKDROP_HEIGHT = 520;
