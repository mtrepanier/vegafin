import { createContext, useContext } from 'react';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';

interface HomeBackdropContextValue {
  item: BaseItemDto | null;
  setItem: (item: BaseItemDto | null) => void;
}

/**
 * Whichever item currently has focus on the Home screen, shared outside `HomeScreen.tsx` so the
 * hero's backdrop image can render full-bleed behind the side nav (`MainDrawerNavigator.tsx`)
 * instead of being confined to the content pane to the nav's right - the nav's own rail
 * component reads this too, to know when to go transparent and let the backdrop show through.
 * Defined in its own module (not alongside either consumer) to avoid a
 * MainDrawerNavigator/HomeScreen import cycle, since MainDrawerNavigator renders HomeScreen.
 */
export const HomeBackdropContext = createContext<HomeBackdropContextValue>({
  item: null,
  setItem: () => {},
});

export function useHomeBackdrop(): HomeBackdropContextValue {
  return useContext(HomeBackdropContext);
}
