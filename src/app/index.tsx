import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GlassScroll } from '../components/Glass';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassHome } from '../components/GlassHome';
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
import { WordForm } from '../components/WordForm';
import { marksFor, monthGrid, weekOf } from '../lib/agenda';
import { dueWords, newWord, todaysLog } from '../lib/chinese';
import { type PhoneEvent, formatEventTime, phoneEventsByDay } from '../lib/deviceCalendar';
import { nextSession, sessionFor, sessionProgress } from '../lib/gym';
import { itemsFor, toggleItem } from '../lib/inbox';
import { moodOf } from '../lib/journal';
import { type Routine, countOn, iconFor, isDoneOn, isScheduled, isSkipped, sortByTime, tapRoutine, toggleSkip } from '../lib/routines';
import { boughtOn, friendlyDate, isOnList, parseKey } from '../lib/schedule';
import { useSounds } from '../lib/sounds';
import { dayStreak } from '../lib/stats';
import { newId, useStore } from '../lib/store';
import { type TimedEntry, clock, timedRoutines, upNext } from '../lib/timeline';
import { Fab } from '../components/Fab';
import { Chevron, Press } from '../components/Motion';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { plural } from '../lib/plural';
import { type Theme, useStyles, useTheme } from '../theme';

type Panel = 'stats' | 'settings' | 'backup' | 'add' | 'routine' | 'todo' | 'grocery' | 'word' | null;

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatLeft(minutes: number): string {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function TodayScreen() {
  const theme = useTheme();
  const { colors, kinds, type } = theme;
  const styles = useStyles(makeStyles);
  const store = useStore();
  const contentBottom = useContentBottom(!theme.glass);
  const {
    ready,
    today,
    groceries,
    toggleBought,
    addGrocery,
    gym,
    chinese,
    updateChinese,
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

  const dayState = { groceries, gym, chinese, routines };
  const marks = useCallback((d: string) => marksFor(dayState, d, today), [groceries, gym, chinese, routines, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = useMemo(() => new Set(Object.keys(events)), [events]);
  const moodFor = useCallback((d: string) => moodOf(journal[d]?.mood), [journal]);

  if (!ready) {
    return <Skeleton label="Loading your day" />;
  }

  const isToday = selected === today;
  const isPast = selected < today;
  const isFuture = selected > today;
  const date = parseKey(selected);

  const dayRoutines = sortByTime(routines.filter((r) => isScheduled(r, selected)));
  const { timed, anytime } = timedRoutines(dayRoutines);
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

  const dayTodos = itemsFor(inbox, selected);
  const session = sessionFor(gym, selected);
  const gymProgress = session ? sessionProgress(gym, selected, session) : undefined;
  const gymDone = !!gymProgress && gymProgress.total > 0 && gymProgress.done === gymProgress.total;
  const upcoming = session ? undefined : nextSession(gym, selected);
  const practice = todaysLog(chinese, selected);
  const chineseDone = practice.minutes >= chinese.target;
  const showChinese = !isPast || practice.minutes > 0;
  const toReview = dueWords(chinese, today).length;
  const dayGroceries = (isPast ? groceries.filter((g) => g.lastBought === selected) : groceries.filter((g) => isOnList(g, selected))).sort(
    (a, b) => Number(boughtOn(a, selected)) - Number(boughtOn(b, selected)) || a.name.localeCompare(b.name),
  );

  // Progress: every routine, to-do and grocery item counts once, the workout and practice once each.
  const planned = dayRoutines.filter((r) => !isSkipped(r, selected));
  const done =
    planned.filter((r) => isDoneOn(r, selected)).length +
    dayTodos.filter((t) => t.doneOn).length +
    dayGroceries.filter((g) => boughtOn(g, selected)).length +
    (gymDone ? 1 : 0) +
    (showChinese && chineseDone ? 1 : 0);
  const total = planned.length + dayTodos.length + dayGroceries.length + (session ? 1 : 0) + (showChinese ? 1 : 0);

  const replace = (r: Routine) => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? r : x)));
  const tap = (r: Routine) => !isFuture && replace(tapRoutine(r, selected));
  const edit = (r?: Routine) => {
    setEditing(r);
    setPanel('routine');
  };
  const close = () => {
    setTodoError(undefined);
    setPanel(null);
  };
  const live = editing && routines.find((r) => r.id === editing.id);
  const pinned = routines.filter((r) => r.pinned);

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

  // One list of the day's things for both layouts: routines, to-dos, then the workout, practice and shopping,
  // so the rows match the progress count.
  const items: TrailItem[] = [
    ...dayRoutines.map((r) => {
      const count = r.target ? countOn(r, selected) : 0;
      const when = r.start ? `${r.start}${r.duration ? ` · ${r.duration} min` : ''}` : 'Anytime';
      return {
        key: r.id,
        title: r.name,
        icon: iconFor(r),
        color: kinds.routines.color,
        meta: isSkipped(r, selected) ? 'Skipped today' : r.target ? `${when} · ${count}/${r.target}` : when,
        done: isDoneOn(r, selected),
        skipped: isSkipped(r, selected),
        progress: r.target && r.target > 1 ? { value: count, total: r.target } : undefined,
        onPress: () => tap(r),
        onLongPress: () => edit(r),
      };
    }),
    ...dayTodos.map((t) => ({
      key: t.id,
      title: t.title,
      meta: 'To-do',
      icon: 'checkbox-outline',
      color: kinds.inbox.color,
      done: !!t.doneOn,
      onPress: () => !isFuture && updateInbox((items) => items.map((x) => (x.id === t.id ? toggleItem(x, selected) : x))),
    })),
    ...(session && gymProgress
      ? [
          {
            key: 'gym',
            title: session.name,
            icon: 'barbell',
            color: kinds.gym.color,
            meta: `Workout · ${gymProgress.done}/${gymProgress.total} sets`,
            done: gymDone,
            nav: true,
            progress: { value: gymProgress.done, total: gymProgress.total },
            onPress: () => router.navigate('/gym'),
          },
        ]
      : []),
    ...(showChinese
      ? [
          {
            key: 'chinese',
            title: 'Chinese practice',
            icon: 'language',
            color: kinds.chinese.color,
            meta: `${practice.minutes}/${chinese.target} min${toReview ? ` · ${plural(toReview, 'word')} to review` : ''}`,
            done: chineseDone,
            nav: true,
            progress: { value: practice.minutes, total: chinese.target },
            onPress: () => router.navigate('/chinese'),
          },
        ]
      : []),
    ...(dayGroceries.length > 0
      ? [
          {
            key: 'groceries',
            title: isPast ? 'Groceries bought' : 'Groceries',
            icon: 'basket',
            color: kinds.groceries.color,
            meta: `${dayGroceries.filter((g) => boughtOn(g, selected)).length} of ${dayGroceries.length} bought · ${dayGroceries
              .slice(0, 3)
              .map((g) => g.name)
              .join(', ')}${dayGroceries.length > 3 ? '…' : ''}`,
            done: dayGroceries.every((g) => boughtOn(g, selected)),
            nav: true,
            onPress: () => router.navigate({ pathname: '/library', params: { shelf: 'groceries' } }),
          },
        ]
      : []),
  ];
  const openLibrary = (shelf: 'routines' | 'groceries') => router.navigate({ pathname: '/library', params: { shelf } });

  return (
    <View style={styles.flex}>
      <GlassScroll contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: contentBottom }]}>
        {theme.glass ? (
          <GlassHome
            name={settings.name || 'friend'}
            greeting={greeting(Math.floor(now / 60))}
            tagline={theme.name === 'stone' ? 'Breathe in calm. One thing at a time.' : 'Small steps, bright days.'}
            dateLabel={
              isToday ? `Today, ${date.getDate()} ${date.toLocaleDateString('en', { month: 'long' })}` : friendlyDate(selected, today)
            }
            dayLine={date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            calendarOpen={calendarOpen}
            onToggleCalendar={() => setCalendarOpen((o) => !o)}
            calendar={calendar}
            hero={
              next && isToday
                ? {
                    eyebrow: next.state === 'now' ? 'Happening now' : 'Up next',
                    title: next.entry.routine!.name,
                    meta:
                      next.state === 'now'
                        ? `${formatLeft(next.minutes)} remaining`
                        : `At ${clock(next.entry.start)} · in ${formatLeft(next.minutes)}`,
                    action: next.entry.routine!.target ? 'Add one' : 'Mark done',
                    icon: 'play',
                    onAction: () => tap(next.entry.routine!),
                  }
                : {
                    eyebrow: isToday ? "Today's progress" : friendlyDate(selected, today),
                    title: total === 0 ? 'A clear day' : done === total ? 'All done. Nice work!' : `${done} of ${total} done`,
                    meta:
                      total === 0
                        ? 'Add a routine or a to-do to plan it'
                        : done === total
                          ? 'Enjoy the rest of your day'
                          : 'Keep going, one thing at a time',
                    action: 'Add a routine',
                    icon: 'add',
                    onAction: () => edit(),
                  }
            }
            categories={[
              pinned[0]
                ? {
                    label: pinned[0].name,
                    kind: 'routines' as const,
                    icon: iconFor(pinned[0]) as 'repeat',
                    active: isDoneOn(pinned[0], selected),
                    onPress: () => tap(pinned[0]),
                  }
                : { label: 'Routines', kind: 'routines' as const, icon: 'repeat', onPress: () => openLibrary('routines') },
              { label: 'Gym', kind: 'gym', icon: 'barbell', active: gymDone, onPress: () => router.navigate('/gym') },
              { label: 'Chinese', kind: 'chinese', icon: 'language', active: chineseDone, onPress: () => router.navigate('/chinese') },
              { label: 'Groceries', kind: 'groceries', icon: 'basket', onPress: () => openLibrary('groceries') },
              {
                label: 'Sounds',
                kind: 'calendar',
                icon: sounds.playing ? 'pause' : 'musical-notes',
                onPress: () => sounds.setSheetOpen(true),
              },
            ]}
            items={items}
            done={done}
            total={total}
            onAdd={() => setPanel('add')}
            onSettings={() => setPanel('settings')}
            onStats={() => setPanel('stats')}
            onSeeAll={() => openLibrary('routines')}
          />
        ) : (
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
                  ? `Happening now · ${formatLeft(next.minutes)} left`
                  : `Up next · ${clock(next.entry.start)} · in ${formatLeft(next.minutes)}`
                : undefined
            }
            balance={[
              {
                label: 'Routines',
                value: planned.filter((r) => isDoneOn(r, selected)).length,
                total: planned.length,
                unit: planned.length === 1 ? 'routine' : 'routines',
                color: kinds.routines.color,
                soft: kinds.routines.soft,
              },
              {
                label: 'Gym',
                value: gymProgress?.done ?? 0,
                total: gymProgress?.total ?? 0,
                unit: 'sets',
                color: kinds.gym.color,
                soft: kinds.gym.soft,
              },
              {
                label: 'Chinese',
                value: practice.minutes,
                total: showChinese ? chinese.target : 0,
                unit: 'min',
                color: kinds.chinese.color,
                soft: kinds.chinese.soft,
              },
            ]}
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
        )}

        {!isFuture && <DayNote date={selected} isToday={isToday} />}
      </GlassScroll>

      {/* The glass looks add from the quick-add bar and the hero card, so they skip the floating button. */}
      {!theme.glass && <Fab onPress={() => setPanel('add')} accessibilityLabel="Add a routine, to-do, grocery item or word" />}

      <Sheet visible={panel === 'add'} title="Add" onClose={close}>
        {(
          [
            ['routine', 'repeat', 'Routine', 'Something you do regularly, with a time', kinds.routines.color],
            [
              'todo',
              'checkbox',
              'To-do',
              `A one-off task for ${isToday ? 'today' : friendlyDate(selected, today).toLowerCase()}`,
              kinds.inbox.color,
            ],
            ['grocery', 'basket', 'Grocery item', 'Goes on your shopping list', kinds.groceries.color],
            ['word', 'language', 'Chinese word', 'A new flashcard to practise', kinds.chinese.color],
          ] as const
        ).map(([key, icon, title, sub, color]) => (
          <Press
            key={key}
            style={styles.addRow}
            overlay={colors.material.pressFill}
            onPress={() => (key === 'routine' ? edit() : setPanel(key))}
            accessibilityLabel={`${title}. ${sub}`}
          >
            <View style={[styles.addIcon, { backgroundColor: color }]}>
              <Ionicons name={icon} size={18} color={colors.onKind} />
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
        onClose={close}
        onSave={(f) => {
          updateChinese((c) => ({ ...c, words: [...c.words, newWord(newId(), f.hanzi, f.pinyin, f.meaning, today)] }));
          close();
        }}
      />
      <StatsSheet visible={panel === 'stats'} onClose={close} />
      <SettingsSheet visible={panel === 'settings'} onClose={close} onBackup={() => setPanel('backup')} />
      <BackupSheet visible={panel === 'backup'} onClose={close} />
    </View>
  );
}

const makeStyles = ({ colors, fonts, type, glass, radii }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16 },
    flex: { flex: 1 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: glass ? 18 : 4,
      paddingHorizontal: glass ? 0 : 8,
    },
    dateTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
    dateText: { fontFamily: fonts.display, fontSize: glass ? 28 : 22, color: colors.text, letterSpacing: -0.5 },
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
    addIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    saveButton: { marginTop: 20 },
    label: type.label,
  });
