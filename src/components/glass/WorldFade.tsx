// A fade into the world itself, for content that scrolls under fixed chrome (the Library's search and switch,
// the player's top bar).
import { StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Ambience } from '../Art';
import { useFrame } from './light';

const FADE_STEPS = 10;
const FADE_STEP = 3.2;

/**
 * Thin strips of the screen's own backdrop, each lined up with the world behind it and more transparent than the
 * one above. A plain gradient would need one colour for the whole width, and the world is never one colour.
 * It sits at the top of its parent; `top` is where that is in the frame, to line the strips up with the world; `solid` is an opaque band of the world above the fade (behind a fixed
 * bar, so content scrolling up never shows through its title). It comes in over the first 24 of scroll, so at
 * rest the first row sits clear of it; it follows the scroll on the UI thread.
 */
export function WorldFade({ top, scroll, solid = 0 }: { top: number; scroll: SharedValue<number>; solid?: number }) {
  const frame = useFrame();
  const shown = useAnimatedStyle(() => ({ opacity: interpolate(scroll.get(), [0, 24], [0, 1], Extrapolation.CLAMP) }));
  const world = (y: number) => (
    <View style={{ position: 'absolute', left: 0, top: -(top + y), width: frame.w, height: frame.h }}>
      <Ambience />
    </View>
  );
  return (
    <Animated.View pointerEvents="none" style={[styles.fade, { height: solid + FADE_STEPS * FADE_STEP }, shown]}>
      {solid > 0 && <View style={[styles.strip, { top: 0, height: solid + 0.5 }]}>{world(0)}</View>}
      {Array.from({ length: FADE_STEPS }, (_, i) => (
        <View key={i} style={[styles.strip, { top: solid + i * FADE_STEP, height: FADE_STEP + 0.5, opacity: 1 - (i / FADE_STEPS) ** 2 }]}>
          {world(solid + i * FADE_STEP)}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  strip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
});
