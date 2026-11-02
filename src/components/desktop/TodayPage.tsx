// Today on the desktop: the phone's trail (the streak pill, the trail of steps and its hint) in a column on the
// bare world, and beside it the month with its marks and moods, the Balance rings and the day's note. The same
// steps, sums and words as the phone's Today (lib/day and trailItems); another day is one press or Ctrl+[ away.
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { marksFor } from '../../lib/agenda';
import { dayPlan, nextUp } from '../../lib/day';
import { toggleItem } from '../../lib/inbox';
import { moodOf } from '../../lib/journal';
import { dueWords } from '../../lib/language';
import { tapRoutine } from '../../lib/routines';
import { addDays, parseKey } from '../../lib/schedule';
import { useSounds } from '../../lib/sounds';
import { dayStreak } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { CalendarStrip } from '../CalendarStrip';
import { DayNote } from '../DayNote';
import { BalanceRings, TrailHome } from '../TrailHome';
import { balanceRings, trailItems } from '../trailItems';
import { useShell } from './api';
import { IconButton, usePageKeys } from './Kit';
import { greeting, longDate, useNow } from './nav';
import { Column, Fig, GlassButton, Page, Panel, Row } from './Page';

const NO_EVENTS = new Set<string>();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function TodayPage() {
  const { kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, routines, inbox, groceries, gym, language, journal, settings, updateRoutines, updateInbox } = useStore();
  const sounds = useSounds();
  const shell = useShell();
  const now = useNow();
  const params = useLocalSearchParams<{ day?: string }>();
  const [selected, setSelected] = useState(today);
  useEffect(() => setSelected(today), [today]);
  // The calendar's month opens a day here (/?day=2026-11-03).
  useEffect(() => {
    if (params.day && DATE.test(params.day)) setSelected(params.day);
  }, [params.day]);
  // While another day is on screen, New's to-do goes on that day and the breadcrumbs name it.
  const focused = useIsFocused();
  const { setDay } = shell;
  useEffect(() => {
    setDay(focused && selected !== today ? selected : undefined);
  }, [focused, selected, today, setDay]);
  const step = useCallback((n: number) => setSelected((d) => addDays(d, n)), []);
  usePageKeys({ '[': () => step(-1), ']': () => step(1) });

  const state = useMemo(() => ({ routines, inbox, groceries, gym, language }), [routines, inbox, groceries, gym, language]);
  const plan = useMemo(() => dayPlan(state, selected, today), [state, selected, today]);
  const isToday = selected === today;
  const isFuture = selected > today;
  const next = isToday ? nextUp(plan, today, now) : undefined;
  const toReview = dueWords(language, today).length;
  const streak = useMemo(() => dayStreak(routines, today), [routines, today]);
  const marks = useCallback(
    (d: string) => marksFor({ groceries, gym, language, routines }, d, today),
    [groceries, gym, language, routines, today],
  );
  const moodFor = useCallback((d: string) => moodOf(journal[d]?.mood), [journal]);

  const items = trailItems(plan, { selected, today }, language, kinds, toReview, {
    tap: (r) => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? tapRoutine(x, selected) : x))),
    edit: (r) => shell.open('routine', r),
    toggleTodo: (id) => updateInbox((all) => all.map((x) => (x.id === id ? toggleItem(x, selected) : x))),
    gym: () => router.navigate('/gym'),
    language: () => router.navigate('/language'),
    groceries: () => router.navigate('/groceries'),
    more: true,
  });

  // "Monday 2 November · 1 of 11 done" (the streak has its own pill on the trail)
  const facts: React.ReactNode[] = [longDate(selected)];
  if (plan.total === 0) facts.push(isFuture ? 'Nothing planned yet.' : 'A clear day so far.');
  else if (isFuture)
    facts.push(
      <Text key="planned">
        <Fig>{plan.total}</Fig> planned
      </Text>,
    );
  else
    facts.push(
      <Text key="done">
        <Fig>
          {plan.done} of {plan.total}
        </Fig>{' '}
        done
      </Text>,
    );

  const month = parseKey(selected).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <Page
      title={isToday ? 'Today' : longDate(selected)}
      subtitle={facts.map((f, i) => (
        <Text key={i}>
          {i > 0 ? ' · ' : ''}
          {f}
        </Text>
      ))}
      actions={
        <>
          <IconButton icon="chevron-back" label="Previous day" onPress={() => step(-1)} />
          {isToday ? null : <GlassButton label="Back to today" icon="return-down-back" onPress={() => setSelected(today)} />}
          <IconButton icon="chevron-forward" label="Next day" onPress={() => step(1)} />
        </>
      }
    >
      <Row>
        <Column span={7}>
          <View style={styles.trail}>
            <TrailHome
              only="trail"
              name={settings.name || 'friend'}
              greeting={greeting(Math.floor(now / 60))}
              dateLabel={longDate(selected)}
              isToday={isToday}
              streak={streak}
              done={plan.done}
              total={plan.total}
              items={items}
              nextKey={next?.entry.routine?.id}
              nextLabel={next?.line}
              balance={[]}
              calendarOpen={false}
              onToggleCalendar={() => {}}
              calendar={null}
              topInset={0}
              soundsPlaying={sounds.playing}
              onSounds={() => router.navigate('/music')}
              onStats={() => router.navigate('/stats')}
              onSettings={() => router.navigate('/settings')}
              onAdd={() => shell.open('todo')}
              hint={
                isFuture
                  ? 'This day is still ahead. Click a routine to change it, and tick things off on the day.'
                  : 'Click a step to tick it off. The button at the end of a routine edits it.'
              }
            />
          </View>
        </Column>
        <Column span={5}>
          <Panel span={5} index={1} title={month} subtitle="Dots mark what each day holds">
            <View style={styles.month}>
              <CalendarStrip
                selected={selected}
                today={today}
                expanded
                busy={NO_EVENTS}
                marksFor={marks}
                moodFor={moodFor}
                onSelect={setSelected}
              />
            </View>
          </Panel>
          <Panel
            span={5}
            index={2}
            title="Balance"
            subtitle={isToday ? 'Routines, gym sets and practice today' : 'Routines, gym sets and practice'}
          >
            <View style={styles.rings}>
              <BalanceRings balance={balanceRings(plan, selected, language, kinds)} />
            </View>
          </Panel>
          {isFuture ? null : (
            <Panel span={5} index={3} title={isToday ? 'How was today?' : 'How it went'}>
              <DayNote date={selected} isToday={isToday} bare />
            </Panel>
          )}
        </Column>
      </Row>
    </Page>
  );
}

const makeStyles = (_: Theme) =>
  StyleSheet.create({
    // The phone's column keeps its own measure: cards stop at 720 wide.
    trail: { maxWidth: 720, marginTop: -4 },
    month: { marginTop: -20, marginHorizontal: -8 },
    rings: { marginHorizontal: -16, marginVertical: -18 },
  });
