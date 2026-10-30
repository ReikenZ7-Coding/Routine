import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import { Bloom, SceneArt } from '../components/Art';
import { Glass } from '../components/Glass';
import { BackupSheet } from '../components/BackupSheet';
import { CalendarStrip } from '../components/CalendarStrip';
import { CheckRow } from '../components/CheckRow';
import { DayNote } from '../components/DayNote';
import { GroceryForm } from '../components/GroceryForm';
import { RoutineForm } from '../components/RoutineForm';
import { RoutineRow } from '../components/RoutineRow';
import { Divider, Section } from '../components/Section';
import { SettingsSheet } from '../components/SettingsSheet';
import { Sheet } from '../components/Sheet';
import { StatsSheet } from '../components/StatsSheet';
import { WordForm } from '../components/WordForm';
import { marksFor, monthGrid, weekOf } from '../lib/agenda';
import { dueWords, newWord, todaysLog } from '../lib/chinese';
import { type PhoneEvent, formatEventTime, phoneEventsByDay } from '../lib/deviceCalendar';
import { nextSession, sessionFor, sessionProgress } from '../lib/gym';
import { itemsFor, toggleItem } from '../lib/inbox';
import { moodFace } from '../lib/journal';
import {
  type Routine,
  countOn,
  iconFor,
  isDoneOn,
  isScheduled,
  isSkipped,
  sortByTime,
  tapRoutine,
  toggleSkip,
} from '../lib/routines';
import { boughtOn, friendlyDate, isOnList, parseKey } from '../lib/schedule';
import { useSounds } from '../lib/sounds';
import { newId, useStore } from '../lib/store';
import { type TimedEntry, clock, formatSpan, timedRoutines, upNext } from '../lib/timeline';
import { useFabBottom } from '../components/NowPlaying';
import { type Theme, useStyles, useTheme } from '../theme';

type Panel = 'stats' | 'settings' | 'backup' | 'add' | 'routine' | 'todo' | 'grocery' | 'word' | null;

function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function minutesNow(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export default function TodayScreen() {
  const theme = useTheme();
  const { colors, kinds, type } = theme;
  const styles = useStyles(makeStyles);
  const fabBottom = useFabBottom();
  const store = useStore();
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
  const [events, setEvents] = useState<Record<string, PhoneEvent[]>>({});
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<Routine | undefined>();
  const [todo, setTodo] = useState('');
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
  const moodFor = useCallback((d: string) => moodFace(journal[d]?.mood), [journal]);

  if (!ready) return null;

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
  const dayGroceries = (isPast ? groceries.filter((g) => g.lastBought === selected) : groceries.filter((g) => isOnList(g, selected)))
    .sort((a, b) => Number(boughtOn(a, selected)) - Number(boughtOn(b, selected)) || a.name.localeCompare(b.name));

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
  const close = () => setPanel(null);
  const live = editing && routines.find((r) => r.id === editing.id);
  const pinned = routines.filter((r) => r.pinned);

  const addTodo = () => {
    const title = todo.trim();
    if (!title) return;
    updateInbox((items) => [{ id: newId(), title, date: selected, createdAt: new Date().toISOString() }, ...items]);
    setTodo('');
    close();
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <Text style={styles.greet}>{greeting(Math.floor(now / 60))},</Text>
            <Text style={styles.name} numberOfLines={1}>
              {settings.name || 'friend'}
              {theme.name === 'lavender' ? ' 👋' : ''}
            </Text>
            {theme.glass && (
              <Text style={styles.tagline}>
                {theme.name === 'stone' ? 'Breathe in calm. One thing at a time.' : 'Small steps, bright days. ✨'}
              </Text>
            )}
          </View>
          {theme.name === 'stone' && (
            <View style={styles.bloom} pointerEvents="none">
              <Bloom size={80} />
            </View>
          )}
          <View style={styles.topButtons}>
            <Glass radius={21} style={styles.roundButton} onPress={() => setPanel('stats')} accessibilityLabel="Your week">
              <Ionicons name="stats-chart" size={16} color={colors.text} />
            </Glass>
            <Glass radius={21} style={styles.roundButton} onPress={() => setPanel('settings')} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={18} color={colors.text} />
            </Glass>
          </View>
        </View>

        <View style={styles.dateRow}>
          <Pressable accessibilityRole="button"
            style={styles.dateTitle}
            onPress={() => setExpanded((e) => !e)}
            accessibilityLabel={expanded ? 'Show week' : 'Show month'}
          >
            <Text style={styles.dateText}>
              {date.getDate()}. {date.toLocaleDateString('en', { month: 'long' })}
              <Text style={styles.dateYear}> {date.getFullYear()}</Text>
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={20} color={kinds.chinese.color} />
          </Pressable>
          {!isToday && (
            <Pressable accessibilityRole="button" style={styles.todayButton} onPress={() => setSelected(today)} hitSlop={6}>
              <Text style={styles.todayButtonText}>Back to today</Text>
            </Pressable>
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

        {isToday && <UpNextCard next={next} done={done} total={total} onTap={tap} onEdit={edit} />}

        <Glass style={styles.shortcutPanel}>
        <View style={styles.shortcutHead}>
          <Text style={type.sectionTitle}>Shortcuts</Text>
          {pinned.length === 0 && <Text style={type.small}>Pin a routine to add it here</Text>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shortcuts}>
          {pinned.map((r) => {
            const isDone = isDoneOn(r, selected);
            const count = r.target ? countOn(r, selected) : 0;
            return (
              <Shortcut
                key={r.id}
                label={r.name}
                icon={iconFor(r)}
                color={kinds.routines.color}
                filled={isDone}
                badge={r.target && !isDone && count ? `${count}/${r.target}` : undefined}
                onPress={() => tap(r)}
                onLongPress={() => edit(r)}
              />
            );
          })}
          <Shortcut
            label="Sounds"
            icon={sounds.playing ? 'pause' : 'musical-notes'}
            color={kinds.inbox.color}
            onPress={() => sounds.setSheetOpen(true)}
          />
          <Shortcut label="Gym" icon="barbell" color={kinds.gym.color} filled={gymDone} onPress={() => router.navigate('/gym')} />
          <Shortcut label="Chinese" icon="language" color={kinds.chinese.color} filled={chineseDone} onPress={() => router.navigate('/chinese')} />
          <Shortcut
            label="Groceries"
            icon="basket"
            color={kinds.groceries.color}
            onPress={() => router.navigate({ pathname: '/library', params: { shelf: 'groceries' } })}
          />
        </ScrollView>
        </Glass>

        <View style={styles.status}>
          <Text style={type.label}>
            {isToday ? 'Today' : friendlyDate(selected, today)}
            {total > 0 ? `  ·  ${done}/${total} done` : ''}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { flex: total ? done / total : 0 }]} />
            <View style={{ flex: total ? 1 - done / total : 1 }} />
          </View>
        </View>

        {timeline.length > 0 && (
          <Section title="Timeline">
            <View style={styles.timeline}>
              <View style={styles.rail} />
              {timeline.map((e) => (
                <TimelineRow
                  key={e.id}
                  entry={e}
                  date={selected}
                  current={isToday && e.start <= now && now < e.end}
                  now={now}
                  disabled={isFuture}
                  onTap={tap}
                  onEdit={edit}
                />
              ))}
            </View>
          </Section>
        )}

        {(anytime.length > 0 || dayTodos.length > 0 || allDayEvents.length > 0) && (
          <Section title="Anytime">
            {allDayEvents.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Divider />}
                <View style={styles.eventRow}>
                  <View style={[styles.eventBar, { backgroundColor: e.color ?? colors.muted }]} />
                  <Text style={[type.bodyMedium, styles.flex]} numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text style={styles.mono}>{formatEventTime(e)}</Text>
                </View>
              </View>
            ))}
            {anytime.map((r, i) => (
              <View key={r.id}>
                {(i > 0 || allDayEvents.length > 0) && <Divider />}
                <RoutineRow routine={r} date={selected} disabled={isFuture} onChange={replace} onLongPress={() => edit(r)} />
              </View>
            ))}
            {dayTodos.map((t, i) => (
              <View key={t.id}>
                {(i > 0 || anytime.length > 0 || allDayEvents.length > 0) && <Divider />}
                <CheckRow
                  tint={kinds.inbox.color}
                  title={t.title}
                  subtitle="To-do"
                  done={!!t.doneOn}
                  disabled={isFuture}
                  onToggle={() => updateInbox((items) => items.map((x) => (x.id === t.id ? toggleItem(x, selected) : x)))}
                />
              </View>
            ))}
          </Section>
        )}

        {(session || isToday) && (
          <Section title="Gym" dot={kinds.gym.color}>
            <NavRow
              onPress={() => router.navigate('/gym')}
              done={gymDone}
              tint={kinds.gym.color}
              icon="barbell"
              title={session ? session.name : gym.sessions.length === 0 ? 'Set up your training plan' : 'Rest day'}
              subtitle={
                session && gymProgress
                  ? gymDone
                    ? 'Done'
                    : `${session.exercises.length} exercises · ${gymProgress.done}/${gymProgress.total} sets`
                  : gym.sessions.length === 0
                    ? 'Pick a starter plan or build your own'
                    : upcoming
                      ? `Next: ${upcoming.session.name}, ${friendlyDate(upcoming.date, today).toLowerCase()}`
                      : 'Enjoy it'
              }
            />
          </Section>
        )}

        {showChinese && (
          <Section title="Chinese" dot={kinds.chinese.color}>
            <NavRow
              onPress={() => router.navigate('/chinese')}
              done={chineseDone}
              tint={kinds.chinese.color}
              icon="language"
              title={`${practice.minutes} / ${chinese.target} min practice`}
              subtitle={
                !isToday
                  ? isPast
                    ? `${practice.reviewed} cards reviewed`
                    : 'Daily practice'
                  : chinese.words.length === 0
                    ? 'Add words to start flashcard reviews'
                    : toReview
                      ? `${toReview} words to review`
                      : 'Flashcards all caught up'
              }
            />
          </Section>
        )}

        {(dayGroceries.length > 0 || isToday) && (
          <Section
            title={isPast ? 'Bought' : 'Groceries'}
            dot={kinds.groceries.color}
            right={<Link label="Edit" onPress={() => router.navigate({ pathname: '/library', params: { shelf: 'groceries' } })} />}
          >
            {dayGroceries.length === 0 ? (
              <Pressable accessibilityRole="button" style={styles.empty} onPress={() => router.navigate({ pathname: '/library', params: { shelf: 'groceries' } })}>
                <Text style={type.small}>
                  {groceries.length === 0
                    ? 'Add the things you buy often. They show up here on the days you need them.'
                    : 'Nothing to buy today.'}
                </Text>
              </Pressable>
            ) : (
              dayGroceries.map((g, i) => (
                <View key={g.id}>
                  {i > 0 && <Divider />}
                  <CheckRow
                    tint={kinds.groceries.color}
                    title={g.name}
                    subtitle={g.quantity}
                    done={boughtOn(g, selected)}
                    disabled={!isToday}
                    onToggle={() => toggleBought(g.id)}
                  />
                </View>
              ))
            )}
          </Section>
        )}

        {routines.length === 0 && (
          <Pressable accessibilityRole="button" style={styles.hintCard} onPress={() => router.navigate({ pathname: '/library', params: { shelf: 'routines' } })}>
            <Ionicons name="sparkles-outline" size={20} color={colors.text} />
            <View style={styles.flex}>
              <Text style={type.bodyMedium}>Build your day</Text>
              <Text style={type.small}>Add routines with a start time and they line up on your timeline.</Text>
            </View>
          </Pressable>
        )}

        {!isFuture && <DayNote date={selected} isToday={isToday} />}
      </ScrollView>

      <Pressable accessibilityRole="button" style={[styles.fab, { bottom: fabBottom }]} onPress={() => setPanel('add')} accessibilityLabel="Quick add">
        <Ionicons name="add" size={30} color={colors.onPrimary} />
      </Pressable>

      <Sheet visible={panel === 'add'} title="Add" onClose={close}>
        {(
          [
            ['routine', 'repeat', 'Routine', 'Something you do regularly, with a time', kinds.routines.color],
            ['todo', 'checkbox', 'To-do', `A one-off task for ${isToday ? 'today' : friendlyDate(selected, today).toLowerCase()}`, kinds.inbox.color],
            ['grocery', 'basket', 'Grocery item', 'Goes on your shopping list', kinds.groceries.color],
            ['word', 'language', 'Chinese word', 'A new flashcard to practise', kinds.chinese.color],
          ] as const
        ).map(([key, icon, title, sub, color]) => (
          <Pressable accessibilityRole="button"
            key={key}
            style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
            onPress={() => (key === 'routine' ? edit() : setPanel(key))}
          >
            <View style={[styles.addIcon, { backgroundColor: color }]}>
              <Ionicons name={icon} size={18} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={type.bodyMedium}>{title}</Text>
              <Text style={type.small}>{sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ))}
      </Sheet>
      <Sheet visible={panel === 'todo'} title="New to-do" onClose={close}>
        <TextInput
          style={styles.todoInput}
          value={todo}
          onChangeText={setTodo}
          onSubmitEditing={addTodo}
          placeholder="Call Mum, book the dentist…"
          placeholderTextColor={colors.faint}
          autoFocus
        />
        <Pressable accessibilityRole="button" style={styles.saveButton} onPress={addTodo}>
          <Text style={type.button}>Add for {isToday ? 'today' : friendlyDate(selected, today).toLowerCase()}</Text>
        </Pressable>
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

/** The hero card: what's happening now or next, or how the day is going. */
function UpNextCard({
  next,
  done,
  total,
  onTap,
  onEdit,
}: {
  next: ReturnType<typeof upNext>;
  done: number;
  total: number;
  onTap: (r: Routine) => void;
  onEdit: (r?: Routine) => void;
}) {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const r = next?.entry.routine;
  const left = next ? (next.minutes >= 60 ? `${Math.floor(next.minutes / 60)} h ${next.minutes % 60} min` : `${next.minutes} min`) : '';
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const inner = (
    <>
      <Text style={styles.heroEyebrow}>{next ? (next.state === 'now' ? 'Happening now' : 'Up next') : "Today's progress"}</Text>
      {r && next ? (
        <>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {r.name}
          </Text>
          <Text style={type.small}>
            {next.state === 'now' ? `${left} remaining` : `At ${clock(next.entry.start)} · in ${left}`}
          </Text>
          <View style={styles.heroBottom}>
            <View style={[styles.heroIcon, { backgroundColor: kinds.routines.color }]}>
              <Ionicons name={iconFor(r) as 'sunny'} size={22} color="#FFFFFF" />
            </View>
            <View style={styles.flex} />
            <Pressable accessibilityRole="button" style={styles.heroAction} onPress={() => onTap(r)} accessibilityLabel={`Mark ${r.name} done`}>
              <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
              <Text style={styles.heroActionText}>{r.target ? '+1' : 'Done'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.heroTitle}>{total === 0 ? 'A clear day' : done === total ? 'All done. Nice work!' : `${done} of ${total} done`}</Text>
          <Text style={type.small}>
            {total === 0 ? 'Add a routine or a to-do to plan it.' : done === total ? 'Enjoy the rest of your day.' : 'Keep going, one thing at a time.'}
          </Text>
          <View style={styles.heroBottom}>
            <View style={styles.heroTrack}>
              <View style={[styles.heroFill, { flex: total ? done / total : 0 }]} />
              <View style={{ flex: total ? 1 - done / total : 1 }} />
            </View>
            <Pressable accessibilityRole="button" style={styles.heroAction} onPress={() => onEdit()} accessibilityLabel="Add routine">
              <Ionicons name="add" size={18} color={colors.onPrimary} />
              <Text style={styles.heroActionText}>Routine</Text>
            </Pressable>
          </View>
        </>
      )}
    </>
  );
  if (theme.name === 'lavender') {
    // An art card: the scene fills it and the text sits on a soft shade.
    return (
      <View style={styles.heroArt}>
        <View style={StyleSheet.absoluteFill}>
          <SceneArt width={width - 32} height={230} />
        </View>
        <ExpoGradient
          colors={['rgba(30,16,80,0.6)', 'rgba(30,16,80,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 0.4 }}
          style={StyleSheet.absoluteFill}
        />
        {inner}
      </View>
    );
  }
  return <Glass style={styles.hero}>{inner}</Glass>;
}

function TimelineRow({
  entry,
  date,
  current,
  now,
  disabled,
  onTap,
  onEdit,
}: {
  entry: TimedEntry;
  date: string;
  current: boolean;
  now: number;
  disabled: boolean;
  onTap: (r: Routine) => void;
  onEdit: (r: Routine) => void;
}) {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const r = entry.routine;
  const color = entry.event ? entry.event.color ?? kinds.calendar.color : kinds.routines.color;
  const done = !!r && isDoneOn(r, date);
  const skipped = !!r && isSkipped(r, date);
  const count = r?.target ? countOn(r, date) : 0;
  const subtitle = current
    ? `${entry.end - now} min remaining`
    : skipped
      ? 'Skipped · streak kept'
      : formatSpan(entry.start, entry.end);

  return (
    <Pressable
      style={({ pressed }) => [styles.tRow, pressed && r && styles.pressed]}
      onPress={r && !disabled ? () => onTap(r) : undefined}
      onLongPress={r ? () => onEdit(r) : undefined}
      accessibilityRole={r ? 'checkbox' : undefined}
      accessibilityState={r ? { checked: done } : undefined}
    >
      <Text style={styles.tTime}>{clock(entry.start)}</Text>
      <View
        style={[
          styles.tIcon,
          { backgroundColor: color },
          current && styles.tIconCurrent,
          (done || skipped) && styles.tIconDone,
        ]}
      >
        <Ionicons name={(entry.event ? 'calendar' : iconFor(r!)) as 'sunny'} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.tSub, current && { color: colors.text }]}>{subtitle}</Text>
        <Text style={[type.bodyMedium, (done || skipped) && styles.doneTitle]} numberOfLines={2}>
          {entry.title}
        </Text>
      </View>
      {r && !skipped && (
        <View style={[styles.tCheck, { borderColor: color }, done && { backgroundColor: color }]}>
          {done ? (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          ) : count ? (
            <Text style={[styles.tCount, { color }]}>{count}</Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function Shortcut({
  label,
  icon,
  color,
  filled,
  badge,
  onPress,
  onLongPress,
}: {
  label: string;
  icon: string;
  color: string;
  filled?: boolean;
  badge?: string;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, glass, name } = useTheme();
  const styles = useStyles(makeStyles);
  // Lavender: white icons on a tinted glass bubble. Stone: muted glass with a gold icon. Paper: solid colour.
  const iconColor = name === 'stone' ? (filled ? colors.onPrimary : colors.primary) : '#FFFFFF';
  const tint = filled ? (name === 'stone' ? colors.primary : color) : name === 'lavender' ? `${color}66` : undefined;
  const icons = <Ionicons name={(filled ? 'checkmark' : icon) as 'sunny'} size={24} color={glass ? iconColor : '#FFFFFF'} />;
  const caption = (
    <>
      {badge ? <Text style={styles.shortcutBadge}>{badge}</Text> : null}
      <Text style={styles.shortcutLabel} numberOfLines={2}>
        {label}
      </Text>
    </>
  );
  // Glass drops sit inside the Shortcuts glass panel, so they share its blur and read as one sheet.
  if (glass) {
    return (
      <View style={styles.shortcut}>
        <Glass radius={28} tint={tint} style={styles.shortcutCircle} onPress={onPress} onLongPress={onLongPress} accessibilityLabel={label}>
          {icons}
        </Glass>
        {caption}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" style={styles.shortcut} onPress={onPress} onLongPress={onLongPress} accessibilityLabel={label}>
      <View style={[styles.shortcutCircle, { backgroundColor: color }, filled && styles.shortcutFilled]}>{icons}</View>
      {caption}
    </Pressable>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  const { type } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={type.link}>{label}</Text>
    </Pressable>
  );
}

function NavRow({
  title,
  subtitle,
  done,
  tint,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  done: boolean;
  tint: string;
  icon: string;
  onPress: () => void;
}) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.navRow, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.navIcon, { backgroundColor: tint }]}>
        <Ionicons name={(done ? 'checkmark' : icon) as 'sunny'} size={18} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyMedium, done && styles.doneTitle]}>{title}</Text>
        <Text style={type.small}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts, type, radius, glass }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingBottom: 170 },
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text, letterSpacing: -0.3 },
    roundButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
    topButtons: { flexDirection: 'row', gap: 10, alignSelf: 'flex-start' },
    greet: { ...type.small, fontSize: 15 },
    tagline: { ...type.small, marginTop: 6, maxWidth: 220 },
    bloom: { position: 'absolute', right: 100, top: -14, opacity: 0.9 },
    heroArt: { marginTop: 18, height: 230, borderRadius: radius + 4, overflow: 'hidden', padding: 20, gap: 4, borderWidth: 1, borderColor: colors.cardBorder },
    shortcutPanel: { marginTop: 18, paddingTop: 14 },
    shortcutHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
    dateTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dateText: { fontFamily: fonts.display, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
    dateYear: { color: colors.faint },
    todayButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    todayButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
    hero: { marginTop: 18, padding: 20, gap: 4 },
    heroEyebrow: { ...type.small, fontFamily: fonts.bodyMedium },
    heroTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, color: colors.text, letterSpacing: -0.4 },
    heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
    heroIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    heroAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 18,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
      shadowColor: colors.glow,
      shadowOpacity: 0.8,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
      elevation: glass ? 8 : 0,
    },
    heroActionText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    heroTrack: { flex: 1, flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: colors.primarySoft, overflow: 'hidden' },
    heroFill: { backgroundColor: colors.accent, borderRadius: 3 },
    shortcuts: { gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
    shortcut: { width: 64, alignItems: 'center', gap: 6 },
    shortcutCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shortcutFilled: { opacity: 0.55 },
    shortcutBadge: {
      position: 'absolute',
      top: 46,
      fontFamily: fonts.monoMedium,
      fontSize: 10,
      color: colors.onPrimary,
      backgroundColor: colors.primary,
      paddingHorizontal: 5,
      borderRadius: 6,
      overflow: 'hidden',
    },
    shortcutLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 15, color: colors.text, textAlign: 'center' },
    status: { gap: 8, marginTop: 20 },
    track: { flexDirection: 'row', height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
    fill: { backgroundColor: colors.accent },
    timeline: { paddingVertical: 6 },
    rail: { position: 'absolute', left: 88, top: 24, bottom: 24, width: 2, backgroundColor: colors.border },
    tRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingLeft: 12, paddingRight: 16 },
    tTime: { width: 42, fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
    tIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    tIconCurrent: { height: 84 },
    tIconDone: { opacity: 0.45 },
    tSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
    tCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    tCount: { fontFamily: fonts.monoMedium, fontSize: 12 },
    doneTitle: { color: colors.faint, textDecorationLine: 'line-through' },
    eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
    eventBar: { width: 3, height: 22, borderRadius: 2 },
    mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },
    navRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 14 },
    navIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    pressed: { backgroundColor: colors.primarySoft },
    empty: { padding: 16 },
    hintCard: {
      marginTop: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      borderRadius: radius,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.faint,
    },
    fab: {
      position: 'absolute',
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
    addIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    todoInput: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.text,
    },
    saveButton: { marginTop: 16, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  });
