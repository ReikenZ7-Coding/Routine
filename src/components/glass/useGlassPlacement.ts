// Where a glass surface sits in the world. Measured on the UI thread when it lays out, after every render,
// when its frame regains focus or changes size, and when the scroll content around it grows or shrinks;
// never per frame. Each measurement is repeated once things have settled (entering and layout animations
// move a surface for a few hundred ms), so the lens always ends up aligned.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';
import { measure, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { useGlassScroll } from './GlassScroll';
import { type Placement, useFrame } from './light';

/** Long enough for an entering animation (260ms plus a stagger) or a 260ms layout transition to finish. */
const SETTLE_LAYOUT = 720;
const SETTLE_CHANGE = 340;

export function useGlassPlacement(enabled: boolean) {
  const ref = useAnimatedRef<View>();
  const frame = useFrame();
  const { scrollX, scrollY } = useGlassScroll();
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const w = useSharedValue(0);
  const h = useSharedValue(0);
  /** The surface's y in its frame when last measured: the frozen sheen position under reduced motion. */
  const restY = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fy = frame.y;

  const measureNow = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      const m = measure(ref);
      if (!m || (m.width === 0 && m.height === 0)) return;
      baseX.set(m.pageX + scrollX.get());
      baseY.set(m.pageY + scrollY.get());
      restY.set(m.pageY - fy.get());
      w.set(m.width);
      h.set(m.height);
    });
  }, [ref, baseX, baseY, restY, w, h, scrollX, scrollY, fy]);

  const settle = useCallback(
    (after: number) => {
      if (!enabled) return;
      measureNow();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(measureNow, after);
    },
    [enabled, measureNow],
  );

  useEffect(() => frame.subscribe(() => settle(SETTLE_CHANGE)), [frame, settle]);
  // After every render: rows that re-sort or change size move the glass with them.
  useEffect(() => settle(SETTLE_CHANGE));
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      w.set(e.nativeEvent.layout.width);
      h.set(e.nativeEvent.layout.height);
      settle(SETTLE_LAYOUT);
    },
    [w, h, settle],
  );

  const placement = useMemo<Placement>(() => ({ baseX, baseY, w, h, scrollX, scrollY }), [baseX, baseY, w, h, scrollX, scrollY]);
  return { ref, onLayout, placement, restY };
}
