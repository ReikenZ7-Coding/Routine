// The desktop's pressable: the hover light fades in under the content when the pointer rests on it or the keyboard
// focuses it (never on hover alone: focus shows it too, with the global focus ring), the press light and a small
// squeeze answer a click. Hover 120 ms in, 160 ms out; the fades stay under reduced motion, the squeeze does not.
import type { ReactNode } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  Pressable,
  type Role,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { EASE_OUT, FADE, keyboardFocus, useReduceMotion } from '../Motion';

const IN = { duration: 120, easing: EASE_OUT, ...FADE };
const OUT = { duration: 160, easing: EASE_OUT, ...FADE };

export interface HoverProps {
  onPress?: () => void;
  disabled?: boolean;
  /** Off while the control is hidden (a faded-out sidebar section), so Tab skips it. */
  focusable?: boolean;
  style?: StyleProp<ViewStyle>;
  outerStyle?: StyleProp<ViewStyle>;
  /** The hover light's corner radius (defaults to the style's). */
  radius?: number;
  /** Squeeze on press (buttons); rows and nav items only light up. */
  squeeze?: boolean;
  /** Draw the hover light (off when the surface draws its own, e.g. Glass). */
  light?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  role?: Role;
  nativeID?: string;
  /** Extra ARIA attributes for the web (aria-current, aria-haspopup, aria-expanded...). */
  aria?: Record<string, string | boolean | undefined>;
  onHoverChange?: (on: boolean) => void;
  onFocusChange?: (on: boolean) => void;
  children: ReactNode;
}

export function Hover({
  onPress,
  disabled,
  focusable = true,
  style,
  outerStyle,
  radius,
  squeeze = false,
  light = true,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  role,
  nativeID,
  aria,
  onHoverChange,
  onFocusChange,
  children,
}: HoverProps) {
  const { colors } = useTheme();
  const hover = useSharedValue(0);
  const focus = useSharedValue(0);
  const press = useSharedValue(0);
  const scale = useSharedValue(1);
  const reduced = useReduceMotion();
  const lightStyle = useAnimatedStyle(() => ({ opacity: Math.max(hover.get(), focus.get()) }));
  const pressStyle = useAnimatedStyle(() => ({ opacity: press.get() }));
  const squeezeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const flat = StyleSheet.flatten(style) ?? {};
  const r = radius ?? (typeof flat.borderRadius === 'number' ? flat.borderRadius : 0);
  const hl = colors.material.hover;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      focusable={focusable}
      onHoverIn={() => {
        hover.set(withTiming(1, IN));
        onHoverChange?.(true);
      }}
      onHoverOut={() => {
        hover.set(withTiming(0, OUT));
        onHoverChange?.(false);
      }}
      onFocus={(e) => {
        if (keyboardFocus(e)) focus.set(withTiming(1, IN));
        onFocusChange?.(true);
      }}
      onBlur={() => {
        focus.set(withTiming(0, OUT));
        onFocusChange?.(false);
      }}
      onPressIn={() => {
        press.set(withTiming(1, IN));
        if (squeeze && !reduced) scale.set(withTiming(0.97, { duration: 120, easing: EASE_OUT }));
      }}
      onPressOut={() => {
        press.set(withTiming(0, OUT));
        if (squeeze) scale.set(withTiming(1, { duration: 160, easing: EASE_OUT }));
      }}
      style={[{ borderRadius: r }, outerStyle]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={role ? undefined : accessibilityRole}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
      role={role}
      nativeID={nativeID}
      {...(aria as object)}
    >
      <Animated.View style={[style, squeeze ? squeezeStyle : null]}>
        {light && (
          <Animated.View
            pointerEvents="none"
            style={[styles.layer, { borderRadius: r, backgroundColor: hl.fill, borderWidth: 1, borderColor: hl.rim }, lightStyle]}
          />
        )}
        <Animated.View
          pointerEvents="none"
          style={[styles.layer, { borderRadius: r, backgroundColor: colors.material.pressFill }, pressStyle]}
        />
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
