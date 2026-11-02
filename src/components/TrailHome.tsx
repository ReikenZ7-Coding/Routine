// Today on the page looks (Paper, Pine): a greeting under misty mountains, a streak pill, the day's
// trail of routines winding past a dotted path, and the balance rings for routines, gym and language practice.
// On Paper the trail is a footpath up the mountain: the walked part is inked in, the way ahead is faint, done
// steps sink back into the fog, the step that's up next is the lit one, and the last node is the summit.
// On Pine the header sits on the canopy slab; the walked part of the trail glows mint, the step that's up next
// is a lit hero card with a black "Up next" tag under its name, and done steps recede into the night.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { type Theme, useStyles, useTheme } from '../theme';
import { HEADER_RATIOS, HeaderScene } from './Art';
import { Button } from './Button';
import { Canopy } from './Canopy';
import { Glass, HeaderMist, LensHeaderContext, useGlassScroll } from './Glass';
import { alphaOf, clearOf } from './glass/colour';
import { Bar, Chevron, Collapse, Dim, EASE_OUT, Enter, FadeSwap, Pop, Press, Ring, SelectFade, useReduceMotion } from './Motion';
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
/** Paper's header art moves at this fraction of the scroll speed behind the content (a slower, far layer). */
const PARALLAX = 0.35;

type NodeState = 'done' | 'current' | 'ahead' | 'skipped';

export function TrailHome(p: Props) {
  const theme = useTheme();
  const { colors, type, name } = theme;
  const paper = name === 'paper';
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const reduced = useReduceMotion();
  const [balanceOpen, setBalanceOpen] = useState(true);
  const [rows, setRows] = useState<Record<string, number>>({});

  const heights = p.items.map((it) => rows[it.key] ?? 0);
  const centers: number[] = [];
  let y = 0;
  for (const h of heights) {
    centers.push(y + h / 2);
    y += h;
  }
  const finished = p.items.map((it) => it.done || !!it.skipped);
  const allDone = p.total > 0 && p.done === p.total;
  // The step that's lit: the routine due next, or else the first step not yet finished. Everything before it
  // is the walked part of the path.
  let current = p.items.findIndex((it, i) => it.key === p.nextKey && !finished[i]);
  if (current < 0) current = finished.indexOf(false);
  const split = current < 0 ? centers.length - 1 : current;
  const centerKey = centers.join(',');
  const walkedPath = useMemo(() => trail(centers.slice(0, split + 1), 0, paper), [centerKey, split, paper]); // eslint-disable-line react-hooks/exhaustive-deps
  const aheadPath = useMemo(() => trail(centers.slice(split), split, paper), [centerKey, split, paper]); // eslint-disable-line react-hooks/exhaustive-deps

  // The mountains sit at the top of the scroll content, flush with the top of the frame. On Paper they move
  // slower than the content (parallax), and glass over them shows their blurred copy, moved the same way.
  const { scrollY } = useGlassScroll();
  const parallax = paper && !reduced ? PARALLAX : 0;
  const lensHeader = useMemo(() => ({ top: 0, scrollY, parallax }), [scrollY, parallax]);
  const sceneMotion = useAnimatedStyle(() => ({ transform: [{ translateY: scrollY.get() * parallax }] }));

  const streakText =
    allDone && paper
      ? p.streak > 0
        ? `Day complete · ${plural(p.streak, 'day')} streak`
        : 'Day complete'
      : p.streak > 0
        ? `${plural(p.streak, 'day')} streak`
        : 'Start a streak';

  const top = (
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
          <Chevron open={!p.calendarOpen} color={colors.onSlabMuted} size={16} />
        </Press>
      </View>
      <View style={styles.topButtons}>
        <Round
          icon={p.soundsPlaying ? 'pause' : 'musical-notes-outline'}
          label="Sounds and music"
          onPress={p.onSounds}
          dot={p.soundsPlaying}
        />
        <Round icon="stats-chart-outline" label="Your week" onPress={p.onStats} />
        <Round icon="settings-outline" label="Settings" onPress={p.onSettings} />
      </View>
    </View>
  );

  return (
    <LensHeaderContext.Provider value={lensHeader}>
      <View>
        {paper ? (
          <>
            <Animated.View style={[styles.scene, { top: -p.topInset, left: -16, width }, sceneMotion]} pointerEvents="none">
              <HeaderScene width={width} />
              <HeaderMist width={width} />
              <SummitSweep on={allDone} width={width} />
            </Animated.View>
            {top}
          </>
        ) : (
          <Canopy bleed={p.topInset}>{top}</Canopy>
        )}

        <Collapse open={p.calendarOpen}>
          <Glass style={styles.calendar}>{p.calendar}</Glass>
        </Collapse>

        <Glass tier="control" radius={999} style={styles.streak}>
          {paper ? (
            <View style={[styles.flamePebble, p.streak > 0 && styles.flamePebbleOn]}>
              <Ionicons name={p.streak > 0 ? 'flame' : 'flame-outline'} size={16} color={p.streak > 0 ? colors.streak : colors.muted} />
            </View>
          ) : (
            <Ionicons name={p.streak > 0 ? 'flame' : 'flame-outline'} size={16} color={colors.streak} />
          )}
          <Text style={styles.streakText}>
            {streakText}
            <Text style={styles.streakMuted}>{p.total > 0 && !(allDone && paper) ? `  ·  ${p.done}/${p.total} today` : ''}</Text>
          </Text>
        </Glass>

        <View style={styles.sectionHead}>
          <Text style={[type.sectionTitle, styles.flex]} accessibilityRole="header">
            {p.isToday ? "Today's trail" : `${p.dateLabel} trail`}
          </Text>
          <View style={styles.badge} accessible accessibilityLabel={allDone ? 'Everything done' : `${p.done} of ${p.total} done`}>
            {paper ? (
              <FadeSwap
                on={allDone}
                off={
                  <View style={styles.badgeSwap}>
                    <Text style={styles.badgeText}>
                      {p.done}/{p.total}
                    </Text>
                    {/* Holds the pill at the width of the wider label, so "Summit" never spills out of it. */}
                    <Text style={[styles.badgeText, styles.badgeSizer]}>Summit</Text>
                  </View>
                }
                onContent={<Text style={styles.badgeText}>Summit</Text>}
                style={styles.badgeSwap}
              />
            ) : (
              <Text style={styles.badgeText}>
                {p.done}/{p.total}
              </Text>
            )}
          </View>
        </View>

        {!paper && allDone && (
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
          paper ? (
            <Glass style={styles.clear}>
              <View style={styles.clearPebble}>
                <Ionicons name="trail-sign-outline" size={26} color={colors.text} />
              </View>
              <Text style={styles.clearTitle}>A clear day</Text>
              <Text style={styles.clearBody}>Nothing on the trail yet. Add a routine or a to-do and it starts here.</Text>
              <Button label="Add a step" icon="add" onPress={p.onAdd} style={styles.clearButton} />
            </Glass>
          ) : (
            <Glass style={styles.empty}>
              <View style={[styles.tile, { backgroundColor: colors.tile }]}>
                <Ionicons name="trail-sign-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>A clear day</Text>
                <Text style={styles.rowMeta}>Add a routine or a to-do and it starts the trail.</Text>
                <Button label="Add a routine" icon="add" variant="plain" onPress={p.onAdd} style={styles.emptyButton} />
              </View>
            </Glass>
          )
        ) : (
          <View style={styles.trail}>
            <View style={[styles.rail, { height: y }]} pointerEvents="none">
              {y > 0 &&
                (paper ? (
                  <Svg width={RAIL} height={y}>
                    <Path
                      d={aheadPath}
                      stroke={colors.faint}
                      strokeWidth={2.5}
                      strokeDasharray="1.5 8"
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.55}
                    />
                    <Path
                      d={walkedPath}
                      stroke={colors.node}
                      strokeWidth={3}
                      strokeDasharray="2 6"
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.85}
                    />
                  </Svg>
                ) : (
                  // Pine: the way ahead is a faint dotted path; the walked part is lit mint, with a soft wide copy
                  // under it so it reads as light on the forest floor.
                  <Svg width={RAIL} height={y}>
                    <Path
                      d={aheadPath}
                      stroke={colors.faint}
                      strokeWidth={2.5}
                      strokeDasharray="1 7"
                      strokeLinecap="round"
                      fill="none"
                      opacity={0.6}
                    />
                    <Path d={walkedPath} stroke={colors.node} strokeWidth={8} strokeLinecap="round" fill="none" opacity={0.12} />
                    <Path d={walkedPath} stroke={colors.node} strokeWidth={2.5} strokeLinecap="round" fill="none" opacity={0.85} />
                  </Svg>
                ))}
            </View>
            {p.items.map((it, i) => (
              <TrailRow
                key={it.key}
                item={it}
                index={i}
                current={i === current}
                summit={paper && i === p.items.length - 1}
                currentLabel={it.key === p.nextKey ? p.nextLabel : undefined}
                onLayout={(h) => setRows((r) => (r[it.key] === h ? r : { ...r, [it.key]: h }))}
              />
            ))}
          </View>
        )}

        <View style={[styles.sectionHead, paper && styles.sectionHeadTight]}>
          <Text style={[type.sectionTitle, styles.flex]} accessibilityRole="header">
            Balance
          </Text>
          {paper && (
            <Press
              onPress={() => setBalanceOpen((o) => !o)}
              style={styles.iconBtn}
              accessibilityLabel={balanceOpen ? 'Hide balance' : 'Show balance'}
              accessibilityState={{ expanded: balanceOpen }}
            >
              <Chevron open={balanceOpen} color={colors.text} />
            </Press>
          )}
        </View>
        <Glass>
          {!paper && (
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
          )}
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
                    <Ring
                      size={paper ? 92 : 88}
                      stroke={paper ? 12 : 9}
                      progress={rest ? 0 : b.value / b.total}
                      color={b.color}
                      track={paper ? b.soft : colors.track}
                    >
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
          {paper && !balanceOpen && (
            <Text style={styles.balanceFolded}>
              {p.balance.map((b) => (b.total === 0 ? `${b.label} rest` : `${b.label} ${b.value}/${b.total}`)).join('  ·  ')}
            </Text>
          )}
        </Glass>
      </View>
    </LensHeaderContext.Provider>
  );
}

function Round({ icon, label, onPress, dot }: { icon: string; label: string; onPress: () => void; dot?: boolean }) {
  const { colors, name } = useTheme();
  const styles = useStyles(makeStyles);
  const paper = name === 'paper';
  return (
    <Glass tier="control" radius={paper ? 23 : 22} onPress={onPress} style={styles.round} accessibilityLabel={label}>
      <Ionicons name={icon as 'sunny'} size={paper ? 20 : 19} color={colors.text} />
      {dot && <View style={styles.dot} />}
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
  const { colors, name } = useTheme();
  const paper = name === 'paper';
  const styles = useStyles(makeStyles);
  const [cardW, setCardW] = useState(0);
  const press = () => {
    if (Platform.OS !== 'web' && !item.nav) Haptics.selectionAsync().catch(() => {});
    item.onPress();
  };
  const finished = item.done || !!item.skipped;
  const meta = item.skipped
    ? 'Skipped · streak kept'
    : item.done && !item.progress
      ? 'Completed'
      : current && currentLabel
        ? currentLabel
        : item.meta;
  const state: NodeState = item.done ? 'done' : item.skipped ? 'skipped' : current ? 'current' : 'ahead';
  const lit = paper && current && !finished;
  // Pine: the step that's up next is the lit hero of the trail. Its tag carries when ("Up next · 21:00"), the
  // meta line under it what's left ("in 2 h 33 min").
  const hero = !paper && current && !finished;
  const [tag, rest] = hero ? splitTag(currentLabel) : [undefined, undefined];
  const card = (
    <Glass
      tier={hero ? 'hero' : 'pane'}
      lit={hero}
      bloom={hero}
      onPress={press}
      onLongPress={item.onLongPress}
      receded={finished}
      style={[styles.flex, styles.rowCard, hero && styles.heroCard]}
      accessibilityRole={item.nav ? 'button' : 'checkbox'}
      accessibilityState={item.nav ? undefined : { checked: item.done }}
      accessibilityLabel={`${item.title}, ${meta}`}
      accessibilityHint={item.nav ? undefined : item.onLongPress ? 'Double tap to tick off. Long press to edit.' : undefined}
    >
      {paper && <Sweep run={item.done} width={cardW} />}
      {hero && <MountSweep width={cardW} />}
      {paper ? (
        <Dim on={finished} to={0.6}>
          <View style={styles.pebble}>
            <SelectFade on={lit} color={alphaOf(item.color, 0.12)} radius={15} />
            <FadeSwap
              on={lit}
              off={<Ionicons name={item.icon as 'sunny'} size={20} color={colors.text} />}
              onContent={<Ionicons name={item.icon as 'sunny'} size={20} color={item.color} />}
            />
          </View>
        </Dim>
      ) : (
        <View style={[styles.tile, { backgroundColor: hero ? alphaOf(item.color, 0.16) : colors.tile }]}>
          <Ionicons name={item.icon as 'sunny'} size={hero ? 22 : 20} color={finished ? colors.faint : item.color} />
        </View>
      )}
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, hero && styles.heroTitle, finished && styles.rowTitleDone]} numberOfLines={2}>
          {item.title}
        </Text>
        {hero && (
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
            {rest ? <Text style={styles.tagRest}>{rest}</Text> : null}
          </View>
        )}
        {item.progress && !finished ? (
          <View style={styles.progress}>
            <Bar
              progress={item.progress.value / Math.max(1, item.progress.total)}
              color={item.color}
              track={paper ? colors.track : colors.tile}
              height={paper ? 4 : 6}
            />
          </View>
        ) : null}
        {hero && !item.progress ? null : (
          <Text style={[styles.rowMeta, current && !finished && styles.rowMetaLit]} numberOfLines={2}>
            {hero ? item.meta : meta}
          </Text>
        )}
      </View>
      {item.nav ? (
        <Ionicons name="chevron-forward" size={18} color={paper ? colors.muted : colors.faint} />
      ) : paper ? null : (
        <Pop done={item.done} style={styles.check}>
          <SelectFade on={item.done} color={item.color} radius={13} bleed={2} />
          <FadeSwap on={item.done} off={null} onContent={<Ionicons name="checkmark" size={15} color={colors.onKind} />} />
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
          {paper ? (
            <PaperNode state={state} summit={summit} />
          ) : (
            <Pop
              done={item.done}
              style={[
                styles.node,
                item.done && styles.nodeDone,
                current && !item.done && styles.nodeCurrent,
                item.skipped && styles.nodeSkipped,
              ]}
            >
              {state === 'current' && <PineHalo />}
              {item.done ? (
                <Ionicons name="checkmark" size={16} color={colors.onNode} />
              ) : current ? (
                <View style={styles.nodeDot} />
              ) : item.skipped ? (
                <Ionicons name="remove" size={12} color={colors.faint} />
              ) : null}
            </Pop>
          )}
        </View>
        {card}
      </View>
    </Enter>
  );
}

/**
 * Paper's trail node, the one place a step shows its state: a faint waypoint ahead (a flag at the summit), the lit
 * step with a slow halo, a filled ink stop when done. The states are layers that crossfade, and the node pops
 * when it's ticked.
 */
function PaperNode({ state, summit }: { state: NodeState; summit: boolean }) {
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
        <View style={[styles.node, styles.nodeDone]}>
          <Ionicons name={summit ? 'flag' : 'checkmark'} size={summit ? 14 : 16} color={colors.onNode} />
        </View>
      </Dim>
    </Pop>
  );
}

/** "Up next · 21:00 · in 2 h 33 min" -> ["Up next · 21:00", "in 2 h 33 min"]; "Happening now · 5 min left" ->
 *  ["Happening now", "5 min left"]. A step lit without a time is simply "Up next". */
function splitTag(label?: string): [string, string | undefined] {
  if (!label) return ['Up next', undefined];
  const parts = label.split(' · ');
  const n = parts.length > 1 && /^\d/.test(parts[1]) ? 2 : 1;
  return [parts.slice(0, n).join(' · '), parts.slice(n).join(' · ') || undefined];
}

/** Pine's lit node breathes a ring out (the same halo as Paper's, in mint); still under reduced motion. */
function PineHalo() {
  const reduced = useReduceMotion();
  return reduced ? null : <Halo />;
}

/** One pass of moonlight across the lit card when the trail first shows (never under reduced motion). */
function MountSweep({ width }: { width: number }) {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const p = useSharedValue(0);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || reduced || width <= 0) return;
    ran.current = true;
    p.set(withDelay(240, withTiming(1, { duration: 900, easing: EASE_OUT })));
  }, [reduced, width, p]);
  const band = 48;
  const style = useAnimatedStyle(() => ({
    opacity: p.get() > 0 && p.get() < 1 ? 1 : 0,
    transform: [{ translateX: -band - 20 + p.get() * (width + band + 40) }, { rotate: '15deg' }],
  }));
  const light = colors.material.topGlow;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: -20, bottom: -20, left: 0, width: band },
        { backgroundImage: `linear-gradient(90deg, ${clearOf(light)}, ${light} 50%, ${clearOf(light)})` },
        style,
      ]}
    />
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

/** When the last step is ticked, one band of morning light crosses the mountains. */
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

/** A dotted path that winds from node to node: it swings out between rows, like a footpath on a map. `from` is
 *  the index of the first centre, so a path split in two keeps one rhythm; Paper's footpath swings unevenly. */
function trail(centers: number[], from: number, uneven: boolean): string {
  if (centers.length < 2) return '';
  const x = RAIL / 2;
  let d = `M ${x} ${centers[0]}`;
  for (let i = 1; i < centers.length; i++) {
    const a = centers[i - 1];
    const b = centers[i];
    const n = from + i;
    const swing = uneven ? (n % 2 ? 18 : -12) : n % 2 ? 14 : -14;
    d += ` C ${x + swing} ${a + (b - a) * 0.35}, ${x + swing} ${a + (b - a) * 0.65}, ${x} ${b}`;
  }
  return d;
}

const makeStyles = ({ colors, fonts, type, radius, radii, name }: Theme) => {
  const paper = name === 'paper';
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1 },
    scene: { position: 'absolute' },
    top: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: paper ? 8 : 0 },
    greet: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 20, color: colors.onSlabMuted },
    hello: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.6, marginTop: 1 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
    date: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.onSlabMuted },
    topButtons: { flexDirection: 'row', gap: paper ? 10 : 8 },
    round: paper
      ? { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }
      : { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    dot: paper
      ? {
          position: 'absolute',
          top: 7,
          right: 7,
          width: 10,
          height: 10,
          borderRadius: 5,
          borderWidth: 2,
          borderColor: colors.material.rimTop,
          backgroundColor: colors.streak,
        }
      : { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    calendar: paper ? { marginTop: 14, padding: 8 } : { marginBottom: 14, padding: 8 },
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingLeft: paper ? 8 : 12,
      paddingRight: 14,
      minHeight: paper ? 40 : 38,
      marginTop: paper ? 18 : 0,
    },
    flamePebble: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    flamePebbleOn: {
      backgroundImage: `radial-gradient(circle at 50% 55%, ${colors.warmTile} 0%, ${colors.warmTile} 45%, ${clearOf(colors.warmTile)} 100%)`,
    },
    streakText: { fontFamily: fonts.bodyMedium, fontSize: paper ? 15 : 14, color: colors.text },
    streakMuted: { fontFamily: fonts.body, color: colors.muted },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 26,
      marginBottom: 12,
      // Paper lines its own headings up with the Section titles further down the page.
      paddingHorizontal: paper ? 2 : 0,
    },
    sectionHeadTight: { marginTop: 22, marginBottom: 4 },
    badge: paper
      ? {
          borderRadius: 999,
          paddingHorizontal: 12,
          minHeight: 28,
          justifyContent: 'center',
          backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
          boxShadow: colors.material.control.shadow,
        }
      : { backgroundColor: colors.node, borderRadius: 999, paddingHorizontal: 10, minHeight: 26, justifyContent: 'center' },
    badgeSwap: { alignItems: 'center' },
    badgeSizer: { height: 0, opacity: 0 },
    badgeText: { fontFamily: paper ? fonts.bodyBold : fonts.monoMedium, fontSize: 13, color: colors.onNode, fontVariant: ['tabular-nums'] },
    trail: { marginLeft: -4 },
    rail: { position: 'absolute', left: 0, top: 0, width: RAIL },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    nodeCol: { width: RAIL, alignItems: 'center', justifyContent: 'center' },
    nodeBox: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    nodeLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
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
    waypoint: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
      backgroundColor: inset.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    waypointDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.faint, opacity: 0.55 },
    nodeLit: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2.5,
      borderColor: colors.node,
      backgroundColor: colors.material.control.body[0],
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.material.control.shadow,
    },
    halo: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.node },
    rowCard: paper
      ? { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingRight: 16, minHeight: 76 }
      : { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 14, minHeight: 72 },
    tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
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
    rowTitle: { fontFamily: paper ? fonts.bodyBold : fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowTitleDone: { fontFamily: fonts.bodyMedium, color: colors.faint, textDecorationLine: 'line-through' },
    rowMeta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 1 },
    rowMetaLit: { color: colors.text, fontFamily: paper ? fonts.bodyMedium : fonts.body },
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
    empty: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
    emptyButton: { alignSelf: 'flex-start', marginTop: 6, marginLeft: -12 },
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
    heroCard: { minHeight: 88, padding: 16, paddingRight: 16, gap: 14 },
    heroTitle: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 23, letterSpacing: -0.2 },
    tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    tag: {
      borderRadius: 999,
      paddingHorizontal: 9,
      minHeight: 22,
      justifyContent: 'center',
      backgroundColor: colors.material.tag?.fill ?? inset.fill,
    },
    tagText: { ...type.badge, fontSize: 10.5, letterSpacing: 1.4, color: colors.material.tag?.ink ?? colors.text },
    tagRest: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.text },
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
    balanceHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 16,
      paddingRight: 6,
      paddingTop: 6,
    },
    balanceFolded: { ...type.small, paddingHorizontal: 20, paddingVertical: 16 },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    rings: paper
      ? { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 18, paddingTop: 18 }
      : { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 18, paddingTop: 4 },
    ringWrap: { alignItems: 'center', gap: 10 },
    ringValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
    ringUnit: { fontFamily: fonts.body, fontSize: paper ? 14 : 13, color: colors.muted },
    ringLabel: paper
      ? { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text }
      : { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    label: type.label,
  });
};
