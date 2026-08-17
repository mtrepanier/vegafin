import { blue } from './blue';
import { boldBlue } from './boldBlue';
import { brown } from './brown';
import { green } from './green';
import { oledBlack } from './oledBlack';
import { orange } from './orange';
import { purple } from './purple';
import { red } from './red';
import type { AppThemeColorName, ThemePalette } from '../types';

// Mirrors getThemeColors() in ui/theme/Theme.kt.
export const palettes: Record<AppThemeColorName, ThemePalette> = {
  purple,
  blue,
  boldBlue,
  green,
  orange,
  oledBlack,
  red,
  brown,
};
