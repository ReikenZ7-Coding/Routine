// Small animated building blocks shared by every look. Everything runs on the UI thread (Reanimated), with
// transform and opacity only (the childless absolute fills of bars excepted): press feedback squeezes and fades
// a pressed layer, selection fades a layer in, rings and bars tween a shared value, and the collapse is a
// layout transition. Opacity fades keep running under reduced motion (a crossfade is the reduced form of
// motion, never a 0ms cut); transforms stop.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  Keyframe,
  FadeOut,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  ReduceMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import Svg, { Circle } from 'react-native-svg';
import { type Theme, useStyles } from '../theme';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

let systemReduceMotion = false;
const reduceMotionListeners = new Set<(on: boolean) => void>();
AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    systemReduceMotion = on;
    reduceMotionListeners.forEach((fn) => fn(on));
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
  systemReduceMotion = on;
  reduceMotionListeners.forEach((fn) => fn(on));
});

/** The system's reduce-motion setting (Android "Remove animations"), kept live: unlike Reanimated's
 *  useReducedMotion(), it follows the setting when it changes while the app is open. */
export function useReduceMotion(): boolean {
  const [on, setOn] = useState(systemReduceMotion);
  useEffect(() => {
    setOn(systemReduceMotion);
    reduceMotionListeners.add(setOn);
    return () => {
      reduceMotionListeners.delete(setOn);
    };
  }, []);
  return on;
}

/** Fades that stay even under reduced motion (a crossfade is the reduced form of motion, never a 0ms cut). */
export const FADE = { reduceMotion: ReduceMotion.Never } as const;
const GROW = LinearTransition.duration(260).easing(EASE_OUT);
const SHOW = FadeIn.duration(220).easing(EASE_OUT);
const HIDE = FadeOut.duration(160).easing(EASE_OUT);

interface PressProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Lets the pressable itself take space in its parent, e.g. `{ flex: 1 }` in a row. */
  outerStyle?: StyleProp<ViewStyle>;
  hitSlop?: number;
  /** A colour that fades in over the surface while it is pressed (under the content, 120ms in, 160ms out). */
  overlay?: string;
  /** A light selection tick of haptics when pressed (Android). */
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
  children: ReactNode;
}

const PRESS_IN = { duration: 120, easing: EASE_OUT };
const PRESS_OUT = { duration: 160, easing: EASE_OUT };

/** Press feedback: a 3% squeeze in 120ms from press-in, so the tap feels answered before the finger lifts, and
 *  optionally a pressed colour that fades in under the content. Under reduced motion the squeeze is skipped and
 *  the fade stays. On Android a keyboard or D-pad focus draws a 2px ring in the text colour (the web uses
 *  :focus-visible). */
export function Press({
  onPress,
  onLongPress,
  disabled,
  style,
  outerStyle,
  hitSlop,
  overlay,
  haptic,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityActions,
  onAccessibilityAction,
  children,
}: PressProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);
  const focus = useSharedValue(0);
  const reduced = useReduceMotion();
  const ringColor = useStyles(ringColorOf);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: pressed.get() }));
  const ring = useAnimatedStyle(() => ({ opacity: focus.get() }));
  const flat = StyleSheet.flatten(style) ?? {};
  const radius = flat.borderRadius;
  // Absolute layers sit inside the border; they bleed over it so a pressed or focused pill keeps its shape.
  const bleed = -(flat.borderWidth ?? 0);
  const pressIn = () => {
    if (!reduced) scale.set(withTiming(0.97, PRESS_IN));
    if (overlay) pressed.set(withTiming(1, { ...PRESS_IN, ...FADE }));
  };
  const pressOut = () => {
    scale.set(withTiming(1, PRESS_OUT));
    if (overlay) pressed.set(withTiming(0, { ...PRESS_OUT, ...FADE }));
  };
  const press = onPress
    ? () => {
        if (haptic && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress();
      }
    : undefined;
  const longPress = onLongPress
    ? () => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onLongPress();
      }
    : undefined;
  return (
    <Pressable
      onPress={press}
      onLongPress={longPress}
      delayLongPress={400}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onFocus={FOCUS_RING ? () => focus.set(withTiming(1, { ...PRESS_IN, ...FADE })) : undefined}
      onBlur={FOCUS_RING ? () => focus.set(withTiming(0, { ...PRESS_OUT, ...FADE })) : undefined}
      style={outerStyle}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <Animated.View style={[style, animated]}>
        {overlay ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.layer,
              { top: bleed, left: bleed, right: bleed, bottom: bleed, borderRadius: radius, backgroundColor: overlay },
              overlayStyle,
            ]}
          />
        ) : null}
        {children}
        {FOCUS_RING && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.layer,
              { top: bleed, left: bleed, right: bleed, bottom: bleed, borderRadius: radius, borderWidth: 2, borderColor: ringColor },
              ring,
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

const SELECT = { duration: 150, easing: EASE_OUT, ...FADE };

/**
 * The selected state as a layer: an absolute, childless fill (or ring) that fades in over 150ms when `on`
 * turns true and out when it turns false, so a selection never changes in a single frame. Put it first among
 * the surface's children so it lies under the content. `bleed` covers the surface's own border.
 */
export function SelectFade({
  on,
  color,
  radius,
  bleed = 0,
  style,
}: {
  on: boolean;
  color?: string;
  radius?: number;
  bleed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.set(withTiming(on ? 1 : 0, SELECT));
  }, [on, v]);
  const fade = useAnimatedStyle(() => ({ opacity: v.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.layer,
        { top: -bleed, left: -bleed, right: -bleed, bottom: -bleed, borderRadius: radius, backgroundColor: color },
        style,
        fade,
      ]}
    />
  );
}

/** A quieter state for a piece of content (a done row's tile sinks back): its opacity eases to `to` over
 *  150ms when `on` turns true, and back to 1, so it never changes in a single frame. */
export function Dim({ on, to = 0.55, style, children }: { on: boolean; to?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const v = useSharedValue(on ? to : 1);
  useEffect(() => {
    v.set(withTiming(on ? to : 1, SELECT));
  }, [on, to, v]);
  const fade = useAnimatedStyle(() => ({ opacity: v.get() }));
  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
}

/**
 * Two versions of the same content, crossfaded when `on` changes (a label's colour, an outline icon becoming a
 * filled one). The `off` version lays out the space; the `on` version is laid over it.
 */
export function FadeSwap({
  on,
  off,
  onContent,
  duration = 150,
  style,
}: {
  on: boolean;
  off: ReactNode;
  onContent: ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    v.set(withTiming(on ? 1 : 0, { duration, easing: EASE_OUT, ...FADE }));
  }, [on, v, duration]);
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - v.get() }));
  const onStyle = useAnimatedStyle(() => ({ opacity: v.get() }));
  return (
    <View style={style}>
      <Animated.View style={[styles.swap, offStyle]}>{off}</Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.swap, onStyle]}>
        {onContent}
      </Animated.View>
    </View>
  );
}

/** Native platforms draw their own focus ring; the web keeps the :focus-visible outline from _layout.tsx. */
export const FOCUS_RING = Platform.OS !== 'web';
const ringColorOf = ({ colors }: Theme) => colors.text;

/** A circle that pops when `done` flips: a quick grow, then a bouncy settle. */
export function Pop({ done, style, children }: { done: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const scale = useSharedValue(1);
  const reduced = useReduceMotion();
  const [first, setFirst] = useState(true);
  useEffect(() => {
    if (first) return setFirst(false);
    if (reduced) return;
    scale.set(withSequence(withTiming(1.25, { duration: 110, easing: EASE_OUT }), withSpring(1, { duration: 380, dampingRatio: 0.55 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A progress ring that fills with an ease-out whenever its value changes. Under reduced motion the old fill
 *  crossfades to the new one instead of sweeping. */
export function Ring({
  size,
  stroke,
  progress,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  /** 0..1 */
  progress: number;
  color: string;
  track: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, progress));
  const { p, prev, fade } = useProgressTween(target, 800);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.get()), strokeOpacity: fade.get() }));
  const oldProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - prev.get()), strokeOpacity: 1 - fade.get() }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={oldProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/**
 * The value a progress fill shows. With motion it eases to each new target. Under reduced motion it never
 * sweeps: the new fill is set at once but invisible, and crossfades in over 150ms while the old one fades out.
 */
function useProgressTween(target: number, duration: number) {
  const p = useSharedValue(0);
  const prev = useSharedValue(0);
  const fade = useSharedValue(1);
  const reduced = useReduceMotion();
  const first = useRef(true);
  useEffect(() => {
    if (!reduced) {
      fade.set(1);
      p.set(withTiming(target, { duration, easing: EASE_OUT }));
    } else if (first.current) {
      p.set(target);
    } else {
      scheduleOnUI(() => {
        'worklet';
        // The fill on screen right now becomes the old layer; the new one fades in over it.
        prev.set(fade.get() >= 0.5 ? p.get() : prev.get());
        p.set(target);
        fade.set(0);
        fade.set(withTiming(1, SELECT));
      });
    }
    first.current = false;
  }, [target, reduced, duration, p, prev, fade]);
  return { p, prev, fade };
}

/** A slim progress bar; the fills are absolute and childless, so animating their width costs no layout. */
export function Bar({ progress, color, track, height = 6 }: { progress: number; color: string; track: string; height?: number }) {
  const target = Math.max(0, Math.min(1, progress));
  const { p, prev, fade } = useProgressTween(target, 600);
  const fill = useAnimatedStyle(() => ({ width: `${p.get() * 100}%`, opacity: fade.get() }));
  const old = useAnimatedStyle(() => ({ width: `${prev.get() * 100}%`, opacity: 1 - fade.get() }));
  const bar = { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: height / 2, backgroundColor: color } as const;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[bar, old]} />
      <Animated.View style={[bar, fill]} />
    </View>
  );
}

/** Shows or hides its content with a fade while the surrounding layout eases to the new size. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <Animated.View layout={GROW}>
      {open && (
        <Animated.View entering={SHOW} exiting={HIDE}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** A chevron that turns to point the way the content will go (under reduced motion, it crossfades instead). */
export function Chevron({ open, color, size = 20 }: { open: boolean; color: string; size?: number }) {
  const turn = useSharedValue(open ? 0 : 180);
  const reduced = useReduceMotion();
  useEffect(() => {
    if (!reduced) turn.set(withTiming(open ? 0 : 180, { duration: 220, easing: EASE_OUT }));
  }, [open, reduced, turn]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  if (reduced) {
    return (
      <FadeSwap
        on={open}
        off={<Ionicons name="chevron-down" size={size} color={color} />}
        onContent={<Ionicons name="chevron-up" size={size} color={color} />}
      />
    );
  }
  return (
    <Animated.View style={animated}>
      <Ionicons name="chevron-up" size={size} color={color} />
    </Animated.View>
  );
}

/**
 * A card arriving on a screen's first mount: it rises 10px and fades in over 280ms, each one 40ms after the one
 * before (the first six; the rest arrive with the sixth). It plays once, when the card first mounts, so returning
 * to a tab shows the screen as it was. Under reduced motion the card is simply there.
 */
export function Enter({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduced = useReduceMotion();
  const [entering] = useState(() => (reduced ? undefined : rise().delay(Math.min(index, 6) * 40)));
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

/** The arrival: up 10px and in, 280ms, ease-out. A keyframe, so it is the same on every platform; a new one each
 *  time, since a keyframe's delay is set on the object itself. */
export function rise() {
  // Reanimated's web renderer pins custom entering animations to absolute positions when they end, so the web
  // build (a preview only) uses the built-in rise, which travels a little further.
  if (Platform.OS === 'web') return FadeInDown.duration(280).easing(EASE_OUT);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 10 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
  }).duration(280);
}

/** A small caption in the look's label voice (sentence case in every look), naming a group of filters. */
export function Micro({ children, color }: { children: ReactNode; color?: string }) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.micro, color ? { color } : null]}>{children}</Text>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  swap: { alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = ({ type }: Theme) =>
  StyleSheet.create({
    micro: type.label,
  });
