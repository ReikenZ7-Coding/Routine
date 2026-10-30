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
export function Glass({ style, radius, intensity = 40, tint, onPress, onLongPress, accessibilityLabel, children }: Props) {
  const theme = useTheme();
  const target = useContext(BlurTargetContext);
  const nested = useContext(InsideGlass);
  const press = useRef(new Animated.Value(0)).current;
  const { colors, glass } = theme;
  const r = radius ?? theme.radius;
  const interactive = !!(onPress || onLongPress);

  if (!glass) {
    const plain = <View style={[{ borderRadius: r, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }, style]}>{children}</View>;
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
        { borderRadius: r, borderColor: colors.cardBorder, borderTopColor: colors.rim },
        interactive && { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }] },
        style,
      ]}
    >
      {canBlur && (
        <BlurView
          intensity={intensity}
          tint={colors.blurTint}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurTarget={target ?? undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient colors={colors.glassFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" /> : null}
      {/* Specular shine across the top, and the surrounding colour caught along the bottom edge. */}
      <LinearGradient colors={[colors.shine, 'transparent']} end={{ x: 0, y: 0.45 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient colors={['transparent', colors.edgeGlow]} start={{ x: 0, y: 0.6 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {interactive && <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.shine, opacity: press }]} pointerEvents="none" />}
      <InsideGlass.Provider value>{children}</InsideGlass.Provider>
    </Animated.View>
  );
  if (!interactive) return body;

  const springTo = (toValue: number) => Animated.spring(press, { toValue, useNativeDriver: true, speed: 40, bounciness: toValue ? 0 : 10 }).start();
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

const styles = StyleSheet.create({
  shell: { overflow: 'hidden', borderWidth: 1 },
});
