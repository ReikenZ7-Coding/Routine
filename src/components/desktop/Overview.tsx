// Overview: the desktop's home. Everything here is read from the store through the same sums Today uses
// (src/lib/day.ts); every panel says plainly when it has nothing to show, and a panel with nothing to say about
// a part of life that is not set up offers the one step that sets it up.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { type DayPlan, type Need, dayPlan, needsYou, nextUp, nextWorkout, weekSeries } from '../../lib/day';
import { formatWeight, isSetDone, sessionProgress, toggleSet, workingWeight } from '../../lib/gym';
import { toggleItem } from '../../lib/inbox';
import { addMinutes, currentLanguage, dueWords, practiceSubject } from '../../lib/language';
import { plural } from '../../lib/plural';
import { type Routine, countOn, iconFor, isDoneOn, isSkipped, tapRoutine } from '../../lib/routines';
import { WEEKDAY_SHORT, boughtOn, parseKey } from '../../lib/schedule';
import { SOUNDS, useSounds } from '../../lib/sounds';
import { dayStreak, weekStats } from '../../lib/stats';
import { clock } from '../../lib/timeline';
import { useStore } from '../../lib/store';
import { type Kind, type Theme, useStyles, useTheme } from '../../theme';
import { Glass } from '../Glass';
import { Bar, EASE_OUT, useReduceMotion } from '../Motion';
import { SoundArt } from '../NowPlaying';
import { Segmented } from '../Segmented';
import { useShell } from './api';
import { Hover } from './Hover';
import { useFade } from './Kit';
import { useShellMetrics } from './layout';
import { greeting, longDate, useNow } from './nav';
import { Fig, FootLink, GlassButton, OpenButton, Page, Panel, PrimaryButton, Row } from './Page';

const TRAIL_ROWS = 6;
const NEED_ROWS = 5;
/** The week chart: the gym's scale starts at a usual session's sets; the bars stand this far above the chart's
 *  foot (the day letter under each); the axis labels take this much on the left. */
const GYM_FLOOR = 9;
const BAR_FOOT = 30;
const AXIS = 56;
/** The day line runs from 05:00 to midnight. */
const DAY_START = 5 * 60;
const DAY_END = 24 * 60;
/** The day line's band: its height, and the inset that keeps 05:00 and midnight (and their labels) inside it. */
const BAND = 44;
/** Steps closer than this on the band share one node, with their count. */
const MERGE = 16;
/** The steps after the next one that the hero lists under it. */
const THEN_ROWS = 2;

export function Overview() {
  const { routines, inbox, groceries, gym, language, settings, today } = useStore();
  const shell = useShell();
  const now = useNow();
  const state = useMemo(() => ({ routines, inbox, groceries, gym, language }), [routines, inbox, groceries, gym, language]);
  const plan = useMemo(() => dayPlan(state, today, today), [state, today]);
  const needs = useMemo(() => needsYou(state, today, now), [state, today, now]);
  const next = nextUp(plan, today, now);
  const studying = currentLanguage(language);
  const due = studying ? dueWords(language, today, studying.id).length : 0;
  const name = settings.name.trim() || 'friend';
  const allDone = plan.total > 0 && plan.done === plan.total;
  const streak = useMemo(() => dayStreak(routines, today), [routines, today]);
  // A new install: nothing is here yet, because the phone keeps its own copy.
  const fresh = !routines.length && !inbox.length && !groceries.length && !gym.sessions.length && !language.languages.length;

  // "Monday 2 November · 1 of 11 done · Stretch is up next at 21:00 · 2 words to review."
  const facts: React.ReactNode[] = [longDate(today)];
  if (fresh) facts.push('Nothing on this computer yet.');
  else if (plan.total === 0) facts.push('A clear day so far.');
  else if (allDone)
    facts.push(
      <Text key="all">
        Every step done.{streak > 1 ? ' ' : ''}
        {streak > 1 ? (
          <>
            <Fig>{plural(streak, 'day')}</Fig> in a row.
          </>
        ) : null}
      </Text>,
    );
  else {
    facts.push(
      <Text key="done">
        <Fig>
          {plan.done} of {plan.total}
        </Fig>{' '}
        done
      </Text>,
    );
    if (next)
      facts.push(
        next.state === 'now' ? (
          <Text key="next">
            <Fig>{next.entry.title}</Fig> is happening now
          </Text>
        ) : (
          <Text key="next">
            <Fig>{next.entry.title}</Fig> is up next at <Fig>{clock(next.entry.start)}</Fig>
          </Text>
        ),
      );
    if (due > 0)
      facts.push(
        <Text key="due">
          <Fig>{plural(due, 'word')}</Fig> to review
        </Text>,
      );
  }
  const subtitle = facts.map((f, i) => (
    <Text key={i}>
      {i > 0 ? ' · ' : ''}
      {f}
    </Text>
  ));

  return (
    <Page
      title={`${greeting(Math.floor(now / 60))}, ${name}`}
      label="Overview"
      subtitle={
        <>
          {subtitle}
          {!allDone && plan.total > 0 ? '.' : ''}
        </>
      }
      actions={
        <>
          <GlassButton label="Your week" icon="stats-chart-outline" onPress={() => shell.open('stats')} />
          <GlassButton label="Open today" icon="today-outline" onPress={() => router.navigate('/')} />
        </>
      }
    >
      {fresh ? (
        <Row match>
          <Welcome />
          <Starters />
        </Row>
      ) : (
        <>
          <Row match>
            <Hero plan={plan} next={next} allDone={allDone} today={today} now={now} />
            <NeedsPanel needs={needs} />
          </Row>
          <Row match>
            <TrailPanel plan={plan} today={today} />
            <AgendaPanel plan={plan} now={now} today={today} />
          </Row>
          <Row match>
            <WeekPanel />
            <GroceriesPanel plan={plan} />
          </Row>
          <Row match>
            <GymPanel plan={plan} />
            <LanguagePanel plan={plan} due={due} />
          </Row>
        </>
      )}
    </Page>
  );
}

// ----------------------------------------------------------------------------------------------------------
// A new install: the phone keeps its own copy, so the first thing offered is bringing it across.

function Welcome() {
  const { fonts, type } = useTheme();
  const styles = useStyles(makeStyles);
  const shell = useShell();
  return (
    <Panel span={8} index={0} tier="hero" bloom>
      <View style={styles.heroTop}>
        <View style={styles.heroMain}>
          <Text style={styles.heroMeta}>New on this computer</Text>
          <Text style={[styles.heroTitle, { fontFamily: fonts.display }]} role="heading" aria-level={2}>
            Bring your days across
          </Text>
          <Text style={type.body}>
            Your phone keeps its own copy. To bring everything across, export a backup from Settings on your phone and restore it here. Or
            start fresh with a routine or a to-do.
          </Text>
          <View style={styles.heroButtons}>
            <PrimaryButton label="Restore from a backup" icon="archive-outline" onPress={() => shell.open('backup')} />
            <GlassButton label="Add a routine" icon="repeat" onPress={() => shell.open('routine')} />
            <GlassButton label="Add a to-do" icon="checkbox-outline" onPress={() => shell.open('todo')} />
          </View>
        </View>
        <NowPlayingWell />
      </View>
    </Panel>
  );
}

/** The parts of life that each start with one step: one short list instead of three empty panels. */
function Starters() {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const shell = useShell();
  const rows: { key: string; icon: string; kind: Kind; title: string; meta: string; go: () => void }[] = [
    {
      key: 'gym',
      icon: 'barbell-outline',
      kind: 'gym',
      title: 'Gym plan',
      meta: 'Sessions for the days you train',
      go: () => router.navigate('/gym'),
    },
    {
      key: 'language',
      icon: 'language-outline',
      kind: 'chinese',
      title: 'Language practice',
      meta: 'Words to learn, a few minutes a day',
      go: () => router.navigate('/language'),
    },
    {
      key: 'groceries',
      icon: 'basket-outline',
      kind: 'groceries',
      title: 'Groceries',
      meta: 'A list sorted by aisle',
      go: () => shell.open('grocery'),
    },
  ];
  return (
    <Panel span={4} index={1} title="Set up the rest">
      {rows.map((r) => (
        <Hover key={r.key} onPress={r.go} style={styles.rowMainHit} radius={12} accessibilityLabel={`${r.title}, ${r.meta}`}>
          <View style={styles.pebble}>
            <Ionicons name={r.icon as 'add'} size={20} color={kinds[r.kind].text} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {r.title}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={2}>
              {r.meta}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Hover>
      ))}
    </Panel>
  );
}

// ----------------------------------------------------------------------------------------------------------
// Row 1: Up next and Now playing, with the day line.

function Hero({
  plan,
  next,
  allDone,
  today,
  now,
}: {
  plan: DayPlan;
  next: ReturnType<typeof nextUp>;
  allDone: boolean;
  today: string;
  now: number;
}) {
  const { fonts, type } = useTheme();
  const styles = useStyles(makeStyles);
  const shell = useShell();
  const { updateRoutines } = useStore();
  const step = next?.entry.routine;
  const tick = () => step && updateRoutines((rs) => rs.map((r) => (r.id === step.id ? tapRoutine(r, today) : r)));
  // What follows the next step, so the card says how the rest of the day runs.
  const then = next
    ? plan.timed
        .filter(
          (e) => e.id !== next.entry.id && e.start >= next.entry.start && !isDoneOn(e.routine!, today) && !isSkipped(e.routine!, today),
        )
        .slice(0, THEN_ROWS)
    : [];
  return (
    <Panel span={8} index={0} tier="hero" bloom style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroMain}>
          {step && next ? (
            <>
              <Text style={styles.heroMeta}>{next.line}</Text>
              <Text style={[styles.heroTitle, { fontFamily: fonts.display }]} numberOfLines={2} role="heading" aria-level={2}>
                {step.name}
              </Text>
              <Text style={type.small}>
                Routine{step.duration ? ` · ${step.duration} min` : ''}
                {step.target && step.target > 1 ? ` · ${countOn(step, today)} of ${step.target}` : ''}
              </Text>
              <View style={styles.heroButtons}>
                <GlassButton
                  label={step.target && step.target > 1 ? 'Count one' : 'Tick off'}
                  icon="checkmark"
                  onPress={tick}
                  accessibilityLabel={step.target && step.target > 1 ? `Count one ${step.name}` : `Tick off ${step.name}`}
                />
                <GlassButton label="Open today" onPress={() => router.navigate('/')} />
              </View>
              {then.length ? (
                <View style={styles.then}>
                  <Text style={styles.heroMeta}>Then</Text>
                  {then.map((e) => (
                    <View key={e.id} style={styles.thenRow}>
                      <Text style={styles.thenTime}>{clock(e.start)}</Text>
                      <Text style={styles.thenTitle} numberOfLines={1}>
                        {e.title}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : allDone ? (
            <>
              <Text style={styles.heroMeta}>Today</Text>
              <Text style={[styles.heroTitle, { fontFamily: fonts.display }]} role="heading" aria-level={2}>
                Trail complete
              </Text>
              <Text style={type.small}>Every step of today is done. Nothing more is asked of you today.</Text>
            </>
          ) : plan.total > 0 ? (
            <>
              <Text style={styles.heroMeta}>Nothing with a time is coming up</Text>
              <Text style={[styles.heroTitle, { fontFamily: fonts.display }]} role="heading" aria-level={2}>
                {plural(plan.total - plan.done, 'step')} still open
              </Text>
              <Text style={type.small}>Anytime steps, to-dos and the rest of today are on Today.</Text>
              <View style={styles.heroButtons}>
                <GlassButton label="Open today" onPress={() => router.navigate('/')} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heroMeta}>Today</Text>
              <Text style={[styles.heroTitle, { fontFamily: fonts.display }]} role="heading" aria-level={2}>
                A clear day
              </Text>
              <Text style={type.small}>Nothing is planned for today yet.</Text>
              <View style={styles.heroButtons}>
                <GlassButton label="Add a routine" icon="repeat" onPress={() => shell.open('routine')} />
                <GlassButton label="Add a to-do" icon="checkbox-outline" onPress={() => shell.open('todo')} />
              </View>
            </>
          )}
        </View>
        <NowPlayingWell />
      </View>
      {plan.timed.length > 0 && !allDone ? <DayLine plan={plan} now={now} today={today} /> : null}
    </Panel>
  );
}

function NowPlayingWell() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const sounds = useSounds();
  const { current, playing, started } = sounds;
  return (
    <View style={styles.well}>
      <Text style={styles.wellLabel}>Now playing</Text>
      {started ? (
        <>
          <View style={styles.wellRow}>
            <SoundArt size={64} id={current.kind === 'sound' ? current.id : undefined} track={current.kind === 'track'} radius={14} />
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {current.name}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={2}>
                {playing ? current.subtitle : `Paused · ${current.subtitle}`}
              </Text>
            </View>
          </View>
          <View style={styles.wellButtons}>
            <Hover
              onPress={sounds.toggle}
              squeeze
              style={styles.round}
              accessibilityLabel={playing ? `Pause ${current.name}` : `Play ${current.name}`}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={20} color={colors.text} />
            </Hover>
            <Hover onPress={() => sounds.skip(1)} squeeze style={styles.round} accessibilityLabel="Next">
              <Ionicons name="play-skip-forward" size={18} color={colors.text} />
            </Hover>
            <View style={styles.flex} />
            <Hover
              onPress={() => router.navigate('/music')}
              role="link"
              style={styles.linkPill}
              radius={18}
              accessibilityLabel="Open music"
            >
              <Text style={styles.link}>Open music</Text>
            </Hover>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.rowTitle}>Nothing playing</Text>
          <Text style={styles.rowMeta}>A focus sound keeps the room quiet.</Text>
          <View style={styles.tiles}>
            {SOUNDS.map((s) => (
              <Hover
                key={s.id}
                onPress={() => sounds.play(s.id)}
                style={styles.tile}
                outerStyle={styles.flex}
                radius={12}
                squeeze
                accessibilityLabel={`Play ${s.name}`}
              >
                <Ionicons name={s.icon} size={18} color={colors.text} />
                <Text style={styles.tileText} numberOfLines={2}>
                  {s.name}
                </Text>
              </Hover>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

/** The day from 05:00 to midnight as a band: the hours already gone tinted up to now, each timed step a trail
 *  node on it (steps closer than MERGE dp share one node with their count), and the now marker with its time. */
function DayLine({ plan, now, today }: { plan: DayPlan; now: number; today: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [w, setW] = useState(0);
  const [tip, setTip] = useState<string | null>(null);
  const [tipShown, tipStyle] = useFade(tip);
  // The axis is inset by half the band, so 05:00 and midnight sit inside its round ends with their labels.
  const x = (min: number) =>
    BAND / 2 + ((Math.max(DAY_START, Math.min(DAY_END, min)) - DAY_START) / (DAY_END - DAY_START)) * Math.max(1, w - BAND);
  const ticks = [5, 8, 11, 14, 17, 20, 23];
  const next = nextUp(plan, today, now);
  const groups: { key: string; x: number; entries: DayPlan['timed'] }[] = [];
  for (const e of plan.timed) {
    const last = groups[groups.length - 1];
    if (last && x(e.start) - x(last.entries[last.entries.length - 1].start) < MERGE) {
      last.entries.push(e);
      last.key += `+${e.id}`;
      last.x = (x(last.entries[0].start) + x(e.start)) / 2;
    } else groups.push({ key: e.id, x: x(e.start), entries: [e] });
  }
  const shown = groups.find((g) => g.key === tipShown);
  const nowX = x(now);
  // The band is the look's track; on Pine, whose track is a light tint, its slab trough, so the light nodes keep
  // their contrast on it.
  const band = colors.material.canopy?.inset.fill ?? colors.track;
  return (
    <View style={styles.dayLine} onLayout={(e) => setW(e.nativeEvent.layout.width)} aria-label="Today's timed steps">
      {w > 0 ? (
        <>
          <View style={[styles.band, { backgroundColor: band }]} />
          {now > DAY_START ? <View style={[styles.past, { width: Math.min(w, nowX), backgroundColor: band }]} /> : null}
          {/* An hour's label gives way to the now marker's time where the two would overlap. */}
          {ticks
            .filter((h) => now < DAY_START || Math.abs(x(h * 60) - nowX) > 44)
            .map((h) => (
              <Text key={h} style={[styles.hour, { left: x(h * 60) - 20 }]}>
                {String(h).padStart(2, '0')}:00
              </Text>
            ))}
          {now >= DAY_START ? (
            // The marker wears the text ink, like its time: the accent is too faint on Lavender's hero.
            <View style={[styles.now, { left: nowX - 1, backgroundColor: colors.text }]} pointerEvents="none">
              <Text style={[styles.nowText, { color: colors.text }]}>{clock(now)}</Text>
            </View>
          ) : null}
          {groups.map((g) => {
            const states = g.entries.map((e) => ({
              done: isDoneOn(e.routine!, today),
              skipped: isSkipped(e.routine!, today),
              lit: next?.entry.id === e.id,
            }));
            const done = states.every((st) => st.done);
            const lit = states.some((st) => st.lit);
            const skipped = !done && !lit && states.every((st) => st.skipped || st.done);
            const many = g.entries.length > 1;
            const label = g.entries
              .map(
                (e, i) =>
                  `${e.title}, ${clock(e.start)}, ${states[i].done ? 'done' : states[i].skipped ? 'skipped' : states[i].lit ? 'up next' : 'ahead'}`,
              )
              .join('; ');
            return (
              <Pressable
                key={g.key}
                onHoverIn={() => setTip(g.key)}
                onHoverOut={() => setTip((t) => (t === g.key ? null : t))}
                onFocus={() => setTip(g.key)}
                onBlur={() => setTip((t) => (t === g.key ? null : t))}
                onPress={() => router.navigate('/')}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={[styles.nodeHit, { left: g.x - 16 }]}
              >
                <View
                  style={[
                    many ? styles.nodeMany : styles.node,
                    done
                      ? { backgroundColor: colors.node, borderColor: colors.node }
                      : lit
                        ? { backgroundColor: colors.nodeCurrentFill, borderColor: colors.node, borderWidth: 3 }
                        : {
                            backgroundColor: colors.nodeAheadFill,
                            borderColor: colors.nodeAhead,
                            borderStyle: skipped ? 'dashed' : 'solid',
                          },
                  ]}
                >
                  {many ? <Text style={[styles.nodeCount, { color: done ? colors.onNode : colors.text }]}>{g.entries.length}</Text> : null}
                </View>
              </Pressable>
            );
          })}
          {shown ? (
            <Animated.View
              style={[styles.tip, { left: Math.max(0, Math.min(w - 220, shown.x - 110)) }, tipStyle]}
              pointerEvents="none"
              aria-hidden
            >
              <Glass tier="sheet" topOnly={false} radius={12} style={styles.tipGlass}>
                {shown.entries.map((e) => (
                  <Text key={e.id} style={styles.tipText} numberOfLines={1}>
                    {e.title} · {clock(e.start)}
                  </Text>
                ))}
              </Glass>
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function NeedsPanel({ needs }: { needs: Need[] }) {
  const styles = useStyles(makeStyles);
  const [all, setAll] = useState(false);
  const shown = all ? needs : needs.slice(0, NEED_ROWS);
  return (
    <Panel span={4} index={1} title="Needs you" subtitle={needs.length ? 'Most urgent first' : undefined}>
      <View role="complementary" aria-label="Needs you">
        {needs.length === 0 ? (
          <Text style={styles.empty}>Nothing needs you right now.</Text>
        ) : (
          <>
            {shown.map((n) => (
              <NeedRow key={n.key} need={n} />
            ))}
            {needs.length > NEED_ROWS ? (
              <FootLink label={all ? 'Show fewer' : `Show all ${needs.length}`} onPress={() => setAll((a) => !a)} />
            ) : null}
          </>
        )}
      </View>
    </Panel>
  );
}

const KIND_OF: Record<Need['kind'], Kind> = {
  routines: 'routines',
  inbox: 'inbox',
  chinese: 'chinese',
  gym: 'gym',
  groceries: 'groceries',
};
const ROUTE_OF: Record<Need['to'], '/' | '/inbox' | '/language' | '/gym' | '/groceries'> = {
  today: '/',
  inbox: '/inbox',
  language: '/language',
  gym: '/gym',
  groceries: '/groceries',
};

function NeedRow({ need }: { need: Need }) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  // A compact window gives a name two lines rather than cutting it.
  const lines = useShellMetrics().compact ? 2 : 1;
  const { updateRoutines, updateInbox, today } = useStore();
  const ink = kinds[KIND_OF[need.kind]].text;
  const tick = need.tick
    ? () => {
        if (need.tick?.routine) updateRoutines((rs) => rs.map((r) => (r.id === need.tick!.routine ? tapRoutine(r, today) : r)));
        if (need.tick?.todo) updateInbox((items) => items.map((i) => (i.id === need.tick!.todo ? toggleItem(i, today) : i)));
      }
    : undefined;
  return (
    <View style={styles.row}>
      <Hover
        onPress={() => router.navigate(ROUTE_OF[need.to])}
        style={styles.rowMainHit}
        outerStyle={styles.flex}
        radius={12}
        accessibilityLabel={`${need.title}, ${need.meta}`}
      >
        <View style={styles.pebble}>
          <Ionicons name={need.icon as 'add'} size={20} color={ink} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle} numberOfLines={lines}>
            {need.title}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={lines}>
            {need.meta}
          </Text>
        </View>
        {!tick ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
      </Hover>
      {tick ? (
        <Hover
          onPress={tick}
          style={styles.tickHit}
          radius={20}
          accessibilityLabel={`Tick off ${need.title}`}
          role="checkbox"
          aria={{ 'aria-checked': false }}
        >
          <View style={[styles.tick, { borderColor: colors.controlBorder }]} />
        </Hover>
      ) : null}
    </View>
  );
}

// ----------------------------------------------------------------------------------------------------------
// Row 2: Today's trail and Calendar today.

interface TrailItem {
  key: string;
  icon: string;
  kind: Kind;
  title: string;
  meta: string;
  done: boolean;
  skipped?: boolean;
  onTick?: () => void;
  count?: { value: number; target: number };
  to?: '/gym' | '/language' | '/groceries';
}

function useTrail(plan: DayPlan, today: string): TrailItem[] {
  const { updateRoutines, updateInbox, language } = useStore();
  const items: TrailItem[] = [];
  const tickRoutine = (r: Routine) => () => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? tapRoutine(x, today) : x)));
  for (const e of plan.timed) {
    const r = e.routine!;
    items.push({
      key: r.id,
      icon: iconFor(r),
      kind: 'routines',
      title: r.name,
      meta: `${clock(e.start)}${r.duration ? ` · ${r.duration} min` : ''}`,
      done: isDoneOn(r, today),
      skipped: isSkipped(r, today),
      onTick: tickRoutine(r),
      count: r.target && r.target > 1 ? { value: countOn(r, today), target: r.target } : undefined,
    });
  }
  for (const r of plan.anytime) {
    items.push({
      key: r.id,
      icon: iconFor(r),
      kind: 'routines',
      title: r.name,
      meta: r.target && r.target > 1 ? `${countOn(r, today)} of ${r.target} · any time` : 'Any time',
      done: isDoneOn(r, today),
      skipped: isSkipped(r, today),
      onTick: tickRoutine(r),
      count: r.target && r.target > 1 ? { value: countOn(r, today), target: r.target } : undefined,
    });
  }
  for (const t of plan.todos)
    items.push({
      key: t.id,
      icon: 'checkbox-outline',
      kind: 'inbox',
      title: t.title,
      meta: 'To-do',
      done: !!t.doneOn,
      onTick: () => updateInbox((all) => all.map((i) => (i.id === t.id ? toggleItem(i, today) : i))),
    });
  if (plan.session && plan.gym)
    items.push({
      key: 'gym',
      icon: 'barbell-outline',
      kind: 'gym',
      title: plan.session.name,
      meta: `${plan.gym.done} of ${plural(plan.gym.total, 'set')}`,
      done: plan.gymDone,
      to: '/gym',
    });
  if (plan.showPractice)
    items.push({
      key: 'practice',
      icon: 'language-outline',
      kind: 'chinese',
      title: `${practiceSubject(language.languages)} practice`,
      meta: `${plan.practice.minutes} of ${plan.practice.target} min`,
      done: plan.practiceDone,
      to: '/language',
    });
  if (plan.groceries.length) {
    const left = plan.groceries.filter((g) => !boughtOn(g, today)).length;
    items.push({
      key: 'groceries',
      icon: 'basket-outline',
      kind: 'groceries',
      title: 'Groceries',
      meta: left ? `${left} to buy` : 'All bought',
      done: left === 0,
      to: '/groceries',
    });
  }
  return items;
}

function TrailPanel({ plan, today }: { plan: DayPlan; today: string }) {
  const styles = useStyles(makeStyles);
  const items = useTrail(plan, today);
  const more = items.length - TRAIL_ROWS;
  return (
    <Panel
      span={8}
      index={2}
      title="Today's trail"
      subtitle={items.length ? `${plan.done} of ${plan.total} done` : undefined}
      right={<OpenButton label="Open today" onPress={() => router.navigate('/')} />}
    >
      {items.length === 0 ? (
        <Text style={styles.empty}>Nothing on today's trail. Add a routine or a to-do with New, and it starts here.</Text>
      ) : (
        <>
          {items.slice(0, TRAIL_ROWS).map((it) => (
            <TrailRow key={it.key} item={it} />
          ))}
          {more > 0 ? <FootLink label={`Open today · ${more} more`} onPress={() => router.navigate('/')} /> : null}
        </>
      )}
    </Panel>
  );
}

function TrailRow({ item }: { item: TrailItem }) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const k = kinds[item.kind];
  const receded = item.done || item.skipped;
  const state = item.skipped ? 'skipped' : item.done ? 'done' : item.count ? `${item.count.value} of ${item.count.target}` : 'not done';
  const body = (
    <>
      <View style={[styles.pebble, receded && styles.receded]}>
        <Ionicons name={item.icon as 'add'} size={20} color={k.text} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, receded && { color: colors.muted }, item.done && styles.struck]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.skipped ? `Skipped · ${item.meta}` : item.meta}
        </Text>
      </View>
    </>
  );
  if (item.to)
    return (
      <Hover
        onPress={() => router.navigate(item.to!)}
        style={styles.trailRow}
        radius={12}
        accessibilityLabel={`${item.title}, ${item.meta}${item.done ? ', done' : ''}`}
      >
        {body}
        {item.done ? (
          <Ionicons name="checkmark" size={18} color={colors.text} />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        )}
      </Hover>
    );
  return (
    <View style={styles.trailRow}>
      {body}
      <Hover
        onPress={item.onTick}
        style={styles.tickHit}
        radius={20}
        role="checkbox"
        aria={{ 'aria-checked': item.done }}
        accessibilityLabel={`${item.title}, ${state}`}
        disabled={item.skipped}
      >
        <View style={[styles.tick, { borderColor: colors.controlBorder }, item.done && { backgroundColor: k.color, borderColor: k.color }]}>
          {item.done ? (
            <Ionicons name="checkmark" size={16} color={colors.onKind} />
          ) : item.count ? (
            <Text style={styles.count}>{item.count.value}</Text>
          ) : null}
        </View>
      </Hover>
    </View>
  );
}

function AgendaPanel({ plan, now, today }: { plan: DayPlan; now: number; today: string }) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = useStore();
  const before = plan.timed.filter((e) => e.start < now);
  const after = plan.timed.filter((e) => e.start >= now);
  const anytime: { key: string; title: string; kind: Kind; done: boolean }[] = [
    ...plan.anytime.map((r) => ({ key: r.id, title: r.name, kind: 'routines' as Kind, done: isDoneOn(r, today) })),
    ...plan.todos.map((t) => ({ key: t.id, title: t.title, kind: 'inbox' as Kind, done: !!t.doneOn })),
    ...(plan.session ? [{ key: 'gym', title: plan.session.name, kind: 'gym' as Kind, done: plan.gymDone }] : []),
    ...(plan.showPractice
      ? [
          {
            key: 'practice',
            title: `${practiceSubject(language.languages)} · ${plan.practice.target} min`,
            kind: 'chinese' as Kind,
            done: plan.practiceDone,
          },
        ]
      : []),
    ...(plan.groceries.length
      ? [
          {
            key: 'groceries',
            title: `Groceries · ${plan.groceries.length}`,
            kind: 'groceries' as Kind,
            done: plan.groceries.every((g) => boughtOn(g, today)),
          },
        ]
      : []),
  ];
  const line = (e: (typeof plan.timed)[number]) => {
    const done = isDoneOn(e.routine!, today);
    return (
      <View key={e.id} style={styles.agendaRow} accessible accessibilityLabel={`${clock(e.start)}, ${e.title}${done ? ', done' : ''}`}>
        <Text style={styles.agendaTime}>{clock(e.start)}</Text>
        <View style={[styles.dot, { backgroundColor: kinds.routines.color }]} />
        <Text style={[styles.agendaTitle, done && { color: colors.muted }]} numberOfLines={1}>
          {e.title}
        </Text>
        {done ? <Ionicons name="checkmark" size={16} color={colors.text} /> : null}
      </View>
    );
  };
  return (
    <Panel
      span={4}
      index={3}
      title="Calendar today"
      right={<OpenButton label="Open calendar" onPress={() => router.navigate('/calendar')} />}
    >
      {plan.timed.length === 0 ? <Text style={styles.empty}>Nothing with a time today.</Text> : null}
      {before.map(line)}
      {plan.timed.length > 0 ? (
        <View style={styles.nowRow} accessible accessibilityLabel={`Now, ${clock(now)}`}>
          <Text style={[styles.nowLabel, { color: colors.text }]}>Now · {clock(now)}</Text>
          <View style={[styles.nowRule, { backgroundColor: colors.accent }]} />
        </View>
      ) : null}
      {after.map(line)}
      {anytime.length ? (
        <>
          <Text style={styles.groupLabel}>Any time</Text>
          {anytime.map((a) => (
            <View key={a.key} style={styles.agendaRow} accessible accessibilityLabel={`${a.title}${a.done ? ', done' : ''}`}>
              <View style={[styles.dot, { backgroundColor: kinds[a.kind].color, marginLeft: 0 }]} />
              <Text style={[styles.agendaTitle, a.done && { color: colors.muted }]} numberOfLines={1}>
                {a.title}
              </Text>
              {a.done ? <Ionicons name="checkmark" size={16} color={colors.text} /> : null}
            </View>
          ))}
        </>
      ) : null}
    </Panel>
  );
}

// ----------------------------------------------------------------------------------------------------------
// Row 3: Your week and Groceries to buy.

type Series = 'routines' | 'gym' | 'practice';

/** The week chart: Overview's panel, and larger on the Your week page (`tall`). */
export function WeekPanel({ span = 8, index = 4, tall = false }: { span?: number; index?: number; tall?: boolean } = {}) {
  const { kinds, colors, type } = useTheme();
  const trackH = tall ? 280 : 160;
  const styles = useStyles(makeStyles);
  const shell = useShell();
  const { routines, gym, language, today } = useStore();
  const [series, setSeries] = useState<Series>('routines');
  const days = useMemo(() => weekSeries({ routines, gym, language }, today), [routines, gym, language, today]);
  const s = useMemo(() => weekStats(routines, gym, language, today), [routines, gym, language, today]);
  const any = days.some((d) => d.planned || d.sets || d.minutes);
  const pct = s.routinesPlanned ? Math.round((100 * s.routinesDone) / s.routinesPlanned) : null;
  const target = language.target;
  // The gym's scale has a floor of a usual session's sets, so one set is not a full bar.
  const max =
    series === 'gym'
      ? Math.max(GYM_FLOOR, ...days.map((d) => d.sets))
      : series === 'practice'
        ? Math.max(target, ...days.map((d) => d.minutes))
        : 1;
  const grid = [0, 0.5, 1].map((f) => ({
    f,
    label:
      series === 'routines' ? `${Math.round(f * 100)}%` : `${Math.round(f * max)}${f === 1 ? (series === 'gym' ? ' sets' : ' min') : ''}`,
  }));
  const dash = `repeating-linear-gradient(90deg, ${colors.border} 0px, ${colors.border} 4px, transparent 4px, transparent 8px)`;
  const value = (d: (typeof days)[number]) =>
    series === 'routines' ? (d.planned ? d.done / d.planned : 0) : series === 'gym' ? d.sets / max : d.minutes / max;
  const fill = series === 'routines' ? kinds.routines.color : series === 'gym' ? kinds.gym.color : kinds.chinese.color;
  const say = (d: (typeof days)[number]) => {
    const day = parseKey(d.date).toLocaleDateString('en-GB', { weekday: 'long' });
    if (series === 'routines') return d.planned ? `${day} · ${d.done} of ${plural(d.planned, 'routine')}` : `${day} · nothing planned`;
    if (series === 'gym') return `${day} · ${plural(d.sets, 'set')}`;
    return `${day} · ${d.minutes} of ${target} min`;
  };
  return (
    <Panel
      span={span}
      index={index}
      title={tall ? 'The last 7 days' : 'Your week'}
      subtitle={tall ? 'Hover or focus a day for its numbers' : 'The last 7 days'}
      right={
        <Segmented
          dense
          accessibilityLabel="Series"
          value={series}
          onChange={setSeries}
          options={[
            { key: 'routines', label: 'Routines' },
            { key: 'gym', label: 'Gym' },
            { key: 'practice', label: 'Practice' },
          ]}
        />
      }
    >
      {!any ? (
        <Text style={styles.empty}>Your week fills in as you tick things off.</Text>
      ) : (
        <>
          <View style={[styles.chart, { height: trackH + 40 }]}>
            {grid.map((g) => (
              <View key={g.f} style={[styles.gridRow, { bottom: BAR_FOOT + g.f * trackH - 8 }]} pointerEvents="none">
                <Text style={styles.axisText}>{g.label}</Text>
                <View style={[styles.gridLine, { backgroundImage: dash }]} />
              </View>
            ))}
            {series === 'practice' ? (
              <View
                style={[styles.targetLine, { bottom: BAR_FOOT + (target / max) * trackH, borderColor: colors.label }]}
                pointerEvents="none"
              />
            ) : null}
            <View style={styles.bars}>
              {days.map((d, i) => (
                <WeekBar
                  key={`${series}-${d.date}`}
                  value={value(d)}
                  index={i}
                  fill={fill}
                  label={say(d)}
                  today={d.date === today}
                  letter={WEEKDAY_SHORT[parseKey(d.date).getDay()][0]}
                  trackH={trackH}
                  onPress={tall ? undefined : () => shell.open('stats')}
                />
              ))}
            </View>
          </View>
          {tall ? null : (
            <Text style={[type.body, styles.weekSentence]}>
              {pct === null ? 'No routines were planned' : `${pct}% of routines done`}, {plural(s.gymDays, 'gym day')} and{' '}
              {s.practiceMinutes}
              {' '}min of {practiceSubject(language.languages)} practice.
            </Text>
          )}
        </>
      )}
    </Panel>
  );
}

function WeekBar({
  value,
  index,
  fill,
  label,
  today,
  letter,
  trackH,
  onPress,
}: {
  value: number;
  index: number;
  fill: string;
  label: string;
  today: boolean;
  letter: string;
  trackH: number;
  /** Overview's bars open Your week; the Your week page's own bars only show their numbers. */
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const h = useSharedValue(reduced ? value : 0);
  const [hover, setHover] = useState(false);
  const [tip, fade] = useFade(hover ? label : null);
  useEffect(() => {
    h.set(reduced ? withTiming(value, { duration: 150 }) : withDelay(index * 40, withTiming(value, { duration: 600, easing: EASE_OUT })));
  }, [value, index, reduced, h]);
  const bar = useAnimatedStyle(() => ({ height: `${Math.max(0, Math.min(1, h.get())) * 100}%` }));
  return (
    <Pressable
      style={styles.barCol}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={onPress ? `${label}. Open your week` : label}
    >
      {tip ? (
        <Animated.View
          style={[styles.barHover, { backgroundColor: colors.material.hover.fill, borderColor: colors.material.hover.rim }, fade]}
          pointerEvents="none"
        />
      ) : null}
      <View style={[styles.barTrack, { backgroundColor: colors.track, height: trackH, width: trackH > 160 ? 40 : 28 }]}>
        <Animated.View style={[styles.barFill, { backgroundColor: fill }, bar]} />
      </View>
      <View style={[styles.dayDisc, today && { backgroundColor: colors.primary }]}>
        <Text style={[styles.dayLetter, today && { color: colors.onPrimary }]}>{letter}</Text>
      </View>
      {tip ? (
        <Animated.View style={[styles.barTip, fade]} pointerEvents="none" aria-hidden>
          <Glass tier="sheet" topOnly={false} radius={12} style={styles.tipGlass}>
            <Text style={styles.tipText} numberOfLines={1}>
              {tip}
            </Text>
          </Glass>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function GroceriesPanel({ plan }: { plan: DayPlan }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { toggleBought, today } = useStore();
  const left = plan.groceries.filter((g) => !boughtOn(g, today));
  const aisles = new Map<string, typeof left>();
  for (const g of left) aisles.set(g.aisle || 'Other', [...(aisles.get(g.aisle || 'Other') ?? []), g]);
  return (
    <Panel
      span={4}
      index={5}
      title="Groceries to buy"
      subtitle={left.length ? `${left.length} today` : undefined}
      right={<OpenButton label="Open groceries" onPress={() => router.navigate('/groceries')} />}
    >
      {left.length === 0 ? (
        <Text style={styles.empty}>{plan.groceries.length ? 'All bought for today.' : 'Nothing to buy today.'}</Text>
      ) : (
        [...aisles].map(([aisle, items]) => (
          <View key={aisle}>
            <Text style={styles.groupLabel}>{aisle}</Text>
            {items.map((g) => (
              <Hover
                key={g.id}
                onPress={() => toggleBought(g.id)}
                style={styles.checkRow}
                radius={12}
                role="checkbox"
                aria={{ 'aria-checked': false }}
                accessibilityLabel={`${g.name}${g.quantity ? `, ${g.quantity}` : ''}, to buy`}
              >
                <View style={[styles.box, { borderColor: colors.controlBorder }]} />
                <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
                  {g.name}
                </Text>
                {g.quantity ? <Text style={styles.rowMeta}>{g.quantity}</Text> : null}
              </Hover>
            ))}
          </View>
        ))
      )}
    </Panel>
  );
}

// ----------------------------------------------------------------------------------------------------------
// Row 4: Gym today and Language practice.

function GymPanel({ plan }: { plan: DayPlan }) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { gym, updateGym, today } = useStore();
  const session = plan.session;
  const after = nextWorkout(gym, today);
  return (
    <Panel
      span={6}
      index={6}
      title="Gym today"
      subtitle={session && plan.gym ? `${session.name} · ${plan.gym.done} of ${plural(plan.gym.total, 'set')}` : undefined}
      right={<OpenButton label="Open gym" onPress={() => router.navigate('/gym')} />}
    >
      {!gym.sessions.length ? (
        <>
          <Text style={styles.empty}>No gym plan yet.</Text>
          <GlassButton label="Set up a plan" onPress={() => router.navigate('/gym')} />
        </>
      ) : !session ? (
        <Text style={styles.empty}>
          Rest day.
          {after ? ` Next: ${after.name} on ${parseKey(after.date).toLocaleDateString('en-GB', { weekday: 'long' })}.` : ''}
        </Text>
      ) : (
        <>
          <Bar
            progress={plan.gym ? plan.gym.done / Math.max(1, plan.gym.total) : 0}
            color={kinds.gym.color}
            track={colors.track}
            height={8}
          />
          <View style={styles.gap8} />
          {session.exercises.map((ex) => {
            const weight = workingWeight(gym, today, session, ex);
            return (
              <View key={ex.id} style={styles.exRow}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {ex.sets} × {ex.reps}
                    {weight ? ` · ${formatWeight(weight)}` : ''}
                  </Text>
                </View>
                <View style={styles.sets}>
                  {Array.from({ length: ex.sets }, (_, i) => {
                    const done = isSetDone(gym, today, session.id, ex.id, i);
                    return (
                      <Hover
                        key={i}
                        onPress={() => updateGym((g) => toggleSet(g, today, session, ex, i, weight))}
                        style={styles.setHit}
                        radius={18}
                        role="checkbox"
                        aria={{ 'aria-checked': done }}
                        accessibilityLabel={`${ex.name}, set ${i + 1}`}
                      >
                        <View
                          style={[
                            styles.set,
                            { borderColor: colors.controlBorder },
                            done && { backgroundColor: kinds.gym.color, borderColor: kinds.gym.color },
                          ]}
                        >
                          <Text style={[styles.setText, done && { color: colors.onKind }]}>{i + 1}</Text>
                        </View>
                      </Hover>
                    );
                  })}
                </View>
              </View>
            );
          })}
          {sessionProgress(gym, today, session).total === 0 ? <Text style={styles.empty}>This session has no exercises yet.</Text> : null}
        </>
      )}
    </Panel>
  );
}

function LanguagePanel({ plan, due }: { plan: DayPlan; due: number }) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language, updateLanguage, today } = useStore();
  const studying = currentLanguage(language);
  const { minutes, target } = plan.practice;
  return (
    <Panel
      span={6}
      index={7}
      title={studying ? `${studying.name} practice` : 'Language practice'}
      subtitle={studying ? `${minutes} of ${target} min today` : undefined}
      right={<OpenButton label="Open language" onPress={() => router.navigate('/language')} />}
    >
      {!studying ? (
        <>
          <Text style={styles.empty}>Pick a language to start practising.</Text>
          <GlassButton label="Choose a language" onPress={() => router.navigate('/language')} />
        </>
      ) : (
        <>
          <Bar progress={minutes / Math.max(1, target)} color={kinds.chinese.color} track={colors.track} height={8} />
          <View style={styles.minutes}>
            {[5, 10, 15].map((n) => (
              <GlassButton
                key={n}
                label={`+${n}`}
                accessibilityLabel={`Log ${n} minutes`}
                onPress={() => updateLanguage((l) => addMinutes(l, today, n))}
              />
            ))}
          </View>
          <View style={styles.reviewRow}>
            <Text style={[styles.rowTitle, styles.flex]}>{due ? `${plural(due, 'word')} to review` : 'No words to review today'}</Text>
            {due ? <GlassButton label="Review" onPress={() => router.navigate('/language')} /> : null}
          </View>
          <FootLink
            label="Start a 15 min focus"
            onPress={() => router.navigate('/language')}
            accessibilityLabel="Start a 15 minute focus, on the Language page"
          />
        </>
      )}
    </Panel>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    gap8: { height: 12 },
    empty: { ...type.body, color: colors.muted, marginBottom: 12 },
    hero: { gap: 24 },
    heroTop: { flexDirection: 'row', gap: 20, alignItems: 'stretch' },
    heroMain: { flex: 3, minWidth: 0, gap: 6 },
    heroMeta: { ...type.label },
    heroTitle: { fontSize: 32, lineHeight: 38, color: colors.text, letterSpacing: -0.4 },
    heroButtons: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    then: { marginTop: 18, gap: 2 },
    thenRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 26 },
    thenTime: { ...type.caption, color: colors.label, width: 44, fontVariant: ['tabular-nums'] },
    thenTitle: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.text },
    well: { flex: 2, minWidth: 0, borderRadius: radii.inset, padding: 16, gap: 8, ...insetBox },
    wellLabel: { ...type.label },
    wellRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    wellButtons: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...insetBox },
    linkPill: { height: 36, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 18 },
    link: { ...type.link, textDecorationLine: 'none', fontSize: 15 },
    tiles: { flexDirection: 'row', gap: 8, marginTop: 6 },
    tile: {
      flex: 1,
      minHeight: 64,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      ...insetBox,
    },
    tileText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 18, color: colors.text, textAlign: 'center' },
    dayLine: { height: BAND + 24, marginTop: 'auto' },
    band: { position: 'absolute', left: 0, right: 0, top: 0, height: BAND, borderRadius: BAND / 2 },
    past: { position: 'absolute', left: 0, top: 0, height: BAND, borderTopLeftRadius: BAND / 2, borderBottomLeftRadius: BAND / 2 },
    hour: {
      position: 'absolute',
      top: BAND + 6,
      width: 40,
      textAlign: 'center',
      ...type.caption,
      color: colors.label,
      fontVariant: ['tabular-nums'],
    },
    now: { position: 'absolute', top: 0, width: 2, height: BAND, borderRadius: 1 },
    nowText: {
      position: 'absolute',
      top: BAND + 6,
      left: -20,
      width: 42,
      textAlign: 'center',
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      fontVariant: ['tabular-nums'],
    },
    nodeHit: {
      position: 'absolute',
      top: (BAND - 32) / 2,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
    },
    node: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
    nodeMany: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    nodeCount: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 13, fontVariant: ['tabular-nums'] },
    tip: { position: 'absolute', bottom: BAND + 8, width: 220, alignItems: 'center' },
    tipGlass: { paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
    tipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 56 },
    rowMainHit: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 8, marginLeft: -8 },
    pebble: { width: 40, height: 40, borderRadius: radii.inset, alignItems: 'center', justifyContent: 'center', ...insetBox },
    receded: { opacity: 0.6 },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowMeta: { ...type.small },
    struck: { textDecorationLine: 'line-through' },
    tickHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    count: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text, fontVariant: ['tabular-nums'] },
    trailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 8, marginHorizontal: -8 },
    agendaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
    agendaTime: { ...type.caption, color: colors.label, width: 44, fontVariant: ['tabular-nums'] },
    agendaTitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.text, flex: 1 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    nowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
    nowLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
    nowRule: { flex: 1, height: 2, borderRadius: 1 },
    groupLabel: { ...type.label, marginTop: 14, marginBottom: 4 },
    chart: { height: 200 },
    bars: { position: 'absolute', left: AXIS, right: 0, top: 0, bottom: 0, flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
    gridRow: { position: 'absolute', left: 0, right: 0, height: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
    axisText: { width: AXIS - 8, textAlign: 'right', ...type.caption, color: colors.label, fontVariant: ['tabular-nums'] },
    gridLine: { flex: 1, height: 1 },
    targetLine: { position: 'absolute', left: AXIS, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
    barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderRadius: 8 },
    barHover: { position: 'absolute', top: 0, left: -4, right: -4, bottom: 0, borderRadius: 8, borderWidth: 1 },
    barTrack: { width: 28, height: 160, borderRadius: 8, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: 28, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
    dayDisc: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    dayLetter: { ...type.caption, color: colors.label },
    barTip: { position: 'absolute', top: -8, width: 220, alignItems: 'center', zIndex: 2 },
    weekSentence: { marginTop: 14 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 8, marginHorizontal: -8 },
    box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2 },
    exRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
    sets: { flexDirection: 'row', gap: 2 },
    setHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    set: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    setText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.text, fontVariant: ['tabular-nums'] },
    minutes: { flexDirection: 'row', gap: 8, marginTop: 14 },
    reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, minHeight: 44 },
  });
};
