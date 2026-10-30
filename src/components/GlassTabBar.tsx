import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStyles, useTheme, type Theme } from '../theme';
import { Glass } from './Glass';

const PAD = 6;

/**
 * Floating liquid-glass tab bar. A glass drop sits under the current tab and flows to the next one:
 * its leading edge springs ahead and the trailing edge catches up, so it stretches and settles.
 */
export function GlassTabBar({ state, descriptors, emitter, navigateToTab, bottom }: BottomTabBarProps & { bottom: number }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const left = useRef(new Animated.Value(0)).current;
  const right = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const lastIndex = useRef(state.index);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  const slot = width ? (width - PAD * 2) / state.routes.length : 0;

  useEffect(() => {
    if (!slot) return;
    const l = PAD + state.index * slot;
    const r = l + slot;
    if (!placed.current || reduceMotion) {
      left.setValue(l);
      right.setValue(r);
      placed.current = true;
    } else {
      const forward = state.index > lastIndex.current;
      const lead = {
        stiffness: 320,
        damping: 26,
        mass: 0.8,
        useNativeDriver: false,
      };
      const trail = {
        stiffness: 150,
        damping: 20,
        mass: 1,
        useNativeDriver: false,
      };
      Animated.parallel([
        Animated.spring(right, { toValue: r, ...(forward ? lead : trail) }),
        Animated.spring(left, { toValue: l, ...(forward ? trail : lead) }),
      ]).start();
    }
    lastIndex.current = state.index;
  }, [state.index, slot, left, right, reduceMotion]);

  return (
    <View style={[styles.wrap, { bottom }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Glass radius={28} intensity={70} tint={colors.tabBar} style={StyleSheet.absoluteFill}>
        {slot > 0 && (
          <Animated.View style={[styles.dropSlot, { left, width: Animated.subtract(right, left) }]} pointerEvents="none">
            <Glass radius={22} tint={colors.primarySoft} style={styles.drop} />
          </Animated.View>
        )}
        <View style={styles.row}>
          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key];
            const focused = state.index === i;
            const color = focused ? colors.text : colors.muted;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const onPress = () => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            };
            return (
              <Pressable
                key={route.key}
                style={styles.tab}
                onPress={onPress}
                onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
              >
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                <Text style={[styles.label, { color }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

const makeStyles = ({ fonts }: Theme) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 16, right: 16, height: 72 },
    dropSlot: {
      position: 'absolute',
      top: PAD,
      bottom: PAD,
      paddingHorizontal: 4,
    },
    drop: { flex: 1 },
    row: { flex: 1, flexDirection: 'row', paddingHorizontal: PAD },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
    label: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  });
