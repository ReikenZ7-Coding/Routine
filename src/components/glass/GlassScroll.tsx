// A scroll view that tells the glass inside it how far it has scrolled, so each surface's lens (the blurred
// world behind it) and sheen follow it on the UI thread. Vertical scrolls set scrollY, horizontal ones
// scrollX; a horizontal row inside a vertical page keeps the page's scrollY.
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import Animated, {
  type AnimatedScrollViewProps,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedRef,
  useScrollOffset,
  useSharedValue,
} from 'react-native-reanimated';
import { useFrame } from './light';

export interface GlassScrollValue {
  scrollX: SharedValue<number>;
  scrollY: SharedValue<number>;
}

export const GlassScrollContext = createContext<GlassScrollValue | null>(null);

/** The scroll offsets glass moves with (zero outside any GlassScroll). */
export function useGlassScroll(): GlassScrollValue {
  const scroll = useContext(GlassScrollContext);
  const zeroX = useSharedValue(0);
  const zeroY = useSharedValue(0);
  return useMemo(() => scroll ?? { scrollX: zeroX, scrollY: zeroY }, [scroll, zeroX, zeroY]);
}

type GlassScrollProps = Omit<AnimatedScrollViewProps, 'onContentSizeChange'> & {
  children?: ReactNode;
  onContentSizeChange?: (w: number, h: number) => void;
  /** Mirrors the scroll offset for chrome drawn outside the scroll (a fade under a fixed header). */
  offsetOut?: SharedValue<number>;
};

export function GlassScroll({ horizontal, children, onContentSizeChange, offsetOut, ...props }: GlassScrollProps) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(ref);
  useAnimatedReaction(
    () => offset.get(),
    (v) => offsetOut?.set(v),
  );
  const parent = useGlassScroll();
  const frame = useFrame();
  const value = useMemo<GlassScrollValue>(
    () => (horizontal ? { scrollX: offset, scrollY: parent.scrollY } : { scrollX: parent.scrollX, scrollY: offset }),
    [horizontal, offset, parent.scrollX, parent.scrollY],
  );
  return (
    <Animated.ScrollView
      ref={ref}
      horizontal={horizontal}
      scrollEventThrottle={16}
      // Content that grows or shrinks (a calendar opening, a section collapsing) moves the glass below it.
      onContentSizeChange={(w, h) => {
        frame.notify();
        onContentSizeChange?.(w, h);
      }}
      {...props}
    >
      <GlassScrollContext.Provider value={value}>{children}</GlassScrollContext.Provider>
    </Animated.ScrollView>
  );
}
