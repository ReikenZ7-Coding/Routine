import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { alphaOf, clearOf } from './glass/colour';
import { EASE_OUT, Press, useReduceMotion } from './Motion';
import { useFabBottom } from './NowPlaying';

/**
 * Scroll tracking for a screen's floating button: it steps out of the way while the page scrolls down (so it never
 * sits on a row's tick as you read down the list) and comes back as soon as you scroll up, or reach the top or the
 * end. Pass `onScroll` to the screen's GlassScroll and `hidden` to its Fab.
 */
export function useFabScroll() {
  const [hidden, setHidden] = useState(false);
  const last = useSharedValue(0);
  const down = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      const end = e.contentSize.height - e.layoutMeasurement.height;
      const dy = y - last.get();
      let next = down.get();
      if (y < 24 || y > end - 24) next = false;
      else if (dy > 4) next = true;
      else if (dy < -4) next = false;
      last.set(y);
      if (next !== down.get()) {
        down.set(next);
        scheduleOnRN(setHidden, next);
      }
    },
  });
  return { hidden, onScroll };
}

const STEP = { duration: 220, easing: EASE_OUT, reduceMotion: ReduceMotion.Never };

/** The screen's one floating action: a 56 disc filled with the look's primary, clear of the tab bar and the mini
 *  player. Lavender's is a solid violet bead with a lit rim, so it stands apart from the glass it floats over;
 *  Paper's is ink glass with a faint lit top edge and a specular cap; Pine's mint disc of control glass wears the
 *  same cap. While the page scrolls down it slides 24 down and fades out (only fades under reduced motion). */
export function Fab({
  icon = 'add',
  onPress,
  accessibilityLabel,
  hidden = false,
}: {
  icon?: string;
  onPress: () => void;
  accessibilityLabel: string;
  hidden?: boolean;
}) {
  const { colors, name } = useTheme();
  const styles = useStyles(makeStyles);
  const bottom = useFabBottom();
  const reduced = useReduceMotion();
  const away = useSharedValue(hidden ? 1 : 0);
  useEffect(() => {
    away.set(withTiming(hidden ? 1 : 0, STEP));
  }, [hidden, away]);
  const anim = useAnimatedStyle(() => ({
    opacity: 1 - away.get(),
    transform: [{ translateY: reduced ? 0 : away.get() * 24 }],
  }));
  const solid = name === 'paper' || name === 'lavender';
  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}
      style={[styles.spot, { bottom }, anim]}
    >
      {solid ? (
        <Press
          style={[styles.ink, name === 'lavender' && styles.bead]}
          haptic
          overlay={alphaOf(colors.onPrimary, 0.1)}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel}
        >
          <View pointerEvents="none" style={styles.specular} />
          <Ionicons name={icon as 'add'} size={28} color={colors.onPrimary} />
        </Press>
      ) : (
        <Glass tier="control" radius={28} style={styles.fab} onPress={onPress} accessibilityLabel={accessibilityLabel}>
          <View pointerEvents="none" style={styles.fill} />
          {name === 'pine' && <View pointerEvents="none" style={styles.specular} />}
          <Ionicons name={icon as 'add'} size={28} color={colors.onPrimary} />
        </Glass>
      )}
    </Animated.View>
  );
}

const makeStyles = ({ colors }: Theme) => {
  const lip = colors.material.rimTop;
  return StyleSheet.create({
    spot: { position: 'absolute', right: 20 },
    fab: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.actionGlow,
    },
    fill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    ink: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      borderWidth: 1,
      borderColor: alphaOf(lip, 0.08),
      borderTopColor: alphaOf(lip, 0.24),
      boxShadow: `${colors.litGlow}, 0px 2px 4px ${alphaOf(colors.primary, 0.12)}`,
    },
    // Lavender: a solid bead, its rim lit at the top, its one glow the rose action light.
    bead: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderColor: alphaOf(lip, 0.3),
      borderTopColor: lip,
      boxShadow: colors.actionGlow,
    },
    specular: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '45%',
      borderTopLeftRadius: 29,
      borderTopRightRadius: 29,
      backgroundImage: `linear-gradient(180deg, ${alphaOf(lip, 0.18)}, ${clearOf(lip)})`,
    },
  });
};
