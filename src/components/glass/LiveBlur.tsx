// Live blur for chrome only (the tab bar, the mini player): Android blurs the focused screen's blur target
// with Dimezis (RenderNode and RenderEffect on API 31+; below that it draws nothing and the chrome body is
// thickened instead). Intensity stays low and the reduction factor below 1, so the radius is large while
// expo-blur's own overlay stays faint. Never animated, and never inside a blur target.
import { BlurView } from 'expo-blur';
import { Platform, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useBlurTarget } from './targets';

export interface LiveBlurProps {
  radius: number;
  /** Only the top corners are rounded (docked chrome, sheets). */
  topOnly?: boolean;
}

/** Whether this device can blur live (Android below API 31 cannot). */
export const CAN_LIVE_BLUR = Platform.OS !== 'android' || (typeof Platform.Version === 'number' && Platform.Version >= 31);

export function LiveBlur({ radius, topOnly }: LiveBlurProps) {
  const { colors } = useTheme();
  const target = useBlurTarget();
  const live = colors.material.live;
  if (!CAN_LIVE_BLUR || (Platform.OS === 'android' && !target)) return null;
  return (
    <BlurView
      intensity={live.intensity}
      blurReductionFactor={live.reduction}
      tint={live.tint}
      blurMethod="dimezisBlurViewSdk31Plus"
      blurTarget={target ?? undefined}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, topOnly ? { borderTopLeftRadius: radius, borderTopRightRadius: radius } : { borderRadius: radius }]}
    />
  );
}
