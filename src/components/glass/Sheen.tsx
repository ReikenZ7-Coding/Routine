// The sheen: a soft diagonal band of light inside the glass that slides as the surface moves through the
// screen. Near the top (closest to the light) the band sits at the left and is brightest; lower down it slides
// right and fades. Pine's light comes from below, so its band rises instead. Under reduced motion the band
// stays where the surface was laid out (the scroll coupling is parallax, so it is turned off).
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { clearOf } from './colour';
import { type Placement, useFrame } from './light';

export function Sheen({
  placement,
  restY,
  color,
  fromBelow,
  still,
}: {
  placement: Placement;
  restY: SharedValue<number>;
  color: string;
  fromBelow: boolean;
  still: boolean;
}) {
  const frame = useFrame();
  const H = frame.h;
  const { baseY, scrollY, w } = placement;
  const fy = frame.y;
  const band = useAnimatedStyle(() => {
    const width = w.get();
    const y = still ? restY.get() : baseY.get() - scrollY.get() - fy.get();
    const input = fromBelow ? [H, 0] : [0, H];
    return {
      width: 2 * width,
      opacity: interpolate(y, fromBelow ? [H, H * 0.5, 0] : [0, H * 0.5, H], [1, 0.7, 0.35], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(y, input, [-0.85 * width, 0.1 * width], Extrapolation.CLAMP) }],
    };
  });
  const clear = clearOf(color);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          backgroundImage: `linear-gradient(105deg, ${clear} 38%, ${color} 50%, ${clear} 62%)`,
        },
        band,
      ]}
    />
  );
}
