import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, createContext, type ReactNode, type RefObject, useContext, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

/** The view each screen's backdrop is drawn into; glass on that screen blurs it. */
export const BlurTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

/** Set inside a glass container: glass drawn within it skips its own blur, so the pieces read as one sheet. */
const InsideGlass = createContext(false);

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Corner radius; defaults to the look's card radius. */
  radius?: number;
  /** Blur strength (0-100). */
  intensity?: number;
  /** Extra tint laid over the glass, e.g. a kind colour. */
  tint?: string;
  /** Makes the glass a button that squeezes and lights up under the finger. */
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  children?: ReactNode;
}

/**
 * Liquid glass: blurs what's behind it, catches light along the top rim, picks up the look's
 * glow along the bottom edge, and (when pressable) squeezes and brightens while touched.
 */
export function Glass({ style, radius, intensity = 85, tint, onPress, onLongPress, accessibilityLabel, children }: Props) {
  const theme = useTheme();
  const target = useContext(BlurTargetContext);
  const nested = useContext(InsideGlass);
  const press = useRef(new Animated.Value(0)).current;
  const { colors, glass } = theme;
  const m = colors.material;
  const r = radius ?? theme.radius;
  const interactive = !!(onPress || onLongPress);

  if (!glass) {
    const plain = (
      <View style={[{ borderRadius: r, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }, style]}>
        {children}
      </View>
    );
    return interactive ? (
      <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
        {plain}
      </Pressable>
    ) : (
      plain
    );
  }

  // Android blurs only a known target; without one (e.g. inside a modal) the sheen alone carries the look.
  const canBlur = !nested && (Platform.OS !== 'android' || !!target);
  const body = (
    <Animated.View
      style={[
        styles.shell,
        {
          borderRadius: r,
          borderTopColor: m.rimTop,
          borderLeftColor: m.rimLeft,
          borderRightColor: m.rimRight,
          borderBottomColor: m.rimBottom,
        },
        !nested && { boxShadow: m.shadowPane },
        interactive && { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }] },
        style,
      ]}
    >
      {canBlur && (
        <BlurView
          intensity={intensity}
          tint={m.live.tint}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurTarget={target ?? undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: m.base }]} pointerEvents="none" />
      <LinearGradient colors={m.body} {...angleToPoints(m.bodyAngle)} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" /> : null}
      {/* The highlight band along the inside top edge. */}
      <LinearGradient colors={[m.topGlow, 'transparent']} style={[styles.topGlow, { height: m.topGlowPx }]} pointerEvents="none" />
      {interactive && (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: m.pressFill, opacity: press }]} pointerEvents="none" />
      )}
      <InsideGlass.Provider value>{children}</InsideGlass.Provider>
    </Animated.View>
  );
  if (!interactive) return body;

  const springTo = (toValue: number) =>
    Animated.spring(press, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue ? 0 : 10 }).start();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => springTo(1)}
      onPressOut={() => springTo(0)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {body}
    </Pressable>
  );
}

/** A CSS linear-gradient angle as LinearGradient start and end points (180 runs top to bottom). */
function angleToPoints(deg: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a) / 2;
  const dy = -Math.cos(a) / 2;
  return { start: { x: 0.5 - dx, y: 0.5 - dy }, end: { x: 0.5 + dx, y: 0.5 + dy } };
}

const styles = StyleSheet.create({
  shell: { overflow: 'hidden', borderWidth: 1 },
  topGlow: { position: 'absolute', top: 0, left: 0, right: 0 },
});
