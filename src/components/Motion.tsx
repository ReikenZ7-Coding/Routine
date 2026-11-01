// Small animated building blocks for the page looks. Everything runs on the UI thread (Reanimated):
// press feedback is a CSS transition, rings and bars tween a shared value, and the collapse is a layout transition.
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { type Theme, useStyles } from '../theme';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
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
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  children: ReactNode;
}

/** Press feedback: a 3% squeeze in 120ms, from press-in, so the tap feels answered before the finger lifts. */
export function Press({
  onPress,
  onLongPress,
  disabled,
  style,
  outerStyle,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
}: PressProps) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const squeeze = (to: number) => {
    if (!reduced) scale.set(withTiming(to, { duration: 120, easing: EASE_OUT }));
  };
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => squeeze(0.97)}
      onPressOut={() => squeeze(1)}
      style={outerStyle}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}

/** A circle that pops when `done` flips: a quick grow, then a bouncy settle. */
export function Pop({ done, style, children }: { done: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
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

/** A progress ring that fills with an ease-out whenever its value changes. */
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
  const p = useSharedValue(0);
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, progress));
  useEffect(() => {
    p.set(reduced ? target : withTiming(target, { duration: 800, easing: EASE_OUT }));
  }, [target, reduced, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.get()) }));
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
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** A slim progress bar; the fill is absolute and childless, so animating its width costs no layout. */
export function Bar({ progress, color, track, height = 6 }: { progress: number; color: string; track: string; height?: number }) {
  const p = useSharedValue(0);
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, progress));
  useEffect(() => {
    p.set(reduced ? target : withTiming(target, { duration: 600, easing: EASE_OUT }));
  }, [target, reduced, p]);
  const fill = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: height / 2, backgroundColor: color }, fill]}
      />
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

/** A chevron that turns to point the way the content will go. */
export function Chevron({ open, color, size = 20 }: { open: boolean; color: string; size?: number }) {
  const turn = useSharedValue(open ? 0 : 180);
  const reduced = useReducedMotion();
  useEffect(() => {
    turn.set(reduced ? (open ? 0 : 180) : withTiming(open ? 0 : 180, { duration: 220, easing: EASE_OUT }));
  }, [open, reduced, turn]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  return (
    <Animated.View style={animated}>
      <Ionicons name="chevron-up" size={size} color={color} />
    </Animated.View>
  );
}

/** A small uppercase caption, the way the hubs label a group of filters. */
export function Micro({ children, color }: { children: ReactNode; color?: string }) {
  const styles = useStyles(makeStyles);
  return <Text style={[styles.micro, color ? { color } : null]}>{children}</Text>;
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    micro: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.muted },
  });
