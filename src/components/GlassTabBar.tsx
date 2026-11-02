import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useStyles, useTheme, type Theme } from '../theme';
import { Glass } from './Glass';
import { BAR } from './glass/chrome';
import { EASE_OUT, FADE, FadeSwap, Press, useReduceMotion } from './Motion';

/** Space between the bar's edge and the drop. */
const PAD = 6;
/** The bar's corner radius; the drop's corners sit concentric inside it. */
const RADIUS = BAR.radius;

// The drop's leading edge springs ahead and the trailing edge catches up, so it stretches and settles.
const LEAD = { stiffness: 320, damping: 26, mass: 0.8 };
const TRAIL = { stiffness: 150, damping: 20, mass: 1 };
const BLINK = { duration: 120, easing: EASE_OUT, ...FADE };

/**
 * The glass tab bar (chrome: a live blur of the screen's world; it never squeezes). A childless glass drop sits
 * under the current tab and flows to the next one on the UI thread; when the trailing edge settles, the drop's
 * rim catches the light once. Under reduced motion the drop fades out and back in at its new place.
 * The same bar in every look: it floats above the bottom edge with a slot-wide drop under the current tab, and
 * only its colours and glass come from the look.
 */
export function GlassTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  bottom,
  height,
}: BottomTabBarProps & { bottom: number; height: number }) {
  const { colors } = useTheme();
  const m = colors.material;
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(0);
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const shown = useSharedValue(1);
  const flash = useSharedValue(0);
  const placed = useRef(false);
  const lastIndex = useRef(state.index);
  const slot = width ? width / state.routes.length : 0;
  // A narrow phone (about 320dp) leaves each tab under 60dp: the labels tighten to 12px and lose their side air,
  // so "Language" still fits whole beside "Library".
  const narrow = slot > 0 && slot < 60;

  useEffect(() => {
    if (!slot) return;
    const l = state.index * slot;
    const r = (state.index + 1) * slot;
    if (!placed.current) {
      placed.current = true;
      left.set(l);
      right.set(r);
    } else if (reduced) {
      shown.set(
        withTiming(0, BLINK, (done) => {
          'worklet';
          if (!done) return;
          left.set(l);
          right.set(r);
          shown.set(withTiming(1, BLINK));
        }),
      );
    } else if (state.index !== lastIndex.current) {
      const forward = state.index > lastIndex.current;
      const settle = (done?: boolean) => {
        'worklet';
        if (done) {
          flash.set(
            withSequence(
              withTiming(0.6, { duration: 100, easing: EASE_OUT, ...FADE }),
              withTiming(0, { duration: 220, easing: EASE_OUT, ...FADE }),
            ),
          );
        }
      };
      right.set(withSpring(r, forward ? LEAD : TRAIL, forward ? undefined : settle));
      left.set(withSpring(l, forward ? TRAIL : LEAD, forward ? settle : undefined));
    } else {
      // Same tab, new size (rotation): move without a show.
      left.set(l);
      right.set(r);
    }
    lastIndex.current = state.index;
  }, [state.index, slot, reduced, left, right, shown, flash]);

  const drop = useAnimatedStyle(() => ({ left: left.get(), width: right.get() - left.get(), opacity: shown.get() }));
  const glint = useAnimatedStyle(() => ({ left: left.get(), width: right.get() - left.get(), opacity: flash.get() }));
  const dropGeometry = styles.slotDrop;

  return (
    <View style={[styles.wrap, { bottom, height }]}>
      <Glass tier="chrome" radius={RADIUS} tint={colors.material.chromeTint} style={StyleSheet.absoluteFill}>
        <View style={styles.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
          {slot > 0 && (
            <>
              <Animated.View pointerEvents="none" style={[dropGeometry, styles.drop, drop]} />
              <Animated.View pointerEvents="none" style={[dropGeometry, styles.glint, glint]} />
            </>
          )}
          {state.routes.map((route, i) => {
            const { options } = descriptors[route.key];
            const focused = state.index === i;
            const label = typeof options.title === 'string' ? options.title : route.name;
            const onPress = () => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                navigateToTab(route.key);
              }
            };
            const item = (on: boolean) => (
              <View style={[styles.item, narrow && styles.itemNarrow]}>
                {options.tabBarIcon?.({ focused: on, color: on ? m.drop.ink : colors.muted, size: 24 })}
                <Text
                  style={[styles.label, narrow && styles.labelNarrow, on && styles.labelOn, { color: on ? m.drop.ink : colors.muted }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            );
            return (
              <Press
                key={route.key}
                outerStyle={styles.flex}
                style={styles.tab}
                onPress={onPress}
                onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
              >
                <FadeSwap on={focused} duration={180} off={item(false)} onContent={item(true)} style={styles.cell} />
              </Press>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

const makeStyles = ({ colors, fonts }: Theme) => {
  const d = colors.material.drop;
  return StyleSheet.create({
    flex: { flex: 1 },
    wrap: { position: 'absolute', left: BAR.inset, right: BAR.inset },
    track: { flex: 1, flexDirection: 'row', marginHorizontal: PAD, marginVertical: PAD },
    slotDrop: { position: 'absolute', top: 0, bottom: 0, borderRadius: RADIUS - PAD },
    drop: {
      backgroundImage: `linear-gradient(180deg, ${d.fill[0]}, ${d.fill[1]})`,
      borderWidth: 1,
      borderColor: d.rimSide,
      borderTopColor: d.rim,
      boxShadow: d.shadow,
    },
    glint: { borderWidth: 1, borderColor: colors.material.pressRim },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    // As wide as the cell, with a little air each side (the current tab's bolder label included): a label too long
    // for a narrow phone or a large font size shortens with an ellipsis instead of running into its neighbour.
    item: { alignSelf: 'stretch', alignItems: 'center', gap: 3, paddingHorizontal: 2 },
    itemNarrow: { paddingHorizontal: 0 },
    cell: { alignSelf: 'stretch' },
    // 13, the caption floor; the current tab's label is set in the look's bold (Stone's bold is DM Sans 500).
    label: { fontFamily: fonts.bodyMedium, fontSize: 13 },
    labelOn: { fontFamily: fonts.bodyBold },
    labelNarrow: { fontSize: 12, letterSpacing: -0.2 },
  });
};
