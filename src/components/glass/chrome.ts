// Chrome geometry shared by the tab bar, the mini player and the floating buttons.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ThemeName, useTheme } from '../../theme';

/** float: a glass bar floating above the bottom edge (Lavender, Stone); floatInk: the same in Paper's ink;
 *  dock: a full-width glass dock on the bottom edge (Pine). */
export type BarVariant = 'float' | 'floatInk' | 'dock';

export const BAR_VARIANTS: Record<ThemeName, BarVariant> = {
  lavender: 'float',
  stone: 'float',
  paper: 'floatInk',
  pine: 'dock',
};

/** The mini player's height (38px art plus 8px padding and the rim). */
export const MINI_HEIGHT = 56;

/** The tab bar's variant, its distance from the bottom edge and its height. */
export function useBar() {
  const { name } = useTheme();
  const insets = useSafeAreaInsets();
  const variant = BAR_VARIANTS[name];
  return variant === 'dock' ? { variant, bottom: 0, height: 64 + insets.bottom } : { variant, bottom: insets.bottom + 10, height: 72 };
}
