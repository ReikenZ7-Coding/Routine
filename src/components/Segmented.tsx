// Choosing controls shared by every look: a segmented switch with a gliding drop (the Library's shelves, the
// focus sounds, the daily target) and a captioned row of filter chips (the Library's When and Repeat, Language's
// "Learning").
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Glass, GlassScroll, useGlassScroll } from './Glass';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { type Theme, useStyles, useTheme } from '../theme';
import { alphaOf } from './glass/colour';
import { EASE_OUT, FADE, FadeSwap, Micro, Press, SelectFade, useReduceMotion } from './Motion';

function tick() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  icon?: string;
  count?: number;
}

const SLIDE = { duration: 220, easing: EASE_OUT };
const BLINK = { duration: 120, easing: EASE_OUT, ...FADE };

/**
 * Two to four choices in a glass trough. A childless drop slides to the chosen one (220ms ease-out) while the
 * labels crossfade to the selected ink; under reduced motion the drop fades out and back in at its new place.
 * Inside glass the trough is an inset; on the bare world it is its own control glass.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  stacked,
  dense,
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (k: K) => void;
  /** Names the group for screen readers, e.g. "Daily target". */
  accessibilityLabel?: string;
  /** Icon above the label in a taller, rounder-cornered trough (the sound picker). */
  stacked?: boolean;
  /** The desktop's 36 dp segments in a 40 dp trough, to sit in a row of 40 dp buttons. */
  dense?: boolean;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const shown = useSharedValue(1);
  const placed = useRef(false);
  const reduced = useReduceMotion();
  // A value that matches no option (the player while one of your songs plays) fades the drop out.
  const found = options.findIndex((o) => o.key === value);
  const index = Math.max(0, found);
  const slot = width ? width / options.length : 0;
  useEffect(() => {
    if (!slot) return;
    const to = index * slot;
    if (found < 0) {
      // Hidden from the first draw if nothing is chosen yet; faded out if something was.
      shown.set(placed.current ? withTiming(0, BLINK) : 0);
      placed.current = true;
    } else if (!placed.current) {
      placed.current = true;
      x.set(to);
      shown.set(1);
    } else if (shown.get() < 1) {
      x.set(to);
      shown.set(withTiming(1, BLINK));
    } else if (reduced) {
      shown.set(
        withTiming(0, BLINK, (done) => {
          'worklet';
          if (!done) return;
          x.set(to);
          shown.set(withTiming(1, BLINK));
        }),
      );
    } else {
      x.set(withTiming(to, SLIDE));
    }
  }, [index, found, slot, reduced, x, shown]);
  const drop = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: x.get() }] }));
  return (
    <Glass tier="control" radius={stacked ? radii.control : radii.pill} style={[styles.trough, dense && styles.denseTrough]}>
      <View
        style={[styles.segments, stacked && styles.stackedSegments, dense && styles.denseSegments]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
      >
        {slot > 0 && (
          <Animated.View
            style={[styles.drop, { width: slot }, stacked && { borderRadius: Math.max(0, radii.control - 4) }, drop]}
            pointerEvents="none"
          />
        )}
        {options.map((o) => {
          const active = o.key === value;
          const content = (color: string, countColor: string) => (
            <View style={[styles.segmentInner, stacked && styles.stackedInner]}>
              {o.icon ? <Ionicons name={o.icon as 'sunny'} size={stacked ? 20 : 16} color={color} /> : null}
              <Text style={[styles.segmentText, stacked && styles.stackedText, { color }]} numberOfLines={stacked ? 2 : 1}>
                {o.label}
              </Text>
              {o.count !== undefined && <Text style={[styles.segmentCount, { color: countColor }]}>{o.count}</Text>}
            </View>
          );
          return (
            <Press
              key={o.key}
              outerStyle={styles.flex}
              style={[styles.segment, stacked && styles.stackedSegment, dense && styles.denseSegments]}
              onPress={() => {
                if (active) return;
                tick();
                onChange(o.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.label}${o.count !== undefined ? `, ${o.count}` : ''}`}
            >
              <FadeSwap
                on={active}
                style={styles.swap}
                duration={220}
                off={content(colors.muted, colors.muted)}
                onContent={content(colors.onPrimary, colors.onPrimary)}
              />
            </Press>
          );
        })}
      </View>
    </Glass>
  );
}

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  icon?: string;
}

/** A captioned row of chips that scrolls sideways; the chosen chip fills with the accent (a 150ms fade). The row
 *  rests with a chip's start at the left edge, and a chip running off the right edge fades out as it goes, so
 *  the edge reads as "more this way" rather than a word cut in half. */
export function FilterRow<K extends string>({
  caption,
  options,
  value,
  onChange,
}: {
  caption: string;
  options: FilterOption<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const [starts, setStarts] = useState<number[]>([]);
  const place = (i: number) => (e: LayoutChangeEvent) => {
    const x = Math.round(e.nativeEvent.layout.x);
    setStarts((s) => (s[i] === x ? s : Object.assign([...s], { [i]: x })));
  };
  return (
    <View style={styles.filter}>
      <Micro>{caption}</Micro>
      <GlassScroll
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
        snapToOffsets={starts.filter((x) => x !== undefined).map((x) => Math.max(0, x - CHIP_INSET))}
        snapToEnd
        decelerationRate="fast"
      >
        {options.map((o, i) => (
          <FilterChip
            key={o.key}
            option={o}
            active={o.key === value}
            caption={caption}
            viewport={width}
            onLayout={place(i)}
            onPress={() => {
              if (o.key === value) return;
              tick();
              onChange(o.key);
            }}
          />
        ))}
      </GlassScroll>
    </View>
  );
}

const CHIP_INSET = 16;

function FilterChip<K extends string>({
  option: o,
  active,
  caption,
  viewport,
  onLayout,
  onPress,
}: {
  option: FilterOption<K>;
  active: boolean;
  caption: string;
  viewport: number;
  onLayout: (e: LayoutChangeEvent) => void;
  onPress: () => void;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const { scrollX } = useGlassScroll();
  const box = useSharedValue({ x: 0, w: 0 });
  // How far the chip's right edge runs past the screen's: none keeps it whole, most of it fades it to a hint.
  const edge = useAnimatedStyle(() => {
    const { x, w } = box.get();
    if (!w) return { opacity: 1 };
    const over = x + w - scrollX.get() - viewport;
    return { opacity: interpolate(over, [0, w * 0.75], [1, 0.2], Extrapolation.CLAMP) };
  });
  const content = (color: string) => (
    <View style={styles.chipInner}>
      {o.icon ? <Ionicons name={o.icon as 'sunny'} size={14} color={color} /> : null}
      <Text style={[styles.chipText, { color }]}>{o.label}</Text>
    </View>
  );
  return (
    <Animated.View
      style={edge}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        box.set({ x, w: width });
        onLayout(e);
      }}
    >
      <Press
        style={styles.chip}
        overlay={colors.material.pressFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${caption}: ${o.label}`}
      >
        <SelectFade on={active} radius={radii.pill} bleed={1} style={styles.chosen} />
        <FadeSwap on={active} off={content(colors.text)} onContent={content(colors.onPrimary)} />
      </Press>
    </Animated.View>
  );
}

const makeStyles = ({ colors, fonts }: Theme) => {
  const outline = colors.material.outlineChips;
  return StyleSheet.create({
    flex: { flex: 1 },
    trough: { padding: 4 },
    segments: { flexDirection: 'row', minHeight: 44 },
    drop: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: 999,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      borderWidth: 1,
      borderColor: colors.material.drop.rimSide,
      borderTopColor: colors.material.drop.rim,
      boxShadow: colors.material.control.shadow,
    },
    segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
    segmentInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
    stackedSegments: { minHeight: 56 },
    denseTrough: { padding: 2 },
    denseSegments: { minHeight: 36 },
    stackedSegment: { minHeight: 56, borderRadius: 18 },
    // Stacked labels keep to their own segment: as wide as it, less 8 each side, and wrap to a second line on a
    // narrow phone instead of running into the next label.
    stackedInner: { flexDirection: 'column', gap: 4, alignSelf: 'stretch', paddingHorizontal: 8 },
    stackedText: { textAlign: 'center', lineHeight: 18 },
    swap: { alignSelf: 'stretch' },
    segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14, flexShrink: 1 },
    segmentCount: { fontFamily: fonts.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
    filter: { gap: 6 },
    chipScroll: { marginHorizontal: -16 },
    chips: { flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 24 },
    chip: outline
      ? {
          // Pine: the same chip in its own colours, a mint edge on a dark fill
          minHeight: 44,
          paddingHorizontal: 14,
          justifyContent: 'center',
          borderRadius: 999,
          backgroundColor: alphaOf(colors.bg, 0.5),
          borderWidth: 1,
          borderColor: alphaOf(colors.accent, 0.5),
        }
      : {
          minHeight: 44,
          paddingHorizontal: 14,
          justifyContent: 'center',
          borderRadius: 999,
          backgroundColor: colors.material.inset.fill,
          borderWidth: 1,
          borderColor: colors.material.inset.border,
          borderTopColor: colors.material.inset.borderTop,
        },
    chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chosen: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  });
};
