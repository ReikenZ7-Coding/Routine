import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassScroll } from '../components/Glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackupSheet } from '../components/BackupSheet';
import { CalendarStrip } from '../components/CalendarStrip';
import { Button } from '../components/Button';
import { DayNote } from '../components/DayNote';
import { Field, Input } from '../components/Field';
import { GroceryForm } from '../components/GroceryForm';
import { RoutineForm } from '../components/RoutineForm';
import { SettingsSheet } from '../components/SettingsSheet';
import { Sheet } from '../components/Sheet';
import { StatsSheet } from '../components/StatsSheet';
import { type TrailItem, TrailHome } from '../components/TrailHome';
import { balanceRings, trailItems } from '../components/trailItems';
import { WordForm } from '../components/WordForm';
import { marksFor, monthGrid, weekOf } from '../lib/agenda';
import { currentLanguage, dueWords, newWord } from '../lib/language';
import { type PhoneEvent, formatEventTime, phoneEventsByDay } from '../lib/deviceCalendar';
import { dayPlan } from '../lib/day';
import { nextSession } from '../lib/gym';
import { toggleItem } from '../lib/inbox';
import { moodOf } from '../lib/journal';
import { type Routine, isScheduled, isSkipped, tapRoutine, toggleSkip } from '../lib/routines';
import { friendlyDate, parseKey } from '../lib/schedule';
import { useSounds } from '../lib/sounds';
import { dayStreak } from '../lib/stats';
import { newId, useStore } from '../lib/store';
import { type TimedEntry, clock, upNext } from '../lib/timeline';
import { Fab, useFabScroll } from '../components/Fab';
import { useDesktop } from '../components/desktop/context';
import { TodayPage } from '../components/desktop/TodayPage';
import { Chevron, Press } from '../components/Motion';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { type Theme, useStyles, useTheme } from '../theme';

type Panel = 'stats' | 'settings' | 'backup' | 'add' | 'routine' | 'todo' | 'grocery' | 'word' | null;

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** A non-breaking space: a number never leaves its unit, and a phrase like "in 15 h 43 min" never splits. */
const NB = '\u00a0';

function formatLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${NB}min`;
  return m === 0 ? `${h}${NB}h` : `${h}${NB}h${NB}${m}${NB}min`;
}

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** Today: the trail in a column on the phone, the desktop's Today page in the shell. */
export default function TodayRoute() {
  return useDesktop().on ? <TodayPage /> : <TodayScreen />;
}

function TodayScreen() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const store = useStore();
  const contentBottom = useContentBottom(true);
  const fab = useFabScroll();
  const {
    ready,
    today,
    groceries,
    toggleBought,
    addGrocery,
    gym,
    language,
    updateLanguage,
    routines,
    updateRoutines,
    settings,
    journal,
    inbox,
    updateInbox,
  } = store;
  const sounds = useSounds();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(today);
  const [expanded, setExpanded] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [events, setEvents] = useState<Record<string, PhoneEvent[]>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<Routine | undefined>();
  const [todo, setTodo] = useState('');
  const [todoError, setTodoError] = useState<string | undefined>();
  const [now, setNow] = useState(minutesNow());

  useEffect(() => setSelected(today), [today]);
  // A link to a desktop page that the phone has as a sheet (Settings, Your week) lands here and opens it.
  const params = useLocalSearchParams<{ open?: string }>();
  useEffect(() => {
    if (params.open === 'settings' || params.open === 'stats') setPanel(params.open);
  }, [params.open]);
  useEffect(() => {
    const t = setInterval(() => setNow(minutesNow()), 30000);
    return () => clearInterval(t);
  }, []);

  // Phone calendar events for whatever is on screen (a week or a month).
  const visible = useMemo(
    () => (expanded ? (monthGrid(selected).flat().filter(Boolean) as string[]) : weekOf(selected)),
    [expanded, selected],
  );
  const rangeKey = `${visible[0]}_${visible[visible.length - 1]}`;
  useEffect(() => {
    if (!settings.calendarConnected) return setEvents({});
    const start = parseKey(visible[0]);
    const end = parseKey(visible[visible.length - 1]);
    end.setDate(end.getDate() + 1);
    phoneEventsByDay(start, end)
      .then(setEvents)
      .catch(() => setEvents({}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.calendarConnected, rangeKey]);

  const dayState = { groceries, gym, language, routines };
  const marks = useCallback((d: string) => marksFor(dayState, d, today), [groceries, gym, language, routines, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = useMemo(() => new Set(Object.keys(events)), [events]);
  const moodFor = useCallback((d: string) => moodOf(journal[d]?.mood), [journal]);

  if (!ready) {
    return <Skeleton label="Loading your day" />;
  }

  const isToday = selected === today;
  const isPast = selected < today;
  const isFuture = selected > today;
  const date = parseKey(selected);

  // The day's things and its sums, shared with the desktop Overview and the sidebar's counts (lib/day).
  const plan = dayPlan({ routines, inbox, groceries, gym, language }, selected, today);
  const { timed } = plan;
  const dayEvents = events[selected] ?? [];
  const eventEntries: TimedEntry[] = dayEvents
    .filter((e) => !e.allDay)
    .map((e) => ({
      id: `ev-${e.id}`,
      title: e.title,
      start: e.start.getHours() * 60 + e.start.getMinutes(),
      end: Math.max(e.start.getHours() * 60 + e.start.getMinutes() + 5, e.end.getHours() * 60 + e.end.getMinutes()),
      event: { color: e.color },
    }));
  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timeline = [...timed, ...eventEntries].sort((a, b) => a.start - b.start);
  const next = isToday ? upNext(timed, today, now) : undefined;

  const session = plan.session;
  const upcoming = session ? undefined : nextSession(gym, selected);
  const studying = currentLanguage(language);
  const toReview = dueWords(language, today).length;
  const { done, total } = plan;

  const replace = (r: Routine) => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? r : x)));
  const tap = (r: Routine) => replace(tapRoutine(r, selected));
  const edit = (r?: Routine) => {
    setEditing(r);
    setPanel('routine');
  };
  const close = () => {
    setTodoError(undefined);
    setPanel(null);
  };
  const live = editing && routines.find((r) => r.id === editing.id);

  const addTodo = () => {
    const title = todo.trim();
    if (!title) return setTodoError('Write what you want to do first.');
    updateInbox((items) => [{ id: newId(), title, date: selected, createdAt: new Date().toISOString() }, ...items]);
    setTodo('');
    close();
  };

  const calendar = (
    <View>
      <View style={styles.dateRow}>
        <Press
          style={styles.dateTitle}
          onPress={() => setExpanded((e) => !e)}
          accessibilityLabel={expanded ? 'Show the week' : 'Show the whole month'}
          accessibilityState={{ expanded }}
        >
          <Text style={styles.dateText}>
            {date.getDate()} {date.toLocaleDateString('en', { month: 'long' })}
          </Text>
          <Chevron open={expanded} color={colors.text} />
        </Press>
        {!isToday && (
          <Press style={styles.todayButton} overlay={colors.material.pressFill} onPress={() => setSelected(today)}>
            <Ionicons name="return-down-back" size={16} color={colors.text} />
            <Text style={styles.todayButtonText}>Back to today</Text>
          </Press>
        )}
      </View>
      <CalendarStrip
        selected={selected}
        today={today}
        expanded={expanded}
        busy={busy}
        marksFor={marks}
        moodFor={moodFor}
        onSelect={setSelected}
      />
    </View>
  );

  // The day's things in one list: routines, to-dos, then the workout, practice and shopping, so the trail
  // matches the progress count.
  const items: TrailItem[] = trailItems(plan, { selected, today }, language, kinds, toReview, {
    tap,
    edit,
    toggleTodo: (id) => updateInbox((items) => items.map((x) => (x.id === id ? toggleItem(x, selected) : x))),
    gym: () => router.navigate('/gym'),
    language: () => router.navigate('/language'),
    groceries: () => router.navigate({ pathname: '/library', params: { shelf: 'groceries' } }),
  });

  return (
    <View style={styles.flex}>
      <GlassScroll
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: contentBottom }]}
        onScroll={fab.onScroll}
      >
        <TrailHome
          name={settings.name || 'friend'}
          greeting={greeting(Math.floor(now / 60))}
          dateLabel={
            isToday
              ? `Today, ${date.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })}`
              : date.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' })
          }
          isToday={isToday}
          streak={dayStreak(routines, today)}
          done={done}
          total={total}
          items={items}
          nextKey={next?.entry.routine?.id}
          nextLabel={
            next
              ? next.state === 'now'
                ? `Happening now${NB}· ${formatLeft(next.minutes)}${NB}left`
                : `Up next${NB}· ${clock(next.entry.start)}${NB}· in${NB}${formatLeft(next.minutes)}`
              : undefined
          }
          balance={balanceRings(plan, selected, language, kinds)}
          calendarOpen={calendarOpen}
          onToggleCalendar={() => setCalendarOpen((o) => !o)}
          calendar={calendar}
          topInset={insets.top + 16}
          soundsPlaying={sounds.playing}
          onSounds={() => sounds.setSheetOpen(true)}
          onStats={() => setPanel('stats')}
          onSettings={() => setPanel('settings')}
          onAdd={() => setPanel('add')}
        />

        {!isFuture && <DayNote date={selected} isToday={isToday} />}
      </GlassScroll>

      <Fab onPress={() => setPanel('add')} accessibilityLabel="Add a routine, to-do, grocery item or word" hidden={fab.hidden} />

      <Sheet visible={panel === 'add'} title="Add" onClose={close}>
        {(
          [
            ['routine', 'repeat', 'Routine', 'Something you do regularly, with a time', kinds.routines.text],
            [
              'todo',
              'checkbox',
              'To-do',
              `A one-off task for ${isToday ? 'today' : friendlyDate(selected, today).toLowerCase()}`,
              kinds.inbox.text,
            ],
            ['grocery', 'basket', 'Grocery item', 'Goes on your shopping list', kinds.groceries.text],
            studying
              ? (['word', 'language', `${studying.name} word`, 'A new flashcard to practise', kinds.chinese.text] as const)
              : (['word', 'language', 'A language', 'Pick one to learn, with flashcards', kinds.chinese.text] as const),
          ] as const
        ).map(([key, icon, title, sub, ink]) => (
          <Press
            key={key}
            style={styles.addRow}
            overlay={colors.material.pressFill}
            onPress={() => {
              if (key === 'routine') return edit();
              // Before a language is chosen, the word row leads to the tab's chooser.
              if (key === 'word' && !studying) {
                close();
                return router.navigate('/language');
              }
              setPanel(key);
            }}
            accessibilityLabel={`${title}. ${sub}`}
          >
            <View style={styles.addPebble}>
              <Ionicons name={icon} size={20} color={ink} />
            </View>
            <View style={styles.flex}>
              <Text style={type.bodyMedium}>{title}</Text>
              <Text style={type.small}>{sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Press>
        ))}
      </Sheet>
      <Sheet visible={panel === 'todo'} title="New to-do" onClose={close}>
        <Field label={`To-do for ${isToday ? 'today' : friendlyDate(selected, today).toLowerCase()}`} error={todoError}>
          <Input
            value={todo}
            onChangeText={(t) => {
              setTodo(t);
              setTodoError(undefined);
            }}
            onSubmitEditing={addTodo}
            invalid={!!todoError}
            placeholder="Call Mum, book the dentist…"
            autoFocus
            returnKeyType="done"
            accessibilityLabel="New to-do"
          />
        </Field>
        <Button
          label={`Add for ${isToday ? 'today' : friendlyDate(selected, today).toLowerCase()}`}
          onPress={addTodo}
          style={styles.saveButton}
        />
      </Sheet>
      <RoutineForm
        visible={panel === 'routine'}
        routine={editing}
        onClose={close}
        onSave={(f) => {
          updateRoutines((rs) =>
            editing ? rs.map((r) => (r.id === editing.id ? { ...r, ...f } : r)) : [...rs, { ...f, id: newId(), doneDates: [] }],
          );
          close();
        }}
        skippedToday={!!live && isSkipped(live, today)}
        onSkip={
          live && isScheduled(live, today)
            ? () => {
                replace(toggleSkip(live, today));
                close();
              }
            : undefined
        }
        onDelete={
          editing
            ? () => {
                updateRoutines((rs) => rs.filter((r) => r.id !== editing.id));
                close();
              }
            : undefined
        }
      />
      <GroceryForm
        visible={panel === 'grocery'}
        onClose={close}
        onSave={(g) => {
          addGrocery(g);
          close();
        }}
      />
      <WordForm
        visible={panel === 'word'}
        language={studying}
        onClose={close}
        onSave={(f) => {
          if (studying)
            updateLanguage((l) => ({ ...l, words: [...l.words, newWord(newId(), f.hanzi, f.pinyin, f.meaning, studying.id, today)] }));
          close();
        }}
      />
      <StatsSheet visible={panel === 'stats'} onClose={close} />
      <SettingsSheet visible={panel === 'settings'} onClose={close} onBackup={() => setPanel('backup')} />
      <BackupSheet visible={panel === 'backup'} onClose={close} />
    </View>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16 },
    flex: { flex: 1 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
      paddingHorizontal: 8,
    },
    dateTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
    dateText: { fontFamily: fonts.display, fontSize: 22, color: colors.text, letterSpacing: -0.5 },
    todayButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      minHeight: 44,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    todayButtonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 56,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: radii.inset,
    },
    addPebble: {
      width: 44,
      height: 44,
      borderRadius: radii.inset,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    saveButton: { marginTop: 20 },
    label: type.label,
  });
