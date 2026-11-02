// The looks' header art on the desktop, drawn by the shell between the world and the page, so it can run under the
// top bar and past the content area's edges. The focused page tells it where its header ends and how far it has
// scrolled (Page publishes both).
//
// Pine: the canopy slab, as on the phone. It starts in the gap right of the sidebar, runs flush with the window's
// top and off its right edge, and ends in the rounded 28 dp foot with the mint rim, 16 dp under the subtitle. The
// top bar sits on it (its controls become slab troughs), the moon glow sits behind the bell and New, and the pines
// stand at the bottom right, at most 180 dp tall. As the page scrolls the slab follows the header up, then stays
// as a band behind the top bar, so the bar never loses it.
//
// Paper: the mountains, behind the right half of the Overview and Today headers only. They drift up at half the
// scroll speed and fade as the header leaves, and fade out by the header's foot, so no panel sits on them.
import { type ComponentRef, createContext, useContext, useEffect, useRef } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { CANOPY_ART, LIGHTS, headerSource } from '../Art';
import { phase, pose, useFrame } from '../glass/light';
import { clearOf } from '../glass/colour';
import { EASE_OUT, FADE } from '../Motion';
import { SHELL, type ShellMetrics } from './layout';
import type { PageKey } from './nav';

/** Where the focused page's header ends (in its scroll content) and how far that page has scrolled. */
export interface HeaderArtValue {
  bottom: SharedValue<number>;
  scrollY: SharedValue<number>;
}

export const HeaderArtContext = createContext<HeaderArtValue | null>(null);
export const useHeaderArt = () => useContext(HeaderArtContext);

/** The slab keeps this much under the header's last line, as on the phone; Page adds the gap after the foot. */
export const SLAB_UNDER = 16;
/** Space between the slab's foot and the first panel (the phone's CANOPY_GAP). */
export const SLAB_GAP = 12;
const FOOT = 28;
/** The band left behind the top bar once the header has scrolled away: just past the content area's top. */
const BAND_PAST = 4;
/** The moon glow behind the bell and New: a circle this wide, its centre this far in from the right and down. */
const MOON = { size: 320, right: 118, top: 44 };
/** The moon drifts as far as on a phone (its motion is measured in phone frame widths). */
const PHONE_FRAME = 400;
/** Paper's crag on a comfortable and a compact window: its width, where its peak sits (the peak is a ninth of the
 *  way down the picture), and how far the fade runs above the header's foot. */
const CRAG = { width: 600, compactWidth: 520, peak: 24, peakAt: 100 / 900, fade: 96 };
/** Pages that show Paper's mountains, as the phone shows them over Today. */
const CRAG_PAGES: PageKey[] = ['overview', 'today'];

const SETTLE = { duration: 220, easing: EASE_OUT };
const SHOW = { duration: 180, easing: EASE_OUT, ...FADE };

export function HeaderArt({
  art,
  m,
  left,
  page,
  windowW,
}: {
  art: HeaderArtValue;
  m: ShellMetrics;
  /** The sidebar's (or the rail's) width, animated by the shell. */
  left: SharedValue<number>;
  page?: PageKey;
  windowW: number;
}) {
  const { name, colors } = useTheme();
  const c = colors.material.canopy;
  if (c) return <Slab art={art} m={m} left={left} />;
  const crag = headerSource(name);
  if (crag && name === 'paper') return <Crag art={art} m={m} source={crag} on={!!page && CRAG_PAGES.includes(page)} windowW={windowW} />;
  return null;
}

function Slab({ art, m, left }: { art: HeaderArtValue; m: ShellMetrics; left: SharedValue<number> }) {
  const { colors } = useTheme();
  const c = colors.material.canopy!;
  // The header's foot in the window at rest (unscrolled), and as the page scrolls.
  const box = useAnimatedStyle(() => {
    const restH = m.pageTop + art.bottom.get() + SLAB_UNDER;
    const h = Math.max(m.pageTop + BAND_PAST, restH - Math.max(0, art.scrollY.get()));
    return { left: m.inset * 2 + (m.compact ? SHELL.rail : left.get()), height: art.bottom.get() > 0 ? h : 0 };
  });
  // The pines keep the size the resting slab gives them and ride its foot up as it scrolls.
  const pines = useAnimatedStyle(() => {
    const restH = m.pageTop + art.bottom.get() + SLAB_UNDER;
    const h = Math.min(c.maxArt, restH);
    return { height: h, width: CANOPY_ART ? h / CANOPY_ART.ratio : 0 };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.slab, { borderBottomColor: c.rim, boxShadow: c.shadow }, box]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundImage: `linear-gradient(180deg, ${c.gradient[0]} 0px, ${c.gradient[1]} 140px, ${c.gradient[2]} 100%)` },
        ]}
      />
      {CANOPY_ART ? (
        <Animated.View style={[styles.pines, { opacity: c.art }, pines]}>
          <Image source={CANOPY_ART.source} resizeMode="stretch" fadeDuration={0} style={styles.fill} accessibilityIgnoresInvertColors />
        </Animated.View>
      ) : null}
      <Moon color={c.moon} />
    </Animated.View>
  );
}

/** The moon's glow behind the bell and New, drifting with the look's moon light on the frame's clock. */
function Moon({ color }: { color: string }) {
  const { name } = useTheme();
  const { t, still } = useFrame();
  const motion = LIGHTS[name][0]?.motion;
  const style = useAnimatedStyle(() => {
    if (!motion) return {};
    const k = pose(motion, phase(t.get(), still.get(), motion.period), PHONE_FRAME);
    return { transform: [{ translateX: k.tx }, { translateY: k.ty }, { scale: k.sc }] };
  });
  return (
    <Animated.View
      style={[styles.moon, { backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${color} 0%, ${clearOf(color)} 70%)` }, style]}
    />
  );
}

function Crag({
  art,
  m,
  source,
  on,
  windowW,
}: {
  art: HeaderArtValue;
  m: ShellMetrics;
  source: ImageSourcePropType;
  on: boolean;
  windowW: number;
}) {
  const width = Math.min(m.compact ? CRAG.compactWidth : CRAG.width, Math.round(windowW * 0.45));
  const height = Math.round(width * 1.1111);
  const shown = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    shown.set(withTiming(on ? 1 : 0, SHOW));
  }, [on, shown]);
  // The art fades to nothing over its last stretch, so it ends at the header's foot without an edge.
  const clip = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    const node = clip.current as unknown as { style?: CSSStyleDeclaration } | null;
    if (!node?.style) return;
    const mask = `linear-gradient(180deg, #000 0px, #000 calc(100% - ${CRAG.fade}px), transparent 100%)`;
    node.style.setProperty('mask-image', mask);
    node.style.setProperty('-webkit-mask-image', mask);
  }, []);
  const style = useAnimatedStyle(() => {
    const foot = m.pageTop + art.bottom.get();
    const y = Math.max(0, art.scrollY.get());
    // Fully drawn at rest; gone once the header has scrolled up under the top bar.
    const leave = interpolate(y, [0, Math.max(1, foot - m.pageTop)], [1, 0], 'clamp');
    return {
      opacity: shown.get() * leave * (art.bottom.get() > 0 ? 1 : 0),
      height: foot,
      transform: [{ translateY: -y * 0.5 }],
    };
  });
  return (
    <Animated.View ref={clip} pointerEvents="none" style={[styles.crag, { width }, style]}>
      <Image
        source={source}
        resizeMode="cover"
        fadeDuration={0}
        style={{ width, height, marginTop: Math.round(CRAG.peak - CRAG.peakAt * height) }}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slab: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 0,
    overflow: 'hidden',
    borderBottomLeftRadius: FOOT,
    borderBottomRightRadius: FOOT,
    borderBottomWidth: 1,
  },
  pines: { position: 'absolute', right: 0, bottom: 0 },
  // A web Image without a width and height takes its file's size, whatever box it is in.
  fill: { width: '100%', height: '100%' },
  moon: {
    position: 'absolute',
    width: MOON.size,
    height: MOON.size,
    right: MOON.right - MOON.size / 2,
    top: MOON.top - MOON.size / 2,
  },
  crag: { position: 'absolute', top: 0, right: 0, zIndex: 0, overflow: 'hidden' },
});
