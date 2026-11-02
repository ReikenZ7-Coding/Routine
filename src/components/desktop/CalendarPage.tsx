// The calendar: a week of time (Monday to Sunday in columns, an all-day lane for everything without a time, the
// timed routines as blocks on a 05:00 to midnight grid, the now line across today), or the month with each day's
// marks and moods. Built from the same routines, to-dos, gym plan, practice and shopping list as Today. A block
// opens its routine's form, a tall block ticks off in place, and an empty half hour starts a new weekly routine at
// that time on that weekday.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { monthGrid } from '../../lib/agenda';
import { type DayPlan, dayPlan, thingsPlanned } from '../../lib/day';
import { moodOf } from '../../lib/journal';
import { practiceSubject } from '../../lib/language';
import { type Routine, isDoneOn, isSkipped, tapRoutine } from '../../lib/routines';
import { addDays, boughtOn, parseKey } from '../../lib/schedule';
import { useStore } from '../../lib/store';
import { cascadeOut, clock } from '../../lib/timeline';
import { type Kind, type Theme, useStyles, useTheme } from '../../theme';
import { alphaOf, washOf } from '../glass/colour';
import { EASE_OUT, FADE } from '../Motion';
import { MoodGlyph } from '../MoodGlyph';
import { MOODS } from '../../lib/journal';
import { Segmented } from '../Segmented';
import { useShell } from './api';
import { Hover } from './Hover';
import { IconButton, Tick, usePageKeys } from './Kit';
import { useNow } from './nav';
import { Fig, GlassButton, Page, Panel, Row } from './Page';
import { SHELL, useShellMetrics } from './layout';

const START = 5;
const END = 24;
const GUTTER = 56;
/** The all-day lane shows two rows a day, then "N more" (which opens the day). */
const LANE_ROWS = 2;
/** A block that cascades over an earlier one is indented this much per lane. */
const CASCADE = 12;
/** A block shows its time on a second line from this height. */
const TWO_LINES = 44;

type View_ = 'week' | 'month';

function monday(key: string): string {
  const day = parseKey(key).getDay();
  return addDays(key, -((day + 6) % 7));
}

const dayName = (key: string, style: 'short' | 'long') => parseKey(key).toLocaleDateString('en-GB', { weekday: style });
const dayMonth = (key: string) => {
  const d = parseKey(key);
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
};
const monthName = (key: string) => parseKey(key).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const firstOfMonth = (key: string) => `${key.slice(0, 8)}01`;
function shiftMonth(key: string, n: number): string {
  const d = parseKey(key);
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
}

interface AllDayItem {
  key: string;
  title: string;
  kind: Kind;
  done: boolean;
  open: () => void;
}

export function CalendarPage() {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const m = useShellMetrics();
  const shell = useShell();
  const { height } = useWindowDimensions();
  const { routines, inbox, groceries, gym, language, journal, today, updateRoutines } = useStore();
  const now = useNow();
  const [mode, setMode] = useState<View_>('week');
  const [week, setWeek] = useState(() => monday(today));
  const [month, setMonth] = useState(() => firstOfMonth(today));
  const hour = m.compact ? 44 : 48;
  const state = useMemo(() => ({ routines, inbox, groceries, gym, language }), [routines, inbox, groceries, gym, language]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const plans = useMemo(() => days.map((d) => dayPlan(state, d, today)), [days, state, today]);
  const weeks = useMemo(() => monthGrid(month), [month]);
  const monthDays = useMemo(() => weeks.flat().filter(Boolean) as string[], [weeks]);
  const monthPlans = useMemo(
    () => (mode === 'month' ? new Map(monthDays.map((d) => [d, dayPlan(state, d, today)])) : new Map<string, DayPlan>()),
    [mode, monthDays, state, today],
  );
  // Routines, to-dos, workouts and practice; the shopping list's lines are not things planned.
  const tallies =
    mode === 'week' ? days.map((d, i) => thingsPlanned(plans[i], d)) : monthDays.map((d) => thingsPlanned(monthPlans.get(d)!, d));
  const planned = tallies.reduce((n, t) => n + t.planned, 0);
  const done = tallies.reduce((n, t) => n + t.done, 0);

  const step = (n: number) => (mode === 'week' ? setWeek((w) => addDays(w, 7 * n)) : setMonth((x) => shiftMonth(x, n)));
  usePageKeys({ '[': () => step(-1), ']': () => step(1) });
  const atNow = mode === 'week' ? week === monday(today) : month === firstOfMonth(today);

  const openDay = (d: string) => router.navigate({ pathname: '/', params: { day: d } });

  const allDay = (i: number): AllDayItem[] => {
    const p = plans[i];
    const d = days[i];
    const out: AllDayItem[] = [];
    for (const r of p.anytime)
      out.push({
        key: r.id,
        title: r.target && r.target > 1 ? `${r.name} · ${r.target}` : r.name,
        kind: 'routines',
        done: isDoneOn(r, d),
        open: () => shell.open('routine', r),
      });
    if (p.session)
      out.push({ key: 'gym', title: p.session.name, kind: 'gym', done: d === today && p.gymDone, open: () => router.navigate('/gym') });
    if (p.showPractice)
      out.push({
        key: 'practice',
        title: `${practiceSubject(language.languages)} · ${p.practice.target} min`,
        kind: 'chinese',
        done: p.practiceDone,
        open: () => router.navigate('/language'),
      });
    if (p.groceries.length) {
      const left = p.groceries.filter((g) => !boughtOn(g, d)).length;
      out.push({
        key: 'groceries',
        title: left ? `Groceries · ${left}` : 'Groceries · all bought',
        kind: 'groceries',
        done: left === 0,
        open: () => router.navigate('/groceries'),
      });
    }
    for (const t of p.todos)
      out.push({ key: t.id, title: t.title, kind: 'inbox', done: !!t.doneOn, open: () => router.navigate('/inbox') });
    return out;
  };
  const lanes = days.map((_, i) => allDay(i));

  // The grid fills the window under the header, the day row, the all-day lane and the legend.
  const laneRows = Math.min(LANE_ROWS, Math.max(1, ...lanes.map((l) => l.length)));
  const laneH = 12 + laneRows * 30 + (lanes.some((l) => l.length > LANE_ROWS) ? 22 : 0);
  const gridH = Math.max(6 * hour, height - (m.pageTop + 12 + 94 + 2 * m.panelPad + 64 + laneH + 64 + 32));

  // The grid opens scrolled to two hours before now.
  const grid = useRef<ComponentRef<typeof ScrollView>>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    scrolled.current = false;
  }, [week, mode]);

  // Two hours before now, moved up while a block would be cut under the all-day lane. The grid's 10 dp top pad
  // keeps the hour's label in view above its line.
  const openAt = () => {
    let y = Math.max(0, (Math.floor(now / 60) - 2 - START) * hour);
    for (let moved = true; moved; ) {
      moved = false;
      for (const p of plans)
        for (const e of p.timed) {
          const top = ((Math.max(e.start, START * 60) - START * 60) / 60) * hour;
          const bottom = ((e.end - START * 60) / 60) * hour;
          if (top < y && bottom > y - 10) {
            y = top;
            moved = true;
          }
        }
    }
    return y;
  };

  const tick = (r: Routine, d: string) => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? tapRoutine(x, d) : x)));
  const newAt = (d: string, minute: number) =>
    shell.open('routine', undefined, {
      start: clock(minute),
      duration: 30,
      repeat: { kind: 'weekdays', days: [parseKey(d).getDay()] },
    });

  const span = mode === 'week' ? `${dayMonth(days[0])} to ${dayMonth(days[6])}` : monthName(month);
  const subtitle =
    planned === 0 ? (
      `${span} · Nothing planned this ${mode}.`
    ) : (
      <>
        {span} · <Fig>{planned}</Fig> {planned === 1 ? 'thing' : 'things'} planned
        {done > 0 ? (
          <>
            {' '}
            · <Fig>{done}</Fig> done so far
          </>
        ) : null}
      </>
    );

  return (
    <Page
      title="Calendar"
      subtitle={subtitle}
      actions={
        <>
          <View style={styles.switch}>
            <Segmented
              dense
              accessibilityLabel="Calendar view"
              value={mode}
              onChange={setMode}
              options={[
                { key: 'week', label: 'Week' },
                { key: 'month', label: 'Month' },
              ]}
            />
          </View>
          <IconButton icon="chevron-back" label={mode === 'week' ? 'Previous week' : 'Previous month'} onPress={() => step(-1)} />
          <GlassButton
            label={mode === 'week' ? 'This week' : 'This month'}
            onPress={() => (mode === 'week' ? setWeek(monday(today)) : setMonth(firstOfMonth(today)))}
            accessibilityLabel={atNow ? `${mode === 'week' ? 'This week' : 'This month'}, showing now` : undefined}
          />
          <IconButton icon="chevron-forward" label={mode === 'week' ? 'Next week' : 'Next month'} onPress={() => step(1)} />
        </>
      }
    >
      {mode === 'week' ? (
        <Row>
          <Panel span={12} index={0} style={styles.weekPane}>
            <View style={styles.headRow}>
              <View style={{ width: GUTTER }} />
              {days.map((d) => {
                const isToday = d === today;
                return (
                  <Hover
                    key={d}
                    onPress={() => openDay(d)}
                    outerStyle={styles.flex}
                    style={styles.dayHead}
                    radius={12}
                    role="link"
                    accessibilityLabel={`${dayName(d, 'long')} ${dayMonth(d)}${isToday ? ', today' : ''}. Open the day`}
                  >
                    <Text style={styles.dayName}>{dayName(d, 'short')}</Text>
                    <View style={[styles.dateDisc, isToday && { backgroundColor: colors.node }]}>
                      <Text style={[styles.date, isToday && { color: colors.onNode }]}>{parseKey(d).getDate()}</Text>
                    </View>
                  </Hover>
                );
              })}
            </View>
            <View style={[styles.lane, { borderColor: colors.border, minHeight: laneH }]}>
              <Text style={[styles.time, { width: GUTTER }]}>All day</Text>
              {days.map((d, i) => {
                const items = lanes[i];
                return (
                  <View key={d} style={styles.laneCol}>
                    {items.slice(0, LANE_ROWS).map((it) => (
                      <Hover
                        key={it.key}
                        onPress={it.open}
                        style={styles.chip}
                        radius={8}
                        accessibilityLabel={`${it.title}, ${dayName(d, 'long')}${it.done ? ', done' : ''}`}
                      >
                        <View style={[styles.dot, { backgroundColor: kinds[it.kind].color }]} />
                        <Text style={[styles.chipText, it.done && styles.doneText]} numberOfLines={1}>
                          {it.title}
                        </Text>
                      </Hover>
                    ))}
                    {items.length > LANE_ROWS ? (
                      <Hover
                        onPress={() => openDay(d)}
                        style={styles.more}
                        radius={8}
                        role="link"
                        accessibilityLabel={`${items.length - LANE_ROWS} more on ${dayName(d, 'long')}. Open the day`}
                      >
                        <Text style={styles.moreText}>{items.length - LANE_ROWS} more</Text>
                      </Hover>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <ScrollView
              ref={grid}
              style={{ height: gridH }}
              // Room above the first hour and below the last, so their labels are never cut.
              contentContainerStyle={styles.gridPad}
              onLayout={() => {
                if (scrolled.current) return;
                scrolled.current = true;
                grid.current?.scrollTo({ y: openAt(), animated: false });
              }}
            >
              <View style={{ height: (END - START) * hour, flexDirection: 'row' }}>
                <View style={{ width: GUTTER }}>
                  {Array.from({ length: END - START }, (_, h) => (
                    <Text key={h} style={[styles.time, styles.hourLabel, { top: h * hour }]}>
                      {String(START + h).padStart(2, '0')}:00
                    </Text>
                  ))}
                </View>
                {days.map((d, i) => (
                  <DayColumn
                    key={d}
                    date={d}
                    today={today}
                    now={now}
                    hour={hour}
                    plan={plans[i]}
                    onOpen={(r) => shell.open('routine', r)}
                    onTick={(r) => tick(r, d)}
                    onNew={(minute) => newAt(d, minute)}
                  />
                ))}
              </View>
            </ScrollView>
          </Panel>
        </Row>
      ) : (
        <Row>
          <Panel span={12} index={0}>
            <View style={styles.monthHead}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((n) => (
                <Text key={n} style={[styles.dayName, styles.monthDay]}>
                  {n}
                </Text>
              ))}
            </View>
            {weeks.map((w, wi) => (
              <View key={wi} style={[styles.monthRow, { borderColor: colors.border }]}>
                {w.map((d, di) =>
                  d ? (
                    <MonthCell
                      key={d}
                      date={d}
                      today={today}
                      plan={monthPlans.get(d)}
                      mood={moodOf(journal[d]?.mood)}
                      onOpen={() => openDay(d)}
                    />
                  ) : (
                    <View key={`blank-${di}`} style={styles.monthBlank} />
                  ),
                )}
              </View>
            ))}
          </Panel>
        </Row>
      )}
      <View style={styles.legend} accessibilityRole="text">
        {(
          [
            ['routines', 'Routines'],
            ['gym', 'Gym'],
            ['chinese', 'Language'],
            ['groceries', 'Groceries'],
            ['inbox', 'To-dos'],
          ] as [Kind, string][]
        ).map(([k, label]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: kinds[k].color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
        <Text style={styles.legendText}>
          {mode === 'week' ? 'Click an empty half hour to add a weekly routine there. ' : ''}Phone calendar events show in the Android app.
        </Text>
      </View>
    </Page>
  );
}

/** One day of the week grid: the hour lines, the empty half hours you can click, the now line and the blocks. */
function DayColumn({
  date,
  today,
  now,
  hour,
  plan,
  onOpen,
  onTick,
  onNew,
}: {
  date: string;
  today: string;
  now: number;
  hour: number;
  plan: DayPlan;
  onOpen: (r: Routine) => void;
  onTick: (r: Routine) => void;
  onNew: (minute: number) => void;
}) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const lanes = useMemo(() => cascadeOut(plan.timed), [plan.timed]);
  const future = date > today;
  // A block cascading over an earlier one is raised on the look's sheet colour, so the one under it doesn't show
  // through.
  const raised = colors.material.sheet.body[colors.material.sheet.body.length - 1];
  return (
    <View style={[styles.col, { borderColor: colors.border }]}>
      {Array.from({ length: END - START }, (_, h) => (
        <View key={h} style={[styles.hourLine, { top: h * hour, backgroundColor: colors.border }]} />
      ))}
      {Array.from({ length: (END - START) * 2 }, (_, s) => (
        <Slot key={s} top={(s * hour) / 2} height={hour / 2} minute={START * 60 + s * 30} onPress={onNew} />
      ))}
      {/* The now line runs under the blocks, so it always lies on the pane. */}
      {date === today && now >= START * 60 ? (
        <View style={[styles.nowLine, { top: ((now - START * 60) / 60) * hour, backgroundColor: colors.accent }]} pointerEvents="none">
          <View style={[styles.nowDot, { backgroundColor: colors.accent }]} />
        </View>
      ) : null}
      {plan.timed.map((e, i) => {
        const r = e.routine!;
        const top = ((Math.max(e.start, START * 60) - START * 60) / 60) * hour;
        const h = Math.max(24, ((e.end - e.start) / 60) * hour - 2);
        const isDone = isDoneOn(r, date);
        const skipped = isSkipped(r, date);
        const { lane, lanes: n, side } = lanes[i];
        const tall = h >= TWO_LINES && !future && !skipped;
        const when = `${clock(e.start)} · ${e.end - e.start} min`;
        const over = !side && lane > 0;
        const wash = washOf(kinds.routines.soft, SHELL.wash);
        return (
          <View
            key={e.id}
            style={[
              styles.blockAt,
              { top: top + 1, height: h, zIndex: lane },
              side ? { left: `${(lane / n) * 100}%`, width: `${100 / n}%` } : { left: lane * CASCADE, right: 0 },
            ]}
          >
            <Hover
              onPress={() => onOpen(r)}
              outerStyle={styles.flex}
              // A done or skipped block recedes to the plain inset, its title struck in muted ink (no opacity, so it stays readable).
              style={[
                styles.block,
                over && { backgroundColor: raised, boxShadow: colors.material.shadowFloat },
                !(isDone || skipped) && {
                  backgroundColor: over ? raised : wash,
                  backgroundImage: over ? `linear-gradient(${wash}, ${wash})` : undefined,
                  borderColor: alphaOf(kinds.routines.color, 0.5),
                  borderTopColor: alphaOf(kinds.routines.color, 0.5),
                },
              ]}
              radius={10}
              accessibilityLabel={`${e.title}, ${dayName(date, 'long')} ${when}${isDone ? ', done' : skipped ? ', skipped' : ''}. Edit`}
            >
              <View style={styles.blockRow}>
                <View style={[styles.dot, { backgroundColor: kinds.routines.color }]} />
                <Text style={[styles.blockTitle, (isDone || skipped) && styles.doneText, tall && styles.blockTitleTight]} numberOfLines={1}>
                  {e.title}
                </Text>
              </View>
              {h >= TWO_LINES ? (
                <Text style={styles.blockMeta} numberOfLines={1}>
                  {skipped ? `Skipped · ${when}` : when}
                </Text>
              ) : null}
            </Hover>
            {tall ? (
              <View style={styles.blockTick}>
                <Tick
                  done={isDone}
                  color={kinds.routines.color}
                  adds={!!r.target && r.target > 1 && !isDone}
                  label={`${e.title}, ${dayName(date, 'long')}, ${isDone ? 'done' : 'not done'}`}
                  onPress={() => onTick(r)}
                />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** An empty half hour: under the pointer it lights up and shows its time; a click starts a routine there. It is a
 *  pointer shortcut only (New, then Routine, does the same from the keyboard), so it stays out of the Tab order. */
function Slot({ top, height, minute, onPress }: { top: number; height: number; minute: number; onPress: (m: number) => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  // The light fades in and out like every other hover (120 ms in, 160 ms out).
  const lit = useSharedValue(0);
  const fade = useAnimatedStyle(() => ({ opacity: lit.get() }));
  return (
    <Pressable
      onPress={() => onPress(minute)}
      onHoverIn={() => lit.set(withTiming(1, { duration: 120, easing: EASE_OUT, ...FADE }))}
      onHoverOut={() => lit.set(withTiming(0, { duration: 160, easing: EASE_OUT, ...FADE }))}
      focusable={false}
      accessible={false}
      style={[styles.slot, { top, height }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.slotLight, { backgroundColor: colors.material.hover.fill, borderColor: colors.material.hover.rim }, fade]}
      >
        <Ionicons name="add" size={14} color={colors.muted} />
        <Text style={styles.slotText}>{clock(minute)}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** A day of the month: its date, a line of what it holds (or how it went), the kind dots and a past day's mood. */
function MonthCell({
  date,
  today,
  plan,
  mood,
  onOpen,
}: {
  date: string;
  today: string;
  plan?: DayPlan;
  mood?: (typeof MOODS)[number]['value'];
  onOpen: () => void;
}) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const isToday = date === today;
  const past = date < today;
  const kindsOn: Kind[] = [];
  if (plan) {
    if (plan.routines.length) kindsOn.push('routines');
    if (plan.session) kindsOn.push('gym');
    if (plan.showPractice) kindsOn.push('chinese');
    if (plan.groceries.length) kindsOn.push('groceries');
    if (plan.todos.length) kindsOn.push('inbox');
  }
  const line = !plan || plan.total === 0 ? '' : past || isToday ? `${plan.done} of ${plan.total} done` : `${plan.total} planned`;
  const moodLabel = mood ? MOODS[mood - 1].label : undefined;
  return (
    <Hover
      onPress={onOpen}
      outerStyle={styles.monthSlot}
      style={styles.monthCell}
      radius={12}
      role="link"
      accessibilityLabel={`${dayName(date, 'long')} ${dayMonth(date)}${isToday ? ', today' : ''}${line ? `, ${line}` : ''}${moodLabel ? `, mood ${moodLabel}` : ''}. Open the day`}
    >
      <View style={styles.monthTop}>
        <View style={[styles.monthDisc, isToday && { backgroundColor: colors.node }]}>
          <Text style={[styles.monthNum, past && !isToday && { color: colors.muted }, isToday && { color: colors.onNode }]}>
            {parseKey(date).getDate()}
          </Text>
        </View>
        {mood ? <MoodGlyph curve={MOODS[mood - 1].curve} color={colors.muted} size={22} /> : null}
      </View>
      {line ? (
        <Text style={styles.monthLine} numberOfLines={1}>
          {line}
        </Text>
      ) : null}
      <View style={styles.monthDots}>
        {kindsOn.map((k) => (
          <View key={k} style={[styles.dot, { backgroundColor: kinds[k].color }]} />
        ))}
      </View>
    </Hover>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    switch: { width: 184, justifyContent: 'center' },
    weekPane: { paddingBottom: 8 },
    headRow: { flexDirection: 'row', height: 64, alignItems: 'center' },
    dayHead: { alignItems: 'center', gap: 2, paddingVertical: 4 },
    dayName: { ...type.label },
    dateDisc: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    date: { fontFamily: fonts.bodyMedium, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] },
    lane: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 6 },
    laneCol: { flex: 1, gap: 4, paddingHorizontal: 3, minWidth: 0 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 6, height: 26, ...insetBox },
    chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.text, flex: 1 },
    doneText: { color: colors.muted, textDecorationLine: 'line-through' },
    more: { height: 22, justifyContent: 'center', paddingHorizontal: 4, alignSelf: 'flex-start' },
    moreText: { ...type.caption, color: colors.link },
    time: { ...type.caption, color: colors.label, fontVariant: ['tabular-nums'] },
    hourLabel: { position: 'absolute', left: 0, marginTop: -8 },
    gridPad: { paddingTop: 10, paddingBottom: 10 },
    col: { flex: 1, borderLeftWidth: 1 },
    hourLine: { position: 'absolute', left: 0, right: 0, height: 1 },
    slot: { position: 'absolute', left: 0, right: 0 },
    slotLight: {
      position: 'absolute',
      top: 1,
      left: 3,
      right: 3,
      bottom: 1,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 6,
    },
    slotText: { ...type.caption, color: colors.muted, fontVariant: ['tabular-nums'] },
    blockAt: { position: 'absolute', paddingHorizontal: 3 },
    block: { flex: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', ...insetBox },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    blockTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 18, color: colors.text, flex: 1 },
    blockTitleTight: { marginRight: 30 },
    blockMeta: { ...type.caption, color: colors.muted },
    blockTick: { position: 'absolute', top: -4, right: 0 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
    nowDot: { position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { ...type.small, color: colors.onSlabMuted },
    monthHead: { flexDirection: 'row', marginBottom: 8 },
    monthDay: { flex: 1, textAlign: 'center' },
    monthRow: { flexDirection: 'row', borderTopWidth: 1, gap: 4, paddingVertical: 4 },
    monthSlot: { flex: 1, minWidth: 0 },
    monthBlank: { flex: 1 },
    monthCell: { minHeight: 96, padding: 8, gap: 6, borderRadius: radii.inset },
    monthTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthDisc: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    monthNum: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
    monthLine: { ...type.caption, color: colors.muted },
    monthDots: { flexDirection: 'row', gap: 4 },
  });
};
