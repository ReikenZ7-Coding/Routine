// The hub pieces for the page looks' Library: a segmented switch with a gliding pill, filter chips
// under small captions, section headers with the kind's icon, and the routine cards in the grid.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Glass, GlassScroll, useGlassScroll } from './Glass';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  type Routine,
  countOn,
  isDoneOn,
  isScheduled,
  isSkipped,
  iconFor,
  routineSubtitle,
  streak,
  tapRoutine,
  TIME_LABELS,
} from '../lib/routines';
import { describeRepeat } from '../lib/schedule';
import { type Theme, useStyles, useTheme } from '../theme';
import { alphaOf } from './glass/colour';
import { EASE_OUT, FADE, FadeSwap, Micro, Pop, Press, SelectFade, useReduceMotion } from './Motion';

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
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (k: K) => void;
  /** Names the group for screen readers, e.g. "Daily target". */
  accessibilityLabel?: string;
  /** Icon above the label in a taller, rounder-cornered trough (the sound picker). */
  stacked?: boolean;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const shown = useSharedValue(1);
  const placed = useRef(false);
  const reduced = useReduceMotion();
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const slot = width ? width / options.length : 0;
  useEffect(() => {
    if (!slot) return;
    const to = index * slot;
    if (!placed.current) {
      placed.current = true;
      x.set(to);
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
  }, [index, slot, reduced, x, shown]);
  const drop = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: x.get() }] }));
  return (
    <Glass tier="control" radius={stacked ? radii.control : radii.pill} style={styles.trough}>
      <View
        style={[styles.segments, stacked && styles.stackedSegments]}
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
              <Text style={[styles.segmentText, { color }]} numberOfLines={1}>
                {o.label}
              </Text>
              {o.count !== undefined && <Text style={[styles.segmentCount, { color: countColor }]}>{o.count}</Text>}
            </View>
          );
          return (
            <Press
              key={o.key}
              outerStyle={styles.flex}
              style={[styles.segment, stacked && styles.stackedSegment]}
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

/** A section header: the kind's icon, the title and a count badge. */
export function HubHeader({
  icon,
  title,
  count,
  color,
  right,
}: {
  icon: string;
  title: string;
  count?: number;
  color: string;
  right?: ReactNode;
}) {
  const { type, colors, name } = useTheme();
  const styles = useStyles(makeStyles);
  // Paper keeps its section marks in ink on a glass pebble, and a header that already says "1/4 done" needs no
  // second count beside it.
  const paper = name === 'paper';
  return (
    <View style={styles.hubHead}>
      <View style={[styles.hubIcon, paper ? styles.hubPebble : { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as 'sunny'} size={paper ? 15 : 14} color={paper ? colors.text : color} />
      </View>
      <Text style={[type.sectionTitle, styles.flex]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {right}
      {count !== undefined && !(paper && right) && (
        <View style={styles.count}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

/** A routine in the grid: its time-of-day badge, name, schedule, a streak pill and a tick for today. */
export function RoutineCard({
  routine: r,
  today,
  width,
  onChange,
  onOpen,
}: {
  routine: Routine;
  today: string;
  width: number;
  onChange?: (r: Routine) => void;
  onOpen: () => void;
}) {
  const { colors, kinds, name } = useTheme();
  const styles = useStyles(makeStyles);
  // Paper ticks in ink (its done colour), like every other done mark on the page. Pine's cards carry a moon orb in
  // their top-right corner, as on the training hub they are modelled on.
  const paper = name === 'paper';
  const orb = !!colors.material.orb;
  const done = isDoneOn(r, today);
  const skipped = isSkipped(r, today);
  const counter = !!r.target && r.target > 1;
  const n = streak(r, today);
  const scheduled = isScheduled(r, today);
  const canTick = !!onChange && scheduled && !skipped;
  const count = counter ? countOn(r, today) : 0;
  const tickLabel =
    counter && !done ? `Add one to ${r.name}, ${count} of ${r.target}` : done ? `${r.name} done, tap to undo` : `Mark ${r.name} done`;
  return (
    <Glass
      style={[styles.card, { width }]}
      receded={done || skipped}
      onPress={onOpen}
      accessibilityLabel={`${r.name}, ${routineSubtitle(r, today)}`}
      accessibilityHint="Opens the editor"
    >
      {orb && <View style={styles.orb} pointerEvents="none" />}
      <View style={styles.watermark} pointerEvents="none">
        <Ionicons name={iconFor(r) as 'sunny'} size={96} color={colors.text} />
      </View>
      <View style={styles.cardTop}>
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{TIME_LABELS[r.time]}</Text>
        </View>
        {canTick && (
          <Press
            onPress={() => {
              tick();
              onChange!(tapRoutine(r, today));
            }}
            outerStyle={styles.tickSpot}
            style={styles.tick}
            overlay={colors.material.pressFill}
            accessibilityRole={counter ? 'button' : 'checkbox'}
            accessibilityState={counter ? undefined : { checked: done }}
            accessibilityLabel={tickLabel}
          >
            <SelectFade
              on={done}
              color={paper ? undefined : kinds.routines.color}
              radius={22}
              bleed={2}
              style={paper ? styles.tickDone : undefined}
            />
            <Pop done={done}>
              <FadeSwap
                on={done}
                off={counter && count > 0 ? <Text style={styles.tickCount}>{count}</Text> : null}
                onContent={<Ionicons name="checkmark" size={18} color={paper ? colors.onDone : colors.onKind} />}
              />
            </Pop>
          </Press>
        )}
      </View>
      <Text style={[styles.cardTitle, done && styles.cardTitleDone]} numberOfLines={2}>
        {r.name}
      </Text>
      <Text style={styles.cardSub} numberOfLines={2}>
        {r.start ? `${r.start} · ` : ''}
        {describeRepeat(r.repeat)}
        {counter ? ` · ${r.target} a day` : ''}
      </Text>
      <View style={styles.cardBottom}>
        <View style={[styles.level, n > 1 ? styles.levelHot : null]}>
          <Text style={[styles.levelText, n > 1 ? styles.levelTextHot : null]}>
            {skipped ? 'Skipped' : n > 1 ? `${n} in a row` : scheduled ? 'Today' : 'Resting'}
          </Text>
        </View>
        <View style={styles.meta}>
          {r.duration ? (
            <>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <Text style={styles.metaText}>{r.duration} min</Text>
            </>
          ) : r.reminder ? (
            <>
              <Ionicons name="notifications-outline" size={14} color={colors.muted} />
              <Text style={styles.metaText}>
                {String(r.reminder.hour).padStart(2, '0')}:{String(r.reminder.minute).padStart(2, '0')}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Glass>
  );
}

const makeStyles = ({ colors, fonts, type, dark }: Theme) => {
  const tag = colors.material.tag;
  const orb = colors.material.orb;
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
    stackedSegment: { minHeight: 56, borderRadius: 18 },
    stackedInner: { flexDirection: 'column', gap: 4 },
    segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
    segmentCount: { fontFamily: fonts.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
    filter: { gap: 6 },
    chipScroll: { marginHorizontal: -16 },
    chips: { flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 24 },
    chip: tag
      ? {
          // Pine: outlined chips on the night floor, a mint edge on a dark fill, as on the training hub
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
    hubHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 28, marginBottom: 12 },
    hubIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    hubPebble: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    tickDone: { backgroundImage: `linear-gradient(180deg, ${colors.doneFill[0]}, ${colors.doneFill[1]})` },
    count: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
    },
    countText: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
    card: { padding: 14, minHeight: 182 },
    orb: orb
      ? {
          position: 'absolute',
          top: -34,
          right: -34,
          width: 124,
          height: 124,
          borderRadius: 62,
          backgroundColor: orb.fill,
          borderWidth: 1,
          borderColor: orb.rim,
        }
      : {},
    watermark: { position: 'absolute', right: -22, bottom: -26, opacity: dark ? 0.06 : 0.05, transform: [{ rotate: '-12deg' }] },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
    cardBadge: tag
      ? { backgroundColor: tag.fill, borderRadius: 999, paddingHorizontal: 9, minHeight: 22, justifyContent: 'center' }
      : {
          backgroundColor: colors.material.inset.fill,
          borderWidth: 1,
          borderColor: colors.material.inset.border,
          borderRadius: 999,
          paddingHorizontal: 9,
          minHeight: 22,
          justifyContent: 'center',
        },
    cardBadgeText: tag ? { ...type.badge, fontSize: 10.5, letterSpacing: 1.4, color: tag.ink } : { ...type.badge, color: colors.muted },
    tickSpot: { marginTop: -8, marginRight: -6 },
    tick: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      borderColor: colors.controlBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tickCount: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
    cardTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: tag ? 18 : 17,
      lineHeight: tag ? 23 : 22,
      color: colors.text,
      letterSpacing: tag ? -0.3 : -0.2,
    },
    cardTitleDone: { color: colors.faint, textDecorationLine: 'line-through' },
    cardSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 4, flexGrow: 1 },
    cardBottom: { marginTop: 12, gap: 8 },
    level: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 9,
      minHeight: 22,
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      ...(tag ? { borderWidth: 1, borderColor: alphaOf(colors.accent, 0.5) } : null),
    },
    levelHot: {
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      ...(tag ? { borderColor: colors.primaryGradient[0] } : null),
    },
    levelText: { ...type.badge, color: colors.text },
    levelTextHot: { color: colors.onPrimary },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 19 },
    metaText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  });
};
