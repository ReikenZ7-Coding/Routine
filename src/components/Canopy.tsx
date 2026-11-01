// Pine's canopy slab: the lit teal plane that carries each screen's header, like the header of a training hub.
// It runs flush under the status bar, bleeds to both edges and ends in a rounded foot with a thin mint rim, over
// an offset shadow on the night floor. Inside: faceted pines and far ridges anchored bottom right (the slab's own
// art), and a moon glow behind the top-right buttons that drifts on the look's light clock. It scrolls with the
// content (not sticky); once it has gone, the top edge fade in the slab's teal carries the status bar.
// Glass laid on the slab (round buttons, the segmented switch) becomes a trough in the slab's own colour.
import { type ReactNode, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { CANOPY_ART, LIGHTS } from './Art';
import { InsideGlass, OnCanopy } from './glass/Glass';
import { phase, pose, useFrame } from './glass/light';
import { clearOf } from './glass/colour';

const FOOT = 28;
/** The moon glow: a circle this wide, centred this far in from the slab's right edge and down from its top. */
const MOON = { size: 300, right: 70, top: 20 };

export function Canopy({
  bleed,
  style,
  children,
}: {
  /** The scroll content's padding above the slab, so the slab can start flush with the top of the screen. */
  bleed: number;
  /** Lays out the content inside the slab. */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const c = colors.material.canopy;
  const [height, setHeight] = useState(0);
  if (!c) return <View style={style}>{children}</View>;
  const artH = Math.min(height, c.maxArt);
  return (
    <View style={[styles.outer, { marginTop: -bleed, boxShadow: c.shadow }]}>
      <View
        style={[
          styles.shell,
          {
            borderBottomColor: c.rim,
            backgroundImage: `linear-gradient(180deg, ${c.gradient[0]} 0%, ${c.gradient[1]} 60%, ${c.gradient[2]} 100%)`,
          },
        ]}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setHeight((was) => (Math.abs(was - h) < 1 ? was : h));
        }}
      >
        {CANOPY_ART && artH > 0 ? (
          <Image
            source={CANOPY_ART.source}
            resizeMode="stretch"
            fadeDuration={0}
            accessibilityIgnoresInvertColors
            style={[styles.art, { height: artH, width: Math.round(artH / CANOPY_ART.ratio), opacity: c.art }]}
          />
        ) : null}
        <Moon color={c.moon} />
        <View style={[{ paddingTop: insets.top + 20 }, styles.content, style]}>
          <InsideGlass.Provider value>
            <OnCanopy.Provider value>{children}</OnCanopy.Provider>
          </InsideGlass.Provider>
        </View>
      </View>
    </View>
  );
}

/** The moon's glow behind the top-right buttons, drifting with the look's moon light on the frame's clock. */
function Moon({ color }: { color: string }) {
  const { name } = useTheme();
  const frame = useFrame();
  const motion = LIGHTS[name][0]?.motion;
  const { w, t, still } = frame;
  const style = useAnimatedStyle(() => {
    if (!motion) return {};
    const k = pose(motion, phase(t.get(), still.get(), motion.period), w);
    return { transform: [{ translateX: k.tx }, { translateY: k.ty }, { scale: k.sc }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.moon, { backgroundImage: `radial-gradient(50% 50% at 50% 50%, ${color} 0%, ${clearOf(color)} 70%)` }, style]}
    />
  );
}

const styles = StyleSheet.create({
  outer: { marginHorizontal: -16, borderBottomLeftRadius: FOOT, borderBottomRightRadius: FOOT, marginBottom: 20 },
  shell: {
    overflow: 'hidden',
    borderBottomLeftRadius: FOOT,
    borderBottomRightRadius: FOOT,
    borderBottomWidth: 1,
  },
  art: { position: 'absolute', right: 0, bottom: 0 },
  moon: {
    position: 'absolute',
    width: MOON.size,
    height: MOON.size,
    right: MOON.right - MOON.size / 2,
    top: MOON.top - MOON.size / 2,
  },
  content: { paddingHorizontal: 16, paddingBottom: 20 },
});
