import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { clearOf } from './glass/colour';
import { useStyles, useTheme, type Theme } from '../theme';
import { Glass } from './Glass';
import type { BarVariant } from './glass/chrome';
import { EASE_OUT, FADE, FadeSwap, Press, useReduceMotion } from './Motion';

/** Space between the bar's edge and the drop. */
const PAD = 6;
/** The capsule behind the current icon in the dock. */
const CAPSULE = { w: 56, h: 32, top: 6 };
/** The float bar's corner radius; the drop's corners sit concentric inside it. */
const FLOAT_RADIUS = 30;

// The drop's leading edge springs ahead and the trailing edge catches up, so it stretches and settles.
const LEAD = { stiffness: 320, damping: 26, mass: 0.8 };
const TRAIL = { stiffness: 150, damping: 20, mass: 1 };
const BLINK = { duration: 120, easing: EASE_OUT, ...FADE };

/**
 * The glass tab bar (chrome: a live blur of the screen's world; it never squeezes). A childless glass drop sits
 * under the current tab and flows to the next one on the UI thread; when the trailing edge settles, the drop's
 * rim catches the light once. Under reduced motion the drop fades out and back in at its new place.
 * 'float' (Lavender, Stone) and 'floatInk' (Paper) float above the bottom edge with a slot-wide drop; 'dock'
 * (Pine) spans the bottom edge with a capsule behind the icon.
 */
export function GlassTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  variant,
  bottom,
  height,
}: BottomTabBarProps & { variant: BarVariant; bottom: number; height: number }) {
  const dock = variant === 'dock';
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

  useEffect(() => {
    if (!slot) return;
    const l = dock ? state.index * slot + (slot - CAPSULE.w) / 2 : state.index * slot;
    const r = dock ? l + CAPSULE.w : (state.index + 1) * slot;
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
  }, [state.index, slot, dock, reduced, left, right, shown, flash]);

  const drop = useAnimatedStyle(() => ({ left: left.get(), width: right.get() - left.get(), opacity: shown.get() }));
  const glint = useAnimatedStyle(() => ({ left: left.get(), width: right.get() - left.get(), opacity: flash.get() }));
  const dropGeometry = dock ? styles.capsule : styles.slotDrop;

  return (
    <View style={[dock ? styles.dock : styles.wrap, { bottom, height }]}>
      <Glass
        tier="chrome"
        radius={dock ? 0 : FLOAT_RADIUS}
        topOnly={dock}
        tint={colors.material.chromeTint}
        style={StyleSheet.absoluteFill}
      >
        {dock && <View pointerEvents="none" style={[styles.edgeLight, { backgroundImage: edgeLight(m.drop.rim) }]} />}
        <View
          style={[styles.track, dock ? styles.dockTrack : styles.floatTrack]}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="tablist"
        >
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
              <View style={styles.item}>
                {options.tabBarIcon?.({ focused: on, color: on ? m.drop.ink : colors.muted, size: 24 })}
                <Text style={[styles.label, { color: on ? m.drop.ink : colors.muted }]} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            );
            return (
              <Press
                key={route.key}
                outerStyle={styles.flex}
                style={[styles.tab, dock && styles.dockTab]}
                onPress={onPress}
                onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
              >
                <FadeSwap on={focused} duration={180} off={item(false)} onContent={item(true)} />
              </Press>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

/** A 1px line of edge light along the dock's top, brightest in the middle. */
const edgeLight = (c: string) => `linear-gradient(90deg, ${clearOf(c)}, ${c}, ${clearOf(c)})`;

const makeStyles = ({ colors, fonts }: Theme) => {
  const d = colors.material.drop;
  return StyleSheet.create({
    flex: { flex: 1 },
    wrap: { position: 'absolute', left: 16, right: 16 },
    dock: { position: 'absolute', left: 0, right: 0 },
    edgeLight: { position: 'absolute', top: 0, left: 24, right: 24, height: 1 },
    track: { flexDirection: 'row', marginHorizontal: PAD },
    floatTrack: { flex: 1, marginVertical: PAD },
    dockTrack: { height: 64 },
    slotDrop: { position: 'absolute', top: 0, bottom: 0, borderRadius: FLOAT_RADIUS - PAD },
    capsule: { position: 'absolute', top: CAPSULE.top, height: CAPSULE.h, borderRadius: CAPSULE.h / 2 },
    drop: {
      backgroundImage: `linear-gradient(180deg, ${d.fill[0]}, ${d.fill[1]})`,
      borderWidth: 1,
      borderColor: d.rimSide,
      borderTopColor: d.rim,
      boxShadow: d.shadow,
    },
    glint: { borderWidth: 1, borderColor: colors.material.pressRim },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
    dockTab: { justifyContent: 'flex-start', paddingTop: 10 },
    item: { alignItems: 'center', gap: 3 },
    label: { fontFamily: fonts.bodyMedium, fontSize: 12 },
  });
};
