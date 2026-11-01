// A screen's world: the backdrop (gradient and Ambience, static, inside the blur target), the moving light
// over it, and the frame context glass on the screen reads (size, window position and the frame's light time).
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { measure, useAnimatedReaction, useAnimatedRef, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { useTheme } from '../../theme';
import { Ambience } from '../Art';
import { type Frame, FrameContext, LightField, useBus, useClock } from './light';
import { type BlurTarget, BlurTargetContext } from './targets';

/**
 * Draws the world and provides the frame. `focused` lets screens kept alive in the background hold their
 * light still (the root clock keeps running, so the light is where it should be when the screen returns).
 * `onTarget` hands the blur target to chrome drawn outside the frame (the tab bar).
 */
export function WorldFrame({
  focused = true,
  contentInTarget = false,
  onTarget,
  children,
}: {
  focused?: boolean;
  /** Draw the screen's content inside the blur target too, so chrome frosts the rows passing under it. */
  contentInTarget?: boolean;
  onTarget?: (target: BlurTarget) => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const clock = useClock();
  const window = useWindowDimensions();
  const ref = useAnimatedRef<View>();
  const target = useRef<ComponentRef<typeof View>>(null);
  const [size, setSize] = useState({ w: window.width, h: window.height });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const t = useSharedValue(clock.t.get());
  const active = useSharedValue(focused ? 1 : 0);
  const bus = useBus();

  useAnimatedReaction(
    () => clock.t.get(),
    (now) => {
      if (active.get()) t.set(now);
    },
  );

  const place = () =>
    scheduleOnUI(() => {
      'worklet';
      const m = measure(ref);
      if (!m) return;
      x.set(m.pageX);
      y.set(m.pageY);
    });

  useEffect(() => {
    active.set(focused ? 1 : 0);
    if (focused) {
      onTarget?.(target);
      place();
      bus.notify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (Math.abs(s.w - width) < 0.5 && Math.abs(s.h - height) < 0.5 ? s : { w: width, h: height }));
    place();
    bus.notify();
  };

  const frame = useMemo<Frame>(
    () => ({ w: size.w, h: size.h, x, y, t, still: clock.still, ...bus }),
    [size.w, size.h, x, y, t, clock.still, bus],
  );

  // The light moves every frame, so it stays outside the blur target (animating inside it would make every
  // live blur re-record the target each frame). Only the profiling experiment (contentInTarget) moves it in,
  // with the content, so it still lies under the content.
  const content = (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LightField />
      </View>
      <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>
    </>
  );

  return (
    <View ref={ref} style={styles.root} onLayout={onLayout}>
      <FrameContext.Provider value={frame}>
        <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
          <LinearGradient colors={colors.gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} />
          <Ambience />
          {contentInTarget && content}
        </BlurTargetView>
        {!contentInTarget && content}
      </FrameContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, overflow: 'hidden' } });
