// The bloom: a radial light inside a hero card (Lavender and Pine) that breathes slowly. It rides the frame's
// light clock (so it holds while its screen is out of focus or the app is in the background) through a sine,
// which makes the loop seamless; under reduced motion it rests at 0.8.
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { softenGradient } from './colour';
import { BLOOM_PERIOD, phase, useFrame } from './light';

export function Bloom({ image }: { image: string }) {
  const { t, still } = useFrame();
  const style = useAnimatedStyle(() => {
    if (still.get()) return { opacity: 0.8, transform: [{ scale: 1.04 }] };
    const s = Math.sin(2 * Math.PI * phase(t.get(), 0, BLOOM_PERIOD));
    return { opacity: 0.775 + 0.225 * s, transform: [{ scale: 1.04 + 0.04 * s }] };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: softenGradient(image) }, style]} />;
}
