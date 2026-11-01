// The hub pieces for the page looks' Library: a segmented switch with a gliding pill, filter chips
// under small uppercase captions, section headers with an accent bar, and the routine cards in the grid.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Glass, GlassScroll } from './Glass';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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

/** A captioned row of chips that scrolls sideways; the chosen chip fills with the accent (a 150ms fade). The
 *  row ends in a 24px clear margin so the last chip never stops mid-word at the edge. */
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
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.filter}>
      <Micro>{caption}</Micro>
      <GlassScroll horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {options.map((o) => {
          const active = o.key === value;
          const content = (color: string) => (
            <View style={styles.chipInner}>
              {o.icon ? <Ionicons name={o.icon as 'sunny'} size={14} color={color} /> : null}
              <Text style={[styles.chipText, { color }]}>{o.label}</Text>
            </View>
          );
          return (
            <Press
              key={o.key}
              style={styles.chip}
              overlay={colors.material.pressFill}
              onPress={() => {
                if (active) return;
                tick();
                onChange(o.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${caption}: ${o.label}`}
            >
              <SelectFade on={active} radius={radii.pill} bleed={1} style={styles.chosen} />
              <FadeSwap on={active} off={content(colors.text)} onContent={content(colors.onPrimary)} />
            </Press>
          );
        })}
      </GlassScroll>
    </View>
  );
}

/** A section header with an accent bar, an icon, the title and a count badge. */
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
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.hubHead}>
      <View style={[styles.hubBar, { backgroundColor: color }]} />
      <View style={[styles.hubIcon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as 'sunny'} size={14} color={color} />
      </View>
      <Text style={[type.sectionTitle, styles.flex]} numberOfLines={1}>
        {title}
      </Text>
      {right}
      {count !== undefined && (
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
  const { colors, kinds, dark } = useTheme();
  const styles = useStyles(makeStyles);
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
    <Press
      style={[styles.card, { width }]}
      onPress={onOpen}
      accessibilityLabel={`${r.name}, ${routineSubtitle(r, today)}. Opens the editor`}
    >
      <LinearGradient
        colors={dark ? ['#15463C', '#0E2F28'] : ['#FFFFFF', '#F6F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
            style={[styles.tick, done && { backgroundColor: kinds.routines.color, borderColor: kinds.routines.color }]}
            hitSlop={6}
            accessibilityRole={counter ? 'button' : 'checkbox'}
            accessibilityState={counter ? undefined : { checked: done }}
            accessibilityLabel={tickLabel}
          >
            {done ? (
              <Ionicons name="checkmark" size={16} color={colors.onKind} />
            ) : counter && count > 0 ? (
              <Text style={styles.tickCount}>{count}</Text>
            ) : null}
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
              <Ionicons name="time-outline" size={12} color={colors.muted} />
              <Text style={styles.metaText}>{r.duration} min</Text>
            </>
          ) : r.reminder ? (
            <>
              <Ionicons name="notifications-outline" size={12} color={colors.muted} />
              <Text style={styles.metaText}>
                {String(r.reminder.hour).padStart(2, '0')}:{String(r.reminder.minute).padStart(2, '0')}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </Press>
  );
}

const makeStyles = ({ colors, fonts, radius, dark }: Theme) =>
  StyleSheet.create({
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
    chips: { flexDirection: 'row', gap: 8, paddingLeft: 16, paddingRight: 40 },
    chip: {
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
    hubHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 12 },
    hubBar: { width: 3, height: 20, borderRadius: 2 },
    hubIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    count: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    countText: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.text },
    card: {
      borderRadius: radius,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      minHeight: 182,
      overflow: 'hidden',
      boxShadow: colors.shadow,
      backgroundColor: colors.card,
    },
    watermark: { position: 'absolute', right: -22, bottom: -26, opacity: dark ? 0.06 : 0.05, transform: [{ rotate: '-12deg' }] },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
    cardBadge: {
      backgroundColor: dark ? 'rgba(6,27,23,0.7)' : colors.chip,
      borderRadius: 999,
      paddingHorizontal: 9,
      minHeight: 22,
      justifyContent: 'center',
    },
    cardBadgeText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
    tick: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -6,
      marginRight: -4,
    },
    tickCount: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.text },
    cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.text, letterSpacing: -0.2 },
    cardTitleDone: { color: colors.faint, textDecorationLine: 'line-through' },
    cardSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 4, flexGrow: 1 },
    cardBottom: { marginTop: 12, gap: 8 },
    level: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 9,
      minHeight: 22,
      justifyContent: 'center',
      backgroundColor: colors.chip,
    },
    levelHot: { backgroundColor: colors.selected },
    levelText: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.text },
    levelTextHot: { color: colors.onSelected },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 16 },
    metaText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  });
