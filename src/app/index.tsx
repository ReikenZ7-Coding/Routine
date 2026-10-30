import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackupSheet } from '../components/BackupSheet';
import { CalendarStrip } from '../components/CalendarStrip';
import { CheckRow } from '../components/CheckRow';
import { DayNote } from '../components/DayNote';
import { GroceryForm } from '../components/GroceryForm';
import { RoutineForm } from '../components/RoutineForm';
import { RoutineRow } from '../components/RoutineRow';
import { Divider, Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { StatsSheet } from '../components/StatsSheet';
import { WordForm } from '../components/WordForm';
import { marksFor, monthGrid, weekOf } from '../lib/agenda';
import { dueWords, newWord, todaysLog } from '../lib/chinese';
import {
  type PhoneEvent,
  calendarSupported,
  connectPhoneCalendar,
  formatEventTime,
  phoneEventsByDay,
} from '../lib/deviceCalendar';
import { nextSession, sessionFor, sessionProgress } from '../lib/gym';
import { moodFace } from '../lib/journal';
import { isDoneOn, isScheduled, isSkipped, sortByTime } from '../lib/routines';
import { boughtOn, friendlyDate, isOnList, parseKey } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { colors, fonts, kinds, radius, type } from '../theme';

export default function PlanScreen() {
  const store = useStore();
  const { ready, today, groceries, toggleBought, addGrocery, gym, chinese, updateChinese, routines, updateRoutines, settings, updateSettings, journal } = store;
  const [panel, setPanel] = useState<'stats' | 'backup' | 'add' | 'routine' | 'grocery' | 'word' | null>(null);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(today);
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<Record<string, PhoneEvent[]>>({});

  // Follow the real date when the app is reopened on a new day.
  useEffect(() => setSelected(today), [today]);

  // Load phone calendar events for whatever is on screen (a week or a month).
  const visible = useMemo(() => (expanded ? monthGrid(selected).flat().filter(Boolean) as string[] : weekOf(selected)), [expanded, selected]);
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
  const date = parseKey(selected);

  const dayEvents = events[selected] ?? [];
  const dayRoutines = sortByTime(routines.filter((r) => isScheduled(r, selected)));
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

  // Progress for the selected day: every routine and grocery item counts once, the workout and practice once each.
  // Skipped routines don't count either way.
  const plannedRoutines = dayRoutines.filter((r) => !isSkipped(r, selected));
  const done =
    plannedRoutines.filter((r) => isDoneOn(r, selected)).length +
    dayGroceries.filter((g) => boughtOn(g, selected)).length +
    (gymDone ? 1 : 0) +
    (showChinese && chineseDone ? 1 : 0);
  const total = plannedRoutines.length + dayGroceries.length + (session ? 1 : 0) + (showChinese ? 1 : 0);

  const connect = async () => {
    const ok = await connectPhoneCalendar();
    updateSettings({ calendarConnected: ok });
  };

  const close = () => setPanel(null);

  return (
    <View style={styles.flex}>
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}>

      <View style={styles.header}>
        <Text style={type.hero}>{date.getDate()}</Text>
        <View style={styles.headerText}>
          <Text style={styles.weekday}>{date.toLocaleDateString('en', { weekday: 'long' })}</Text>
          <Text style={type.label}>{date.toLocaleDateString('en', { month: 'long', year: 'numeric' })}</Text>
        </View>
        <Pressable style={styles.iconButton} onPress={() => setPanel('stats')} accessibilityLabel="Your week">
          <Ionicons name="stats-chart-outline" size={17} color={colors.text} />
        </Pressable>
        <Pressable style={styles.iconButton} onPress={() => setPanel('backup')} accessibilityLabel="Backup">
          <Ionicons name="archive-outline" size={17} color={colors.text} />
        </Pressable>
        <Pressable
          style={[styles.iconButton, expanded && styles.iconButtonActive]}
          onPress={() => setExpanded((e) => !e)}
          accessibilityLabel={expanded ? 'Show week' : 'Show month'}
        >
          <Ionicons name="calendar-clear-outline" size={18} color={expanded ? '#fff' : colors.text} />
        </Pressable>
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

      <View style={styles.status}>
        <View style={styles.statusRow}>
          <Text style={type.label}>
            {isToday ? 'Today' : friendlyDate(selected, today)}
            {total > 0 ? `  ·  ${done}/${total} done` : ''}
          </Text>
          {!isToday && (
            <Pressable style={styles.todayButton} onPress={() => setSelected(today)} hitSlop={6}>
              <Text style={styles.todayButtonText}>Back to today</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { flex: total ? done / total : 0 }]} />
          <View style={{ flex: total ? 1 - done / total : 1 }} />
        </View>
      </View>

      {dayEvents.length > 0 && (
        <Section title="Calendar" dot={kinds.calendar.color}>
          {dayEvents.map((e, i) => (
            <View key={e.id}>
              {i > 0 && <Divider inset={16} />}
              <View style={styles.eventRow}>
                <View style={[styles.eventBar, { backgroundColor: e.color ?? colors.muted }]} />
                <Text style={[type.bodyMedium, styles.flex]} numberOfLines={1}>
                  {e.title}
                </Text>
                <Text style={styles.mono}>{formatEventTime(e)}</Text>
              </View>
            </View>
          ))}
        </Section>
      )}

      {dayRoutines.length > 0 && (
        <Section
          title="Routines"
          dot={kinds.routines.color}
          right={<Link label="Edit" onPress={() => router.navigate('/routines')} />}
        >
          {dayRoutines.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <RoutineRow
                routine={r}
                date={selected}
                disabled={selected > today}
                onChange={(next) => updateRoutines((rs) => rs.map((x) => (x.id === next.id ? next : x)))}
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
          right={<Link label="Edit" onPress={() => router.navigate('/groceries')} />}
        >
          {dayGroceries.length === 0 ? (
            <Pressable style={styles.empty} onPress={() => router.navigate('/groceries')}>
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

      {selected <= today && <DayNote date={selected} isToday={isToday} />}

      {total === 0 && dayEvents.length === 0 && (
        <Text style={[type.small, styles.nothing]}>Nothing planned for this day.</Text>
      )}

      {!settings.calendarConnected && (
        <Pressable style={styles.connect} onPress={calendarSupported ? connect : undefined}>
          <Ionicons name="link-outline" size={18} color={colors.text} />
          <View style={styles.flex}>
            <Text style={type.bodyMedium}>Show my phone calendar</Text>
            <Text style={type.small}>
              {calendarSupported
                ? 'See your existing events on each day, next to your routines. Read-only.'
                : 'Available in the Android app.'}
            </Text>
          </View>
        </Pressable>
      )}
      {settings.calendarConnected && (
        <Pressable style={styles.disconnect} onPress={() => updateSettings({ calendarConnected: false })}>
          <Text style={type.small}>Phone calendar connected · Tap to hide events</Text>
        </Pressable>
      )}
    </ScrollView>

      <Pressable style={styles.fab} onPress={() => setPanel('add')} accessibilityLabel="Quick add">
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>

      <Sheet visible={panel === 'add'} title="Add" onClose={close}>
        {(
          [
            ['routine', 'repeat-outline', 'Routine', 'Something you do regularly', kinds.routines.color],
            ['grocery', 'basket-outline', 'Grocery item', 'Goes on your shopping list', kinds.groceries.color],
            ['word', 'language-outline', 'Chinese word', 'A new flashcard to practise', kinds.chinese.color],
          ] as const
        ).map(([key, icon, title, sub, color]) => (
          <Pressable key={key} style={({ pressed }) => [styles.addRow, pressed && styles.pressed]} onPress={() => setPanel(key)}>
            <View style={[styles.addIcon, { backgroundColor: color }]}>
              <Ionicons name={icon} size={18} color="#fff" />
            </View>
            <View style={styles.flex}>
              <Text style={type.bodyMedium}>{title}</Text>
              <Text style={type.small}>{sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        ))}
      </Sheet>
      <RoutineForm
        visible={panel === 'routine'}
        onClose={close}
        onSave={(f) => {
          updateRoutines((rs) => [...rs, { ...f, id: newId(), doneDates: [] }]);
          close();
        }}
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
      <BackupSheet visible={panel === 'backup'} onClose={close} />
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={type.link}>{label}</Text>
    </Pressable>
  );
}

function NavRow({
  title,
  subtitle,
  done,
  tint,
  onPress,
}: {
  title: string;
  subtitle: string;
  done: boolean;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.navRow, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.navMark, { backgroundColor: done ? tint : 'transparent', borderColor: done ? tint : colors.faint }]}>
        {done && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      <View style={styles.flex}>
        <Text style={[type.bodyMedium, done && styles.doneTitle]}>{title}</Text>
        <Text style={type.small}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 110 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 12 },
  addIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  headerText: { flex: 1, paddingBottom: 6, gap: 2 },
  weekday: { fontFamily: fonts.displayMedium, fontSize: 20, color: colors.text },
  todayButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  todayButtonText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  iconButton: {
    marginBottom: 8,
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: { backgroundColor: colors.text, borderColor: colors.text },
  status: { marginTop: 18, gap: 8 },
  track: { flexDirection: 'row', height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { backgroundColor: colors.text },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 },
  eventBar: { width: 3, height: 22, borderRadius: 2 },
  mono: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  navMark: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { color: colors.faint, textDecorationLine: 'line-through' },
  pressed: { backgroundColor: colors.primarySoft },
  empty: { padding: 16 },
  nothing: { textAlign: 'center', marginTop: 32 },
  connect: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.faint,
  },
  disconnect: { marginTop: 24, alignItems: 'center' },
});
