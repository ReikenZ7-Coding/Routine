// Today on the page looks (Paper, Pine): a greeting under misty mountains, a streak pill, the day's
// trail of routines winding past a dotted path, and the balance rings for routines, gym and Chinese.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { type Theme, useStyles, useTheme } from '../theme';
import { HeaderScene } from './Art';
import { Glass, LensHeaderContext, useGlassScroll } from './Glass';
import { Bar, Chevron, Collapse, Enter, FadeSwap, Pop, Press, Ring, SelectFade } from './Motion';
import { plural } from '../lib/plural';

export interface TrailItem {
  key: string;
  title: string;
  icon: string;
  meta: string;
  done: boolean;
  skipped?: boolean;
  /** The kind's colour: tints the icon and the finished check. */
  color: string;
  /** Opens another screen instead of ticking the row. */
  nav?: boolean;
  progress?: { value: number; total: number };
  onPress: () => void;
  onLongPress?: () => void;
}

export interface BalanceRing {
  label: string;
  value: number;
  total: number;
  unit: string;
  color: string;
  soft: string;
}

interface Props {
  name: string;
  greeting: string;
  dateLabel: string;
  isToday: boolean;
  streak: number;
  done: number;
  total: number;
  items: TrailItem[];
  /** The row that's up next: its node glows on the trail. */
  nextKey?: string;
  nextLabel?: string;
  balance: BalanceRing[];
  calendarOpen: boolean;
  onToggleCalendar: () => void;
  calendar: ReactNode;
  /** The scroll view's top padding, so the mountains can sit flush with the top of the screen. */
  topInset: number;
  soundsPlaying: boolean;
  onSounds: () => void;
  onStats: () => void;
  onSettings: () => void;
  onAdd: () => void;
}

const RAIL = 56;

export function TrailHome(p: Props) {
  const theme = useTheme();
  const { colors, type } = theme;
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const [balanceOpen, setBalanceOpen] = useState(true);
  const [rows, setRows] = useState<Record<string, number>>({});

  const heights = p.items.map((it) => rows[it.key] ?? 0);
  const centers: number[] = [];
  let y = 0;
  for (const h of heights) {
    centers.push(y + h / 2);
    y += h;
  }
  const railPath = useMemo(() => trail(centers), [centers.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  // The mountains sit at the top of the scroll content, flush with the top of the frame: glass over them
  // shows their blurred copy in its lens.
  const { scrollY } = useGlassScroll();
  const lensHeader = useMemo(() => ({ top: 0, scrollY, parallax: 0 }), [scrollY]);

  return (
    <LensHeaderContext.Provider value={lensHeader}>
      <View>
        <View style={[styles.scene, { top: -p.topInset, left: -16, width }]} pointerEvents="none">
          <HeaderScene width={width} />
        </View>

        <View style={styles.top}>
          <View style={styles.flex}>
            <Text style={styles.greet}>{p.greeting},</Text>
            <Text style={styles.hello} numberOfLines={1} accessibilityRole="header">
              {p.name}
            </Text>
            <Press
              onPress={p.onToggleCalendar}
              style={styles.dateRow}
              accessibilityLabel={p.calendarOpen ? 'Hide the calendar' : 'Pick a day'}
              accessibilityState={{ expanded: p.calendarOpen }}
              hitSlop={6}
            >
              <Text style={styles.date}>{p.dateLabel}</Text>
              <Chevron open={!p.calendarOpen} color={colors.muted} size={16} />
            </Press>
          </View>
          <View style={styles.topButtons}>
            <Round
              icon={p.soundsPlaying ? 'pause' : 'musical-notes-outline'}
              label="Focus sounds"
              onPress={p.onSounds}
              dot={p.soundsPlaying}
            />
            <Round icon="stats-chart-outline" label="Your week" onPress={p.onStats} />
            <Round icon="settings-outline" label="Settings" onPress={p.onSettings} />
          </View>
        </View>

        <Collapse open={p.calendarOpen}>
          <Glass style={styles.calendar}>{p.calendar}</Glass>
        </Collapse>

        <Glass tier="control" radius={999} style={styles.streak}>
          <Ionicons name={p.streak > 0 ? 'flame' : 'flame-outline'} size={16} color={p.streak > 0 ? colors.streak : colors.muted} />
          <Text style={styles.streakText}>
            {p.streak > 0 ? `${plural(p.streak, 'day')} streak` : 'Start a streak'}
            <Text style={styles.streakMuted}>{p.total > 0 ? `  ·  ${p.done}/${p.total} today` : ''}</Text>
          </Text>
        </Glass>

        <View style={styles.sectionHead}>
          <Text style={[type.sectionTitle, styles.flex]} accessibilityRole="header">
            {p.isToday ? "Today's trail" : `${p.dateLabel} trail`}
          </Text>
          <View style={styles.badge} accessible accessibilityLabel={`${p.done} of ${p.total} done`}>
            <Text style={styles.badgeText}>
              {p.done}/{p.total}
            </Text>
          </View>
        </View>

        {p.items.length === 0 ? (
          <Press onPress={p.onAdd} style={styles.empty} accessibilityLabel="Add a routine or a to-do">
            <View style={[styles.tile, { backgroundColor: colors.tile }]}>
              <Ionicons name="add" size={22} color={colors.text} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>A clear day</Text>
              <Text style={styles.rowMeta}>Add a routine or a to-do and it starts the trail.</Text>
            </View>
          </Press>
        ) : (
          <View style={styles.trail}>
            <View style={[styles.rail, { height: y }]} pointerEvents="none">
              {y > 0 && (
                <Svg width={RAIL} height={y}>
                  <Path
                    d={railPath}
                    stroke={colors.faint}
                    strokeWidth={2.5}
                    strokeDasharray="1 7"
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.7}
                  />
                </Svg>
              )}
            </View>
            {p.items.map((it, i) => (
              <TrailRow
                key={it.key}
                item={it}
                index={i}
                current={it.key === p.nextKey}
                currentLabel={p.nextLabel}
                onLayout={(h) => setRows((r) => (r[it.key] === h ? r : { ...r, [it.key]: h }))}
              />
            ))}
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={type.sectionTitle} accessibilityRole="header">
            Balance
          </Text>
        </View>
        <Glass>
          <View style={styles.balanceHead}>
            <Text style={styles.rowMeta}>{p.isToday ? 'How today is shaping up' : 'How that day went'}</Text>
            <Press
              onPress={() => setBalanceOpen((o) => !o)}
              style={styles.iconBtn}
              accessibilityLabel={balanceOpen ? 'Hide balance' : 'Show balance'}
              accessibilityState={{ expanded: balanceOpen }}
            >
              <Chevron open={balanceOpen} color={colors.text} />
            </Press>
          </View>
          <Collapse open={balanceOpen}>
            <View style={styles.rings}>
              {p.balance.map((b) => {
                const rest = b.total === 0;
                return (
                  <View
                    key={b.label}
                    style={styles.ringWrap}
                    accessible
                    accessibilityLabel={`${b.label}: ${b.value} of ${b.total} ${b.unit}`}
                  >
                    <Ring size={88} stroke={9} progress={rest ? 0 : b.value / b.total} color={b.color} track={b.soft}>
                      <Text style={[styles.ringValue, { color: rest ? colors.faint : b.color }]}>{rest ? '–' : b.value}</Text>
                      <Text style={styles.ringUnit}>{rest ? 'rest' : `of ${b.total}`}</Text>
                    </Ring>
                    <Text style={styles.ringLabel}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          </Collapse>
        </Glass>
      </View>
    </LensHeaderContext.Provider>
  );
}

function Round({ icon, label, onPress, dot }: { icon: string; label: string; onPress: () => void; dot?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Glass tier="control" radius={22} onPress={onPress} style={styles.round} accessibilityLabel={label}>
      <Ionicons name={icon as 'sunny'} size={19} color={colors.text} />
      {dot && <View style={styles.dot} />}
    </Glass>
  );
}

function TrailRow({
  item,
  index,
  current,
  currentLabel,
  onLayout,
}: {
  item: TrailItem;
  index: number;
  current: boolean;
  currentLabel?: string;
  onLayout: (height: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const press = () => {
    if (Platform.OS !== 'web' && !item.nav) Haptics.selectionAsync().catch(() => {});
    item.onPress();
  };
  const finished = item.done || item.skipped;
  const meta = item.skipped
    ? 'Skipped · streak kept'
    : item.done && !item.progress
      ? 'Completed'
      : current && currentLabel
        ? currentLabel
        : item.meta;
  return (
    <Enter index={index}>
      <View style={styles.row} onLayout={(e) => onLayout(Math.round(e.nativeEvent.layout.height))}>
        <View style={styles.nodeCol}>
          <Pop
            done={item.done}
            style={[
              styles.node,
              item.done && styles.nodeDone,
              current && !item.done && styles.nodeCurrent,
              item.skipped && styles.nodeSkipped,
            ]}
          >
            {item.done ? (
              <Ionicons name="checkmark" size={16} color={colors.onNode} />
            ) : current ? (
              <View style={styles.nodeDot} />
            ) : item.skipped ? (
              <Ionicons name="remove" size={12} color={colors.faint} />
            ) : null}
          </Pop>
        </View>
        <Glass
          onPress={press}
          onLongPress={item.onLongPress}
          receded={finished}
          style={[styles.flex, styles.rowCard]}
          accessibilityRole={item.nav ? 'button' : 'checkbox'}
          accessibilityState={item.nav ? undefined : { checked: item.done }}
          accessibilityLabel={`${item.title}, ${meta}`}
        >
          <View style={[styles.tile, { backgroundColor: colors.tile }]}>
            <Ionicons name={item.icon as 'sunny'} size={20} color={finished ? colors.faint : item.color} />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.rowTitle, finished && styles.rowTitleDone]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.progress && !finished ? (
              <View style={styles.progress}>
                <Bar progress={item.progress.value / Math.max(1, item.progress.total)} color={item.color} track={colors.tile} />
              </View>
            ) : null}
            <Text style={[styles.rowMeta, current && !finished && { color: colors.text }]} numberOfLines={2}>
              {meta}
            </Text>
          </View>
          {item.nav ? (
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          ) : (
            <Pop done={item.done} style={styles.check}>
              <SelectFade on={item.done} color={item.color} radius={13} bleed={2} />
              <FadeSwap on={item.done} off={null} onContent={<Ionicons name="checkmark" size={15} color={colors.onKind} />} />
            </Pop>
          )}
        </Glass>
      </View>
    </Enter>
  );
}

/** A dotted path that winds from node to node: it swings out between rows, like a footpath on a map. */
function trail(centers: number[]): string {
  if (centers.length < 2) return '';
  const x = RAIL / 2;
  let d = `M ${x} ${centers[0]}`;
  for (let i = 1; i < centers.length; i++) {
    const a = centers[i - 1];
    const b = centers[i];
    const swing = i % 2 ? 14 : -14;
    d += ` C ${x + swing} ${a + (b - a) * 0.35}, ${x + swing} ${a + (b - a) * 0.65}, ${x} ${b}`;
  }
  return d;
}

const makeStyles = ({ colors, fonts, type, radius }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scene: { position: 'absolute' },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
    greet: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 20, color: colors.muted },
    hello: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.6, marginTop: 1 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
    date: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted },
    topButtons: { flexDirection: 'row', gap: 8 },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    dot: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.streak,
    },
    calendar: { marginTop: 14, padding: 8 },
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingLeft: 12,
      paddingRight: 14,
      minHeight: 38,
      marginTop: 18,
    },
    streakText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    streakMuted: { fontFamily: fonts.body, color: colors.muted },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
    badge: { backgroundColor: colors.node, borderRadius: 999, paddingHorizontal: 10, minHeight: 26, justifyContent: 'center' },
    badgeText: { fontFamily: fonts.monoMedium, fontSize: 13, color: colors.onNode, fontVariant: ['tabular-nums'] },
    trail: { marginLeft: -4 },
    rail: { position: 'absolute', left: 0, top: 0, width: RAIL },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    nodeCol: { width: RAIL, alignItems: 'center', justifyContent: 'center' },
    node: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.faint,
      backgroundColor: colors.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nodeDone: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.node, borderColor: colors.node },
    nodeCurrent: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.node },
    nodeSkipped: { borderStyle: 'dashed' },
    nodeDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.node },
    rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 14, minHeight: 72 },
    tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowTitleDone: { color: colors.faint, textDecorationLine: 'line-through' },
    rowMeta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 1 },
    progress: { marginTop: 7, marginBottom: 4, marginRight: 8 },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.controlBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: radius,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.faint,
    },
    balanceHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 16,
      paddingRight: 6,
      paddingTop: 6,
    },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    rings: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 18, paddingTop: 4 },
    ringWrap: { alignItems: 'center', gap: 10 },
    ringValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
    ringUnit: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    ringLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    label: type.label,
  });
