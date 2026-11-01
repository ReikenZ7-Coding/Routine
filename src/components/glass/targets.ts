// What live blur blurs. Each screen's backdrop is drawn into a blur target (WorldFrame); chrome that floats
// over every screen (the tab bar, the mini player) blurs the focused screen's target, which the focused
// frame hands to the root through ActiveBlurTargetContext.
import { type ComponentRef, createContext, type RefObject, useContext } from 'react';
import type { View } from 'react-native';

export type BlurTarget = RefObject<ComponentRef<typeof View> | null>;

/** The view the current screen's backdrop is drawn into. */
export const BlurTargetContext = createContext<BlurTarget | null>(null);

/** The focused screen's blur target, for chrome rendered outside the screens. */
export const ActiveBlurTargetContext = createContext<BlurTarget | null>(null);

export function useBlurTarget(): BlurTarget | null {
  const local = useContext(BlurTargetContext);
  const active = useContext(ActiveBlurTargetContext);
  return local ?? active;
}
