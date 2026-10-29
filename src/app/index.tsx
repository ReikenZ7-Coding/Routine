import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckRow } from '../components/CheckRow';
import { Divider, Section } from '../components/Section';
import { dueWords, todaysLog } from '../lib/chinese';
import { nextSession, sessionFor, sessionProgress } from '../lib/gym';
import { isDoneOn, isScheduled, routineSubtitle, sortByTime, toggleDone } from '../lib/routines';
import { useStore } from '../lib/store';
import { boughtOn, friendlyDate, isOnList, parseKey } from '../lib/schedule';
import { colors, radius } from '../theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { ready, today, groceries, toggleBought, gym, chinese, routines, updateRoutines } = useStore();
  const insets = useSafeAreaInsets();
  const list = groceries
    .filter((g) => isOnList(g, today))
    .sort((a, b) => Number(boughtOn(a, today)) - Number(boughtOn(b, today)) || a.name.localeCompare(b.name));
  const session = sessionFor(gym, today);
  const gymProgress = session ? sessionProgress(gym, today, session) : undefined;
  const gymDone = !!gymProgress && gymProgress.done === gymProgress.total;
  const upcoming = session ? undefined : nextSession(gym, today);

  const practice = todaysLog(chinese, today);
  const chineseDone = practice.minutes >= chinese.target;
  const toReview = dueWords(chinese, today).length;

  const todaysRoutines = sortByTime(routines.filter((r) => isScheduled(r, today)));
  const routinesDone = todaysRoutines.filter((r) => isDoneOn(r, today)).length;

  // Each grocery item and routine counts once; today's workout and Chinese practice count as one item each.
  const done =
    list.filter((g) => boughtOn(g, today)).length + routinesDone + (gymDone ? 1 : 0) + (chineseDone ? 1 : 0);
  const total = list.length + todaysRoutines.length + (session ? 1 : 0) + 1;
  const pct = total ? done / total : 0;

  const dateLabel = parseKey(today).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.date}>{dateLabel}</Text>
      <Text style={styles.greeting}>{greeting()}</Text>

      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          {total === 0 ? 'Nothing planned yet' : done === total ? 'All done for today' : `${done} of ${total} done`}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
      </View>

      {ready && todaysRoutines.length > 0 && (
        <Section
          title="Routines"
          right={
            <Pressable onPress={() => router.navigate('/routines')} hitSlop={8}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          }
        >
          {todaysRoutines.map((r, i) => (
            <View key={r.id}>
              {i > 0 && <Divider />}
              <CheckRow
                title={r.name}
                subtitle={routineSubtitle(r, today)}
                done={isDoneOn(r, today)}
                onToggle={() => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? toggleDone(x, today) : x)))}
              />
            </View>
          ))}
        </Section>
      )}

      {ready && (
        <Section title="Gym">
          <Pressable
            style={({ pressed }) => [styles.gymRow, pressed && styles.pressed]}
            onPress={() => router.navigate('/gym')}
          >
            <Ionicons
              name={gymDone ? 'checkmark-circle' : 'barbell-outline'}
              size={26}
              color={gymDone ? colors.primary : colors.muted}
            />
            <View style={styles.flex}>
              {session && gymProgress ? (
                <>
                  <Text style={[styles.gymTitle, gymDone && styles.doneTitle]}>{session.name}</Text>
                  <Text style={styles.gymSub}>
                    {gymDone
                      ? 'Done for today'
                      : `${session.exercises.map((e) => e.name).slice(0, 3).join(', ')}${session.exercises.length > 3 ? '…' : ''} · ${gymProgress.done}/${gymProgress.total} sets`}
                  </Text>
                </>
              ) : gym.sessions.length === 0 ? (
                <>
                  <Text style={styles.gymTitle}>Set up your training plan</Text>
                  <Text style={styles.gymSub}>Pick a starter plan or build your own</Text>
                </>
              ) : (
                <>
                  <Text style={styles.gymTitle}>Rest day</Text>
                  <Text style={styles.gymSub}>
                    {upcoming ? `Next: ${upcoming.session.name}, ${friendlyDate(upcoming.date, today).toLowerCase()}` : 'Enjoy it'}
                  </Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </Section>
      )}

      {ready && (
        <Section title="Chinese">
          <Pressable
            style={({ pressed }) => [styles.gymRow, pressed && styles.pressed]}
            onPress={() => router.navigate('/chinese')}
          >
            <Ionicons
              name={chineseDone ? 'checkmark-circle' : 'language-outline'}
              size={26}
              color={chineseDone ? colors.primary : colors.muted}
            />
            <View style={styles.flex}>
              <Text style={[styles.gymTitle, chineseDone && styles.doneTitle]}>
                {practice.minutes} / {chinese.target} min practice
              </Text>
              <Text style={styles.gymSub}>
                {chinese.words.length === 0
                  ? 'Add words to start flashcard reviews'
                  : toReview
                    ? `${toReview} words to review`
                    : 'Flashcards all caught up'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        </Section>
      )}

      {ready && (
        <Section
          title="Groceries"
          right={
            <Pressable onPress={() => router.navigate('/groceries')} hitSlop={8}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          }
        >
          {list.length === 0 ? (
            <Pressable style={styles.empty} onPress={() => router.navigate('/groceries')}>
              <Text style={styles.emptyText}>
                {groceries.length === 0
                  ? 'Add the things you buy often, and they will show up here when you need them.'
                  : 'Nothing to buy today.'}
              </Text>
              {groceries.length === 0 && <Text style={styles.link}>Set up groceries</Text>}
            </Pressable>
          ) : (
            list.map((g, i) => (
              <View key={g.id}>
                {i > 0 && <Divider />}
                <CheckRow
                  title={g.name}
                  subtitle={g.quantity}
                  done={boughtOn(g, today)}
                  onToggle={() => toggleBought(g.id)}
                />
              </View>
            ))
          )}
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  date: { fontSize: 14, color: colors.muted },
  greeting: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 2 },
  progressCard: { backgroundColor: colors.card, borderRadius: radius, padding: 16, marginTop: 16 },
  progressText: { fontSize: 16, fontWeight: '600', color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 10, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  empty: { padding: 16, gap: 8 },
  flex: { flex: 1 },
  pressed: { backgroundColor: colors.primarySoft },
  gymRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  gymTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  doneTitle: { color: colors.muted, textDecorationLine: 'line-through' },
  gymSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 21 },
});
