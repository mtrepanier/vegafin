import { createContext, useContext } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

interface ScreenBackdropContextValue {
  item: BaseItemDto | null;
  setItem: (item: BaseItemDto | null) => void;
}

/**
 * Whichever item the current screen wants a full-bleed backdrop for - `HomeScreen.tsx` sets it
 * to whichever card has focus, `MovieDetail.tsx` sets it to the item the page is about - shared
 * outside either screen so `ScreenBackdrop.tsx` can render the image full-bleed behind the side
 * nav (`MainDrawerNavigator.tsx`) instead of being confined to the content pane to the nav's
 * right. The nav's own rail component reads this too, to know when to go transparent and let
 * the backdrop show through. Defined in its own module (not alongside any consumer) to avoid an
 * import cycle, since `MainDrawerNavigator` renders every screen that can set this.
 */
export const ScreenBackdropContext = createContext<ScreenBackdropContextValue>({
  item: null,
  setItem: () => {},
});

export function useScreenBackdrop(): ScreenBackdropContextValue {
  return useContext(ScreenBackdropContext);
}
