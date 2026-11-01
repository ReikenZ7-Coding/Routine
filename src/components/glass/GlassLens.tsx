// The lens: the slice of the pre-blurred world that lies behind a surface. It is the look's
// <look>-bg-blur.jpg (scrim and veil baked in) at exactly the size and crop of Ambience in the frame, moved
// by the surface's place in the frame, so the glass shows the blurred world behind it on every platform,
// inside sheets, and while the page scrolls. When the screen draws the mountain header (Paper's Today), the
// header's blurred copy is laid over it where the surface overlaps the header.
import { createContext, useContext } from 'react';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import type { ThemeName } from '../../theme';
import { BLURRED, HEADER_BLURS, HEADER_RATIOS } from '../Art';
import { type Placement, RIM, useFrame } from './light';

/** Set by a screen that draws the header art in its scroll content: where the header's top sits in the frame
 *  at scroll 0, the scroll it moves with, and how much slower than the content it moves (parallax). */
export interface LensHeader {
  top: number;
  scrollY: SharedValue<number>;
  parallax: number;
}
export const LensHeaderContext = createContext<LensHeader | null>(null);

export function GlassLens({ placement, look }: { placement: Placement; look: ThemeName }) {
  const frame = useFrame();
  const header = useContext(LensHeaderContext);
  const headerBlur = header ? HEADER_BLURS[look] : undefined;
  const { baseX, baseY, scrollX, scrollY } = placement;
  const { x: fx, y: fy } = frame;
  const lens = useAnimatedStyle(() => ({
    transform: [
      { translateX: -(baseX.get() - scrollX.get() - fx.get()) - RIM },
      { translateY: -(baseY.get() - scrollY.get() - fy.get()) - RIM },
    ],
  }));
  const hs = header?.scrollY;
  const top = header?.top ?? 0;
  const parallax = header?.parallax ?? 0;
  const headerStyle = useAnimatedStyle(() => {
    const headerY = top - (hs ? hs.get() : 0) * (1 - parallax);
    return {
      transform: [
        { translateX: -(baseX.get() - scrollX.get() - fx.get()) - RIM },
        { translateY: headerY - (baseY.get() - scrollY.get() - fy.get()) - RIM },
      ],
    };
  });
  return (
    <>
      <Animated.Image
        source={BLURRED[look]}
        resizeMode="cover"
        fadeDuration={0}
        pointerEvents="none"
        accessibilityIgnoresInvertColors
        style={[{ position: 'absolute', left: 0, top: 0, width: frame.w, height: frame.h }, lens]}
      />
      {headerBlur ? (
        <Animated.Image
          source={headerBlur}
          resizeMode="cover"
          fadeDuration={0}
          pointerEvents="none"
          accessibilityIgnoresInvertColors
          style={[
            { position: 'absolute', left: 0, top: 0, width: frame.w, height: Math.round(frame.w * (HEADER_RATIOS[look] ?? 1)) },
            headerStyle,
          ]}
        />
      ) : null}
    </>
  );
}
