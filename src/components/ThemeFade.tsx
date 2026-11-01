// A change of look never cuts: for 240ms the old look's blurred world lies over everything and fades away, so the
// new look comes up through the old one's frosted glass. It is a fade, so it stays under reduced motion.
import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type ThemeName, useTheme } from '../theme';
import { BLURRED } from './Art';
import { EASE_OUT } from './Motion';

const OUT = { duration: 240, easing: EASE_OUT, reduceMotion: ReduceMotion.Never };

/** Draw last in a root (the app, and each sheet's window, since a Modal is a window of its own). */
export function ThemeFade() {
  const { name } = useTheme();
  // Derived during render, so the cover is there in the same frame as the first frame of the new look.
  const [state, setState] = useState<{ name: ThemeName; from: ThemeName | null; n: number }>({ name, from: null, n: 0 });
  if (state.name !== name) setState({ name, from: state.name, n: state.n + 1 });
  if (!state.from) return null;
  return <Cover key={state.n} from={state.from} onDone={() => setState((s) => (s.n === state.n ? { ...s, from: null } : s))} />;
}

function Cover({ from, onDone }: { from: ThemeName; onDone: () => void }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.set(
      withTiming(0, OUT, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(onDone);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fade = useAnimatedStyle(() => ({ opacity: o.get() }));
  return (
    <Animated.View pointerEvents="none" testID="theme-fade" style={[StyleSheet.absoluteFill, fade]}>
      <Image source={BLURRED[from]} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}
