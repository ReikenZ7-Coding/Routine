// Loading feedback while the saved data is read: the screen's first panes, empty, in the look's own glass, with a
// soft band of light passing across them. Never a blank screen, never a bare spinner on the world.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { clearOf } from './glass/colour';
import { useReduceMotion } from './Motion';

const HEIGHTS = [120, 76, 76];
const SWEEP = { duration: 1200, easing: Easing.linear };

/** A screen's worth of placeholder panes, announced as "Loading". */
export function Skeleton({ label = 'Loading' }: { label?: string }) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion();
  return (
    <View
      style={[styles.screen, { paddingTop: insets.top + 16 }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <View style={styles.title} />
      {HEIGHTS.map((h, i) => (
        <Glass key={i} sheen={false} style={[styles.pane, { height: h }, reduced && styles.still]}>
          {!reduced && <Band />}
          <View style={styles.lines}>
            <View style={[styles.line, styles.lineLong]} />
            <View style={[styles.line, styles.lineShort]} />
          </View>
        </Glass>
      ))}
    </View>
  );
}

/** A childless band of light that sweeps across its pane, left to right, once every 1.2s. */
function Band() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, SWEEP), -1, false));
    return () => cancelAnimation(p);
  }, [p]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: (p.get() * 2 - 1) * width }] }));
  const light = colors.material.pressFill;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundImage: `linear-gradient(100deg, ${clearOf(light)} 20%, ${light} 50%, ${clearOf(light)} 80%)` },
            sweep,
          ]}
        />
      )}
    </View>
  );
}

const makeStyles = ({ colors, radii }: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: 16, gap: 12 },
    title: { width: 140, height: 28, borderRadius: radii.inset, backgroundColor: colors.material.inset.fill, marginBottom: 8 },
    pane: { borderRadius: radii.pane },
    still: { opacity: 0.7 },
    lines: { padding: 16, gap: 10 },
    line: { height: 12, borderRadius: 6, backgroundColor: colors.material.inset.fill },
    lineLong: { width: '62%' },
    lineShort: { width: '38%' },
  });
