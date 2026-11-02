// Chrome geometry shared by the tab bar, the mini player and the floating buttons. One bar in every look: a glass
// bar floating 16 in from each side and 10 above the bottom safe area, 72 tall with a 30 radius. Only its colours
// and its glass differ between looks.
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The mini player's height (38px art plus 8px padding and the rim). */
export const MINI_HEIGHT = 56;

/** The tab bar's height, its corner radius and its gap above the bottom safe area. */
export const BAR = { height: 72, radius: 30, lift: 10, inset: 16 };

/** The tab bar's distance from the bottom edge and its height. */
export function useBar() {
  const insets = useSafeAreaInsets();
  return { bottom: insets.bottom + BAR.lift, height: BAR.height };
}
