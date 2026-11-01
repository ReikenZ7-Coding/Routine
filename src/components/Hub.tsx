// The hub pieces for the page looks' Library: a segmented switch with a gliding pill, filter chips
// under small uppercase captions, section headers with an accent bar, and the routine cards in the grid.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
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
import { Micro, Press } from './Motion';

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

function tick() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

export interface SegmentOption<K extends string> {
  key: K;
  label: string;
  icon: string;
  count?: number;
}

/** Two or three choices in a trough; the filled pill glides to the chosen one. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (k: K) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const reduced = useReducedMotion();
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const slot = width ? (width - 8) / options.length : 0;
  useEffect(() => {
    if (!slot) return;
    const to = 4 + index * slot;
    x.set(reduced || x.get() === 0 ? to : withTiming(to, { duration: 260, easing: EASE_IN_OUT }));
  }, [index, slot, reduced, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View style={styles.trough} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {slot > 0 && <Animated.View style={[styles.pill, { width: slot }, pill]} pointerEvents="none" />}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Press
            key={o.key}
            outerStyle={styles.flex}
            style={styles.segment}
            onPress={() => {
              if (active) return;
              tick();
              onChange(o.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label}${o.count !== undefined ? `, ${o.count}` : ''}`}
          >
            <Ionicons name={o.icon as 'sunny'} size={16} color={active ? colors.onSelected : colors.muted} />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
            {o.count !== undefined && <Text style={[styles.segmentCount, active && styles.segmentTextActive]}>{o.count}</Text>}
          </Press>
        );
      })}
    </View>
  );
}

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  icon?: string;
}

/** A captioned row of chips that scrolls sideways; the chosen chip fills with the accent. */
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
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.filter}>
      <Micro>{caption}</Micro>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Press
              key={o.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                tick();
                onChange(o.key);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${caption}: ${o.label}`}
            >
              {o.icon ? <Ionicons name={o.icon as 'sunny'} size={14} color={active ? colors.onSelected : colors.muted} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Press>
          );
        })}
      </ScrollView>
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
              <Ionicons name="checkmark" size={16} color={dark ? colors.onSelected : '#FFFFFF'} />
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
    trough: {
      flexDirection: 'row',
      backgroundColor: dark ? 'rgba(6,27,23,0.6)' : colors.chip,
      borderRadius: 999,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      minHeight: 52,
    },
    pill: {
      position: 'absolute',
      top: 4,
      bottom: 4,
      left: 0,
      borderRadius: 999,
      backgroundColor: colors.selected,
      boxShadow: dark ? '0px 4px 14px rgba(94,208,168,0.35)' : '0px 3px 10px rgba(20,22,18,0.18)',
    },
    segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
    segmentText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    segmentTextActive: { color: colors.onSelected },
    segmentCount: { fontFamily: fonts.monoMedium, fontSize: 12, color: colors.faint },
    filter: { gap: 6 },
    chipScroll: { marginHorizontal: -16 },
    chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    chipActive: { backgroundColor: colors.selected, borderColor: colors.selected },
    chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    chipTextActive: { color: colors.onSelected },
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
