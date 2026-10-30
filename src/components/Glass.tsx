import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, createContext, type ReactNode, type RefObject, useContext } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

/** The view each screen's backdrop is drawn into; glass on that screen blurs it. */
export const BlurTargetContext = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Corner radius; defaults to the look's card radius. */
  radius?: number;
  /** Blur strength (0-100). */
  intensity?: number;
  /** Extra tint laid over the glass, e.g. a kind colour. */
  tint?: string;
  children?: ReactNode;
}

/** Frosted glass: blurs what's behind, a bright-to-clear sheen, and a hairline highlight edge. */
export function Glass({ style, radius, intensity = 40, tint, children }: Props) {
  const theme = useTheme();
  const target = useContext(BlurTargetContext);
  const { colors, glass } = theme;
  const r = radius ?? theme.radius;
  if (!glass) {
    return <View style={[{ borderRadius: r, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder }, style]}>{children}</View>;
  }
  // Android blurs only a known target; without one (e.g. inside a modal) the sheen alone carries the look.
  const canBlur = Platform.OS !== 'android' || !!target;
  return (
    <View style={[{ borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder }, style]}>
      {canBlur && (
        <BlurView
          intensity={intensity}
          tint={colors.blurTint}
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurTarget={target ?? undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient
        colors={colors.glassFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" /> : null}
      {children}
    </View>
  );
}
