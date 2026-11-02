// Today, the same screen in every look: a greeting with the date (which opens the calendar) and three round
// buttons (sounds, your week, settings), a streak pill, the day's trail of steps winding past a dotted path, the
// Balance rings for routines, gym and language practice. The walked part of the path is dense dots, the way
// ahead fainter ones; the node is where a step shows its state (a waypoint ahead, the lit step with a slow halo,
// a filled stop when done, a flag at the summit), and every card ticks off in one tap. Each look draws all of it
// from its own tokens; only the art behind the header differs (Paper's mountains, Pine's canopy slab).
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { type Theme, useStyles, useTheme } from '../theme';
import { HEADER_RATIOS, HeaderScene } from './Art';
import { useDesktop } from './desktop/context';
import { Button } from './Button';
import { CANOPY_GAP, Canopy } from './Canopy';
import { Glass, HeaderMist, LensHeaderContext, useGlassScroll } from './Glass';
import { HintPane } from './Section';
import { clearOf } from './glass/colour';
import { Bar, Chevron, Collapse, Dim, EASE_OUT, Enter, FadeSwap, Pop, Press, Ring, SelectFade, useReduceMotion } from './Motion';
import { plural } from '../lib/plural';

export interface TrailItem {
  key: string;
  title: string;
  icon: string;
  meta: string;
  done: boolean;
  skipped?: boolean;
  /** The kind's colour: fills the progress bar and the finished tick. */
  color: string;
  /** The kind's text-safe ink: the glyph in the card's icon well. */
  ink: string;
  /** Opens another screen instead of ticking the row. */
  nav?: boolean;
  /** A day still to come: the step can be planned (a tap edits a routine) but not ticked off yet. A plan-only
   *  step with no `onPress` (a to-do) is shown but not pressable. */
  planOnly?: boolean;
  progress?: { value: number; total: number };
  onPress?: () => void;
  onLongPress?: () => void;
}

export interface BalanceRing {
  label: string;
  value: number;
  total: number;
  unit: string;
  color: string;
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
  /** The scroll view's top padding, so header art can sit flush with the top of the screen. */
  topInset: number;
  soundsPlaying: boolean;
  onSounds: () => void;
  onStats: () => void;
  onSettings: () => void;
  onAdd: () => void;
}

const RAIL = 56;
/** Header art moves at this fraction of the scroll speed behind the content (a slower, far layer). */
const PARALLAX = 0.35;
/** The header row starts this far below the scroll content's top padding, in every look. */
const TOP = 4;
/** Space under the header row inside Pine's slab; with the slab's own gap under its foot, it is the space between
 *  the header and what follows it in every look (16 + 12 = 28). */
const FOOT = 16;
/** The slab's 1px rim along its foot, which takes its share of that space. */
const SLAB_RIM = 1;

type NodeState = 'done' | 'current' | 'ahead' | 'skipped';

export function TrailHome(p: Props) {
  const theme = useTheme();
  const { colors, type, name } = theme;
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const desktop = useDesktop();
  const reduced = useReduceMotion();
  const [balanceOpen, setBalanceOpen] = useState(true);
  const [rows, setRows] = useState<Record<string, number>>({});
  // Header art drawn behind the header (Paper's mountains). Pine's slab comes from Canopy; the other looks show
  // the world itself. Neither changes where anything in the header sits.
  // The desktop shows Today in a column on the wide world, without the phone's portrait header art.
  const art = HEADER_RATIOS[name] !== undefined && !desktop.on;
  const slab = !!colors.material.canopy;

  const heights = p.items.map((it) => rows[it.key] ?? 0);
  const centers: number[] = [];
  let y = 0;
  for (const h of heights) {
    centers.push(y + h / 2);
    y += h;
  }
  const finished = p.items.map((it) => it.done || !!it.skipped);
  const allDone = p.total > 0 && p.done === p.total;
  // The step that's lit: the routine due next, or else the first step not yet finished (none on a day to come).
  const planning = p.items.some((it) => it.planOnly);
  let current = planning ? -1 : p.items.findIndex((it, i) => it.key === p.nextKey && !finished[i]);
  if (current < 0 && !planning) current = finished.indexOf(false);
  // A stretch of path is walked only where it leaves a finished step for another finished step or the lit one;
  // everything else is the way ahead, so the path never reads as walked through a step that isn't done.
  const walked = centers.map((_, i) => i > 0 && finished[i - 1] && (finished[i] || i === current));
  const centerKey = centers.join(',');
  const walkedKey = walked.join(',');
  const walkedPath = useMemo(() => trail(centers, walked, true), [centerKey, walkedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const aheadPath = useMemo(() => trail(centers, walked, false), [centerKey, walkedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Header art sits at the top of the scroll content, flush with the top of the frame, and moves slower than the
  // content (parallax); glass over it shows its blurred copy, moved the same way.
  const { scrollY } = useGlassScroll();
  const parallax = art && !reduced ? PARALLAX : 0;
  const lensHeader = useMemo(() => ({ top: 0, scrollY, parallax }), [scrollY, parallax]);
  const sceneMotion = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.get() * parallax }] }));

  const streakText = p.streak > 0 ? `${plural(p.streak, 'day')} streak` : 'Start a streak';

  // The date line runs the full width under the greeting and the buttons, on one line, so it never wraps and
  // strands its chevron on a narrow phone.
  const top = (
    <View>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.greet}>{p.greeting},</Text>
          <Text style={styles.hello} numberOfLines={1} accessibilityRole="header">
            {p.name}
          </Text>
        </View>
        <View style={styles.topButtons}>
          <Round icon="musical-notes-outline" playingIcon="pause" playing={p.soundsPlaying} label="Sounds and music" onPress={p.onSounds} />
          <Round icon="stats-chart-outline" label="Your week" onPress={p.onStats} />
          <Round icon="settings-outline" label="Settings" onPress={p.onSettings} />
        </View>
      </View>
      <Press
        onPress={p.onToggleCalendar}
        style={styles.dateRow}
        accessibilityLabel={p.calendarOpen ? 'Hide the calendar' : `${p.dateLabel}. Pick a day`}
        accessibilityState={{ expanded: p.calendarOpen }}
        hitSlop={6}
      >
        <Text style={styles.date} numberOfLines={1}>
          {p.dateLabel}
        </Text>
        <Chevron open={p.calendarOpen} color={colors.onSlabMuted} size={16} />
      </Press>
    </View>
  );

  return (
    <LensHeaderContext.Provider value={lensHeader}>
      <View>
        {art && (
          <Animated.View style={[styles.scene, { top: -p.topInset, left: -16, width }, sceneMotion]} pointerEvents="none">
            <HeaderScene width={width} />
            <HeaderMist width={width} />
            <SummitSweep on={allDone} width={width} />
          </Animated.View>
        )}
        {/* The same box in every look: on Pine the slab is drawn behind it and its padding takes the place of the
            margins, so the header row and everything under it land in the same place. */}
        <Canopy bleed={p.topInset} style={slab ? { paddingTop: p.topInset + TOP, paddingBottom: FOOT - SLAB_RIM } : styles.headerBox}>
          {top}
        </Canopy>

        <Collapse open={p.calendarOpen}>
          <Glass style={styles.calendar}>{p.calendar}</Glass>
        </Collapse>

        <Glass tier="control" radius={999} style={styles.streak}>
          <View style={[styles.flamePebble, p.streak > 0 && styles.flamePebbleOn]}>
            <Ionicons name={p.streak > 0 ? 'flame' : 'flame-outline'} size={16} color={p.streak > 0 ? colors.streak : colors.muted} />
          </View>
          <Text style={styles.streakText}>
            {streakText}
            <Text style={styles.streakMuted}>{p.total > 0 ? `  ·  ${p.done}/${p.total} today` : ''}</Text>
          </Text>
        </Glass>

        <View style={styles.sectionHead}>
          <Text style={[type.sectionTitle, styles.flex]} accessibilityRole="header">
            {p.isToday ? "Today's trail" : `${p.dateLabel} trail`}
          </Text>
          {p.total > 0 && (
            <View style={styles.badge} accessible accessibilityLabel={allDone ? 'Everything done' : `${p.done} of ${p.total} done`}>
              <Text style={styles.badgeText}>
                {p.done}/{p.total}
              </Text>
            </View>
          )}
        </View>

        {allDone && (
          <Enter index={0}>
            <Glass tier="hero" bloom style={styles.complete} accessibilityLabel={`Trail complete. ${streakText}`}>
              <Pop done style={styles.completeDisc}>
                <Ionicons name="checkmark" size={24} color={colors.onPrimary} />
              </Pop>
              <View style={styles.flex}>
                <Text style={styles.completeTitle}>Trail complete</Text>
                <Text style={styles.rowMeta}>
                  {p.streak > 0 ? `${plural(p.streak, 'day')} in a row. Rest well.` : 'Every step done today. Rest well.'}
                </Text>
              </View>
            </Glass>
          </Enter>
        )}

        {p.items.length === 0 ? (
          <Glass style={styles.clear}>
            <View style={styles.clearPebble}>
              <Ionicons name="trail-sign-outline" size={26} color={colors.text} />
            </View>
            <Text style={styles.clearTitle}>A clear day</Text>
            <Text style={styles.clearBody}>Nothing on the trail yet. Add a routine or a to-do and it starts here.</Text>
            <Button label="Add to your day" icon="add" onPress={p.onAdd} style={styles.clearButton} />
          </Glass>
        ) : (
          <View style={styles.trail}>
            <View style={[styles.rail, { height: y }]} pointerEvents="none">
              {y > 0 && (
                <Svg width={RAIL} height={y}>
                  <Path
                    d={aheadPath}
                    stroke={colors.trailAhead}
                    strokeWidth={2.5}
                    strokeDasharray="1.5 8"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <Path
                    d={walkedPath}
                    stroke={colors.trailWalked}
                    strokeWidth={3}
                    strokeDasharray="2 6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              )}
            </View>
            {p.items.map((it, i) => (
              <TrailRow
                key={it.key}
                item={it}
                index={i}
                current={i === current}
                summit={i === p.items.length - 1}
                currentLabel={it.key === p.nextKey ? p.nextLabel : undefined}
                onLayout={(h) => setRows((r) => (r[it.key] === h ? r : { ...r, [it.key]: h }))}
              />
            ))}
          </View>
        )}
        {p.items.some((it) => it.onLongPress || it.planOnly) ? (
          <View style={styles.hint}>
            <HintPane>
              {planning
                ? 'This day is still ahead. Tap a routine to change it, and tick things off on the day.'
                : 'Tap a step to tick it off. Press and hold a routine to edit it.'}
            </HintPane>
          </View>
        ) : null}

        <View style={[styles.sectionHead, styles.sectionHeadTight]}>
          <Text style={[type.sectionTitle, styles.flex]} accessibilityRole="header">
            Balance
          </Text>
          <Press
            onPress={() => setBalanceOpen((o) => !o)}
            style={styles.iconBtn}
            accessibilityLabel={balanceOpen ? 'Hide balance' : 'Show balance'}
            accessibilityState={{ expanded: balanceOpen }}
          >
            <Chevron open={balanceOpen} color={colors.text} />
          </Press>
        </View>
        <Glass>
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
                    <Ring size={92} stroke={12} progress={rest ? 0 : b.value / b.total} color={b.color} track={colors.track}>
                      <Text style={[styles.ringValue, { color: rest ? colors.faint : b.color }]}>{rest ? '–' : b.value}</Text>
                      <Text style={styles.ringUnit}>{rest ? 'rest' : `of ${b.total}`}</Text>
                    </Ring>
                    <Text style={styles.ringLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                      {b.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Collapse>
          <Collapse open={!balanceOpen}>
            <Text style={styles.balanceFolded}>
              {p.balance.map((b) => (b.total === 0 ? `${b.label} rest` : `${b.label} ${b.value}/${b.total}`)).join('  ·  ')}
            </Text>
          </Collapse>
        </Glass>
      </View>
    </LensHeaderContext.Provider>
  );
}

/** A round header button. With `playingIcon`, the glyph crossfades to it while something plays and a dot fades in. */
function Round({
  icon,
  playingIcon,
  playing = false,
  label,
  onPress,
}: {
  icon: string;
  playingIcon?: string;
  playing?: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const glyph = (name: string) => <Ionicons name={name as 'sunny'} size={20} color={colors.text} />;
  return (
    <Glass tier="control" radius={22} onPress={onPress} style={styles.round} accessibilityLabel={label}>
      {playingIcon ? (
        <>
          <FadeSwap on={playing} off={glyph(icon)} onContent={glyph(playingIcon)} />
          <Dim on={!playing} to={0} style={styles.dot} />
        </>
      ) : (
        glyph(icon)
      )}
    </Glass>
  );
}

function TrailRow({
  item,
  index,
  current,
  summit,
  currentLabel,
  onLayout,
}: {
  item: TrailItem;
  index: number;
  current: boolean;
  summit: boolean;
  currentLabel?: string;
  onLayout: (height: number) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [cardW, setCardW] = useState(0);
  const plan = !!item.planOnly;
  const press = item.onPress
    ? () => {
        if (Platform.OS !== 'web' && !item.nav && !plan) Haptics.selectionAsync().catch(() => {});
        item.onPress?.();
      }
    : undefined;
  const finished = item.done || !!item.skipped;
  const meta = item.skipped
    ? 'Skipped · streak kept'
    : item.done && !item.progress
      ? 'Completed'
      : current && currentLabel
        ? currentLabel
        : item.meta;
  const state: NodeState = item.done ? 'done' : item.skipped ? 'skipped' : current ? 'current' : 'ahead';
  const lit = current && !finished;
  // A routine counted toward a goal (glasses of water) adds one per tap until it's done.
  const adds = !item.nav && !plan && !!item.progress && !item.done;
  // The up-next line is part of what the step says, so a counter that's up next announces it too.
  const label = plan
    ? item.onPress
      ? `Edit ${item.title}, ${meta}`
      : `${item.title}, ${meta}. You can tick this off on the day`
    : adds && item.progress
      ? `Add one to ${item.title}, ${item.progress.value} of ${item.progress.total}${current && currentLabel ? `, ${currentLabel}` : ''}`
      : `${item.title}, ${meta}`;
  const button = item.nav || adds || plan;
  const card = (
    <Glass
      lit={lit}
      onPress={press}
      onLongPress={plan ? undefined : item.onLongPress}
      receded={finished}
      style={[styles.flex, styles.rowCard]}
      accessibilityRole={!press ? 'text' : button ? 'button' : 'checkbox'}
      accessibilityState={!press ? { disabled: true } : button ? undefined : { checked: item.done }}
      accessibilityLabel={label}
      accessibilityHint={
        item.nav || plan ? undefined : item.onLongPress ? `Double tap to ${adds ? 'add one' : 'tick off'}. Long press to edit.` : undefined
      }
      accessibilityActions={!plan && item.onLongPress ? [{ name: 'activate' }, { name: 'longpress', label: 'Edit' }] : undefined}
      onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'longpress' ? item.onLongPress?.() : press?.())}
    >
      <Sweep run={item.done} width={cardW} />
      <Dim on={finished} to={0.6}>
        <View style={styles.pebble}>
          <Ionicons name={item.icon as 'sunny'} size={20} color={item.ink} />
        </View>
      </Dim>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, finished && styles.rowTitleDone]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.progress && !finished ? (
          <View style={styles.progress}>
            <Bar progress={item.progress.value / Math.max(1, item.progress.total)} color={item.color} track={colors.track} height={4} />
          </View>
        ) : null}
        <Text style={[styles.rowMeta, lit && styles.rowMetaLit]} numberOfLines={2}>
          {meta}
        </Text>
      </View>
      {item.nav || (plan && item.onPress) ? (
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      ) : plan ? null : (
        <Pop done={item.done} style={styles.check}>
          <SelectFade on={item.done} color={item.color} radius={13} bleed={2} />
          <FadeSwap
            on={item.done}
            off={adds ? <Ionicons name="add" size={16} color={colors.text} /> : null}
            onContent={<Ionicons name="checkmark" size={15} color={colors.onKind} />}
          />
        </Pop>
      )}
    </Glass>
  );
  return (
    <Enter index={index}>
      <View
        style={styles.row}
        onLayout={(e) => {
          const { height, width } = e.nativeEvent.layout;
          onLayout(Math.round(height));
          setCardW((w) => (Math.abs(w - (width - RAIL)) < 1 ? w : width - RAIL));
        }}
      >
        <View style={styles.nodeCol}>
          <Node state={state} summit={summit} />
        </View>
        {card}
      </View>
    </Enter>
  );
}

/**
 * The trail node, the one place on the path a step shows its state: a waypoint ahead (a flag at the summit), the
 * lit step with a slow halo, a filled stop when done, a dashed waypoint when skipped. The states are layers that
 * crossfade, and the node pops when it's ticked.
 */
function Node({ state, summit }: { state: NodeState; summit: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  return (
    <Pop done={state === 'done'} style={styles.nodeBox}>
      {state === 'current' && !reduced && <Halo />}
      <Dim on={state !== 'ahead'} to={0} style={styles.nodeLayer}>
        <View style={styles.waypoint}>
          {summit ? <Ionicons name="flag" size={11} color={colors.muted} /> : <View style={styles.waypointDot} />}
        </View>
      </Dim>
      <Dim on={state !== 'skipped'} to={0} style={styles.nodeLayer}>
        <View style={[styles.waypoint, styles.nodeSkipped]}>
          <Ionicons name="remove" size={12} color={colors.faint} />
        </View>
      </Dim>
      <Dim on={state !== 'current'} to={0} style={styles.nodeLayer}>
        <View style={styles.nodeLit}>
          <View style={styles.nodeDot} />
        </View>
      </Dim>
      <Dim on={state !== 'done'} to={0} style={styles.nodeLayer}>
        <View style={styles.nodeDone}>
          <Ionicons name={summit ? 'flag' : 'checkmark'} size={summit ? 14 : 16} color={colors.onNode} />
        </View>
      </Dim>
    </Pop>
  );
}

/** A ring that breathes out from the lit node: grows to 1.4x and fades, every 1.8s. */
function Halo() {
  const styles = useStyles(makeStyles);
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1800, easing: EASE_OUT }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - p.get()), transform: [{ scale: 1 + 0.4 * p.get() }] }));
  return <Animated.View pointerEvents="none" style={[styles.halo, style]} />;
}

/** One pass of light across a card when its step is ticked off (never on mount, never under reduced motion). */
function Sweep({ run, width }: { run: boolean; width: number }) {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  // Each pass runs the count up by one; the band shows only part-way through a pass.
  const n = useSharedValue(0);
  const was = useRef(run);
  useEffect(() => {
    if (run && !was.current && !reduced && width > 0) {
      n.set(withTiming(Math.round(n.get()) + 1, { duration: 520, easing: EASE_OUT }));
    }
    was.current = run;
  }, [run, reduced, width, n]);
  const band = width * 0.4;
  const style = useAnimatedStyle(() => {
    const f = n.get() - Math.floor(n.get());
    return { opacity: f > 0 ? 1 : 0, transform: [{ translateX: -1.2 * band + f * 3.4 * band }] };
  });
  const sheen = colors.material.sheen;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, width: band },
        { backgroundImage: `linear-gradient(100deg, ${clearOf(sheen)}, ${sheen} 50%, ${clearOf(sheen)})` },
        style,
      ]}
    />
  );
}

/** Header art only: when the last step is ticked, one band of light crosses it. */
function SummitSweep({ on, width }: { on: boolean; width: number }) {
  const { name } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width, height: Math.round(width * (HEADER_RATIOS[name] ?? 1)) }}
    >
      <Sweep run={on} width={width} />
    </View>
  );
}

/** A dotted path that winds from node to node: it swings out unevenly between rows, like a footpath on a map.
 *  Draws the stretches whose `walked` flag equals `which` (stretch i runs from node i-1 to node i), so the walked
 *  and the ahead paths together make one path with one rhythm. */
function trail(centers: number[], walked: boolean[], which: boolean): string {
  const x = RAIL / 2;
  let d = '';
  let open = false;
  for (let i = 1; i < centers.length; i++) {
    if (walked[i] !== which) {
      open = false;
      continue;
    }
    const a = centers[i - 1];
    const b = centers[i];
    const swing = i % 2 ? 18 : -12;
    if (!open) d += `M ${x} ${a} `;
    d += `C ${x + swing} ${a + (b - a) * 0.35}, ${x + swing} ${a + (b - a) * 0.65}, ${x} ${b} `;
    open = true;
  }
  return d.trim();
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1 },
    scene: { position: 'absolute' },
    headerBox: { marginTop: TOP, marginBottom: FOOT + CANOPY_GAP },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    greet: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 20, color: colors.onSlabMuted },
    hello: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.6, marginTop: 1 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44 },
    date: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.onSlabMuted, flexShrink: 1 },
    topButtons: { flexDirection: 'row', gap: 8 },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    dot: {
      position: 'absolute',
      top: 7,
      right: 7,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: colors.material.rimTop,
      backgroundColor: colors.streak,
    },
    calendar: { marginBottom: 14, padding: 8 },
    hint: { marginLeft: RAIL - 4 },
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingLeft: 8,
      paddingRight: 14,
      minHeight: 40,
    },
    flamePebble: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    flamePebbleOn: {
      backgroundImage: `radial-gradient(circle at 50% 55%, ${colors.warmTile} 0%, ${colors.warmTile} 45%, ${clearOf(colors.warmTile)} 100%)`,
    },
    streakText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    streakMuted: { fontFamily: fonts.body, color: colors.muted },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 26,
      marginBottom: 12,
      paddingHorizontal: 2,
    },
    sectionHeadTight: { marginTop: 22, marginBottom: 4 },
    badge: { backgroundColor: colors.node, borderRadius: 999, paddingHorizontal: 12, minHeight: 28, justifyContent: 'center' },
    badgeText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.onNode, fontVariant: ['tabular-nums'] },
    trail: { marginLeft: -4 },
    rail: { position: 'absolute', left: 0, top: 0, width: RAIL },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    nodeCol: { width: RAIL, alignItems: 'center', justifyContent: 'center' },
    nodeBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    nodeLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    nodeDone: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.node, alignItems: 'center', justifyContent: 'center' },
    nodeSkipped: { borderStyle: 'dashed' },
    nodeDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.node },
    waypoint: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.nodeAhead,
      backgroundColor: colors.nodeAheadFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waypointDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.nodeAhead },
    nodeLit: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2.5,
      borderColor: colors.node,
      backgroundColor: colors.nodeCurrentFill,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.material.control.shadow,
    },
    halo: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.node },
    rowCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 16, minHeight: 76 },
    pebble: {
      width: 44,
      height: 44,
      borderRadius: radii.inset,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.text },
    rowTitleDone: { fontFamily: fonts.bodyMedium, color: colors.faint, textDecorationLine: 'line-through' },
    rowMeta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 1 },
    rowMetaLit: { fontFamily: fonts.bodyMedium, color: colors.text },
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
    complete: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12 },
    completeDisc: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: colors.actionGlow,
    },
    completeTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.text, letterSpacing: -0.3 },
    clear: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
    clearPebble: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    clearTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.text, marginTop: 14 },
    clearBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 4 },
    clearButton: { marginTop: 18, alignSelf: 'stretch' },
    balanceFolded: { ...type.small, paddingHorizontal: 20, paddingVertical: 16 },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    rings: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 18, paddingTop: 18 },
    ringWrap: { alignItems: 'center', gap: 10 },
    ringValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
    ringUnit: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    ringLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  });
};
