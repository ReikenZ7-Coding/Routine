// Live blur on the web: the browser's backdrop-filter, with no overlay colour of its own (expo-blur's web
// version hard-codes a white or grey wash and ties the radius to intensity).
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export interface LiveBlurProps {
  radius: number;
  topOnly?: boolean;
}

export const CAN_LIVE_BLUR = true;

export function LiveBlur({ radius, topOnly }: LiveBlurProps) {
  const { colors } = useTheme();
  const { webBlur, webSaturate } = colors.material.live;
  const filter = `blur(${webBlur}px) saturate(${webSaturate})`;
  const blur = { backdropFilter: filter, WebkitBackdropFilter: filter } as unknown as ViewStyle;
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        topOnly ? { borderTopLeftRadius: radius, borderTopRightRadius: radius } : { borderRadius: radius },
        blur,
      ]}
    />
  );
}
