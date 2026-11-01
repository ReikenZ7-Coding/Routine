// The moving light of each look. One clock runs at the root of the app (never per screen), so the orbs, beam,
// sun and moon carry on where they were when you switch tabs. Every screen frame copies the clock while it is
// in focus; LightField draws the light over the world and LightCatch draws the same light inside glass, at
// the look's catch strength, wherever the light passes behind a surface. Transform and opacity only, on the
// UI thread.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { type ThemeName, useTheme } from '../../theme';
import { type Light, type LightMotion, LIGHTS, lightBox } from '../Art';
import { useReduceMotion } from '../Motion';

/** Bloom breathing period (ms); it rides the same clock as the light. */
export const BLOOM_PERIOD = 6000;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** The clock wraps at a common multiple of every period, so no layer ever jumps at the wrap. */
const CYCLE = Object.values(LIGHTS)
  .flat()
  .map((l) => l.motion.period)
  .concat(BLOOM_PERIOD)
  .reduce((a, b) => (a * b) / gcd(a, b), 1);

interface Clock {
  /** Light time in ms, 0..CYCLE. */
  t: SharedValue<number>;
  /** 1 while reduced motion is on: every layer parks at a quarter of its path. */
  still: SharedValue<number>;
}

/** A screen-sized frame that the world is drawn into (Ambience, the lens and the light all share it). */
export interface Frame {
  w: number;
  h: number;
  /** The frame's top-left in window coordinates. */
  x: SharedValue<number>;
  y: SharedValue<number>;
  /** The frame's own light time: it follows the root clock while the frame is in focus and holds otherwise,
   *  so screens kept alive in the background cost nothing per frame. */
  t: SharedValue<number>;
  still: SharedValue<number>;
  /** Glass re-measures its place when the frame says positions may have moved (focus, size, content). */
  subscribe: (fn: () => void) => () => void;
  notify: () => void;
}

const ClockContext = createContext<Clock | null>(null);
export const FrameContext = createContext<Frame | null>(null);

export function useFrame(): Frame {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error('useFrame outside LightRoot');
  return frame;
}

export function useClock(): Clock {
  const clock = useContext(ClockContext);
  if (!clock) throw new Error('useClock outside LightRoot');
  return clock;
}

/** A tiny event bus for "positions may have moved". */
export function useBus() {
  return useMemo(() => {
    const fns = new Set<() => void>();
    return {
      subscribe: (fn: () => void) => {
        fns.add(fn);
        return () => {
          fns.delete(fn);
        };
      },
      notify: () => fns.forEach((fn) => fn()),
    };
  }, []);
}

/**
 * The root of the light: the one clock, and a window-sized default frame for glass drawn outside any screen
 * (the tab bar, the mini player, root-level sheets). Paused while the app is in the background; under reduced
 * motion the light stands still (a still light, not a jump: it parks at a quarter of its path).
 */
export function LightRoot({ children }: { children: ReactNode }) {
  const t = useSharedValue(0);
  const reduced = useReduceMotion();
  const still = useSharedValue(reduced ? 1 : 0);
  const [awake, setAwake] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const tick = useCallback(
    (f: { timeSincePreviousFrame: number | null }) => {
      'worklet';
      // A long gap (a dropped run of frames) advances the light by one frame's worth, never a visible leap.
      const dt = Math.min(f.timeSincePreviousFrame ?? 16, 64);
      t.set((t.get() + dt) % CYCLE);
    },
    [t],
  );
  const callback = useFrameCallback(tick, false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAwake(s === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    still.set(reduced ? 1 : 0);
    callback.setActive(awake && !reduced);
  }, [awake, reduced, callback, still]);

  const clock = useMemo(() => ({ t, still }), [t, still]);
  const { width, height } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const bus = useBus();
  const frame = useMemo<Frame>(() => ({ w: width, h: height, x, y, t, still, ...bus }), [width, height, x, y, t, still, bus]);
  return (
    <ClockContext.Provider value={clock}>
      <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>
    </ClockContext.Provider>
  );
}

/** Where on its path a layer with this period is (0..1). */
export function phase(t: number, still: number, period: number): number {
  'worklet';
  return still ? 0.25 : (t % period) / period;
}

export interface LightPose {
  tx: number;
  ty: number;
  rot: number;
  sc: number;
}

/** A layer's offset from its resting box at phase p (the formulas in assets/art/looks.json). */
export function pose(m: LightMotion, p: number, frameW: number): LightPose {
  'worklet';
  const a = 2 * Math.PI * p;
  const s = Math.sin(a);
  if (m.type === 'orbit') {
    const th = ((m.phase + m.dir * 360 * p) * Math.PI) / 180;
    return { tx: m.radius * frameW * Math.cos(th), ty: m.radius * frameW * Math.sin(th), rot: 0, sc: 1 };
  }
  if (m.type === 'sway') return { tx: m.dx * s, ty: 0, rot: m.rotate * s, sc: 1 };
  if (m.type === 'drift') return { tx: m.ax * s, ty: -m.ay * Math.cos(a), rot: 0, sc: 1 + m.s * s };
  return { tx: m.x0 - m.ax * s, ty: 0, rot: 0, sc: 1 };
}

/** The look's light, drawn over the world. */
export function LightField() {
  const { name } = useTheme();
  const frame = useFrame();
  return (
    <>
      {LIGHTS[name].map((light) => (
        <FieldLayer key={`${name}-${light.name}`} light={light} frame={frame} />
      ))}
    </>
  );
}

function FieldLayer({ light, frame }: { light: Light; frame: Frame }) {
  const box = lightBox(light, frame.w, frame.h);
  const { motion } = light;
  const { w, t, still } = frame;
  const style = useAnimatedStyle(() => {
    const k = pose(motion, phase(t.get(), still.get(), motion.period), w);
    return { transform: [{ translateX: k.tx }, { translateY: k.ty }, { rotate: `${k.rot}deg` }, { scale: k.sc }] };
  });
  return (
    <Animated.Image
      source={light.source}
      resizeMode="stretch"
      fadeDuration={0}
      pointerEvents="none"
      accessibilityIgnoresInvertColors
      style={[{ position: 'absolute', ...box, opacity: light.opacity ?? 1 }, style]}
    />
  );
}

/** Where a surface sits: its content position (scroll removed), its size, and the scroll it moves with. */
export interface Placement {
  baseX: SharedValue<number>;
  baseY: SharedValue<number>;
  w: SharedValue<number>;
  h: SharedValue<number>;
  scrollX: SharedValue<number>;
  scrollY: SharedValue<number>;
}

/** The 1px rim: absolute layers sit inside it, so they shift by it to line up with the world. */
export const RIM = 1;

/**
 * The light caught inside glass: the same layers as the LightField, placed in the surface's own coordinates,
 * at the look's catch strength. A layer whose visible part misses the surface is not drawn at all (opacity 0),
 * so a screen of panes doesn't pay for light that never reaches them. Paper's mist (anchored to the top of the
 * world) is never caught, as the contrast gate assumes.
 */
export function LightCatch({ placement, look, strength }: { placement: Placement; look: ThemeName; strength: number }) {
  const frame = useFrame();
  return (
    <>
      {LIGHTS[look]
        .filter((l) => l.anchor !== 'top')
        .map((light) => (
          <CatchLayer key={light.name} light={light} frame={frame} placement={placement} strength={strength * (light.opacity ?? 1)} />
        ))}
    </>
  );
}

function CatchLayer({ light, frame, placement, strength }: { light: Light; frame: Frame; placement: Placement; strength: number }) {
  const box = lightBox(light, frame.w, frame.h);
  const { motion, bounds } = light;
  const { w: frameW, t, still, x: fx, y: fy } = frame;
  const { baseX, baseY, w, h, scrollX, scrollY } = placement;
  const style = useAnimatedStyle(() => {
    const k = pose(motion, phase(t.get(), still.get(), motion.period), frameW);
    // The surface's rect in frame coordinates.
    const cx = baseX.get() - scrollX.get() - fx.get();
    const cy = baseY.get() - scrollY.get() - fy.get();
    // The light's visible rect after its motion (rotation padded generously).
    const midX = box.left + box.width / 2 + k.tx + ((bounds[0] + bounds[2]) / 2 - 0.5) * box.width * k.sc;
    const midY = box.top + box.height / 2 + k.ty + ((bounds[1] + bounds[3]) / 2 - 0.5) * box.height * k.sc;
    const pad = Math.abs(Math.sin((k.rot * Math.PI) / 180)) * Math.max(box.width, box.height) * 0.5 + 2;
    const hw = ((bounds[2] - bounds[0]) / 2) * box.width * k.sc + pad;
    const hh = ((bounds[3] - bounds[1]) / 2) * box.height * k.sc + pad;
    const hit = midX + hw > cx && midX - hw < cx + w.get() && midY + hh > cy && midY - hh < cy + h.get();
    return {
      opacity: hit ? strength : 0,
      transform: [{ translateX: k.tx - cx - RIM }, { translateY: k.ty - cy - RIM }, { rotate: `${k.rot}deg` }, { scale: k.sc }],
    };
  });
  return (
    <Animated.Image
      source={light.source}
      resizeMode="stretch"
      fadeDuration={0}
      pointerEvents="none"
      accessibilityIgnoresInvertColors
      style={[{ position: 'absolute', ...box, opacity: 0 }, style]}
    />
  );
}
