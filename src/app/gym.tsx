import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Divider, Section } from '../components/Section';
import { SessionForm } from '../components/SessionForm';
import {
  type PlanExercise,
  type Session,
  STARTER_PLANS,
  buildSessions,
  formatWeight,
  isSetDone,
  lastTime,
  nextSession,
  sessionFor,
  sessionProgress,
  setTodaysWeight,
  toggleSet,
  workingWeight,
} from '../lib/gym';
import { isRecord, workoutHistory } from '../lib/records';
import { WEEKDAY_SHORT, friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from '../components/Glass';

const REST_SECONDS = 90;
const WEIGHT_STEP = 2.5;
// Monday-first week for the plan list.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function GymScreen() {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const { ready, today, gym, updateGym } = useStore();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState<Session | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (restEnd === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [restEnd]);

  const restLeft = restEnd === null ? 0 : Math.max(0, Math.ceil((restEnd - now) / 1000));
  useEffect(() => {
    if (restEnd !== null && restLeft === 0) setRestEnd(null);
  }, [restEnd, restLeft]);

  if (!ready) return null;

  const session = sessionFor(gym, today);
  const upcoming = session ? undefined : nextSession(gym, today);

  const history = workoutHistory(gym);
  const weightFor = (s: Session, e: PlanExercise) => overrides[e.id] ?? workingWeight(gym, today, s, e);

  const changeWeight = (s: Session, e: PlanExercise, delta: number) => {
    const w = Math.max(0, weightFor(s, e) + delta);
    setOverrides((prev) => ({ ...prev, [e.id]: w }));
    updateGym((g) => setTodaysWeight(g, today, s.id, e.id, w));
  };

  const tapSet = (s: Session, e: PlanExercise, set: number) => {
    const wasDone = isSetDone(gym, today, s.id, e.id, set);
    updateGym((g) => toggleSet(g, today, s, e, set, weightFor(s, e)));
    if (!wasDone) {
      setNow(Date.now());
      setRestEnd(Date.now() + REST_SECONDS * 1000);
    }
  };

  const saveSession = (s: Session) => {
    updateGym((g) => {
      const others = g.sessions
        .filter((x) => x.id !== s.id)
        .map((x) => ({ ...x, days: x.days.filter((d) => !s.days.includes(d)) }));
      const exists = g.sessions.some((x) => x.id === s.id);
      return {
        ...g,
        sessions: exists ? g.sessions.map((x) => (x.id === s.id ? s : others.find((o) => o.id === x.id)!)) : [...others, s],
      };
    });
    setFormOpen(false);
  };

  const openSession = (s?: Session) => {
    setEditing(s);
    setFormOpen(true);
  };

  if (gym.sessions.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Glass style={styles.welcome}>
          <Ionicons name="barbell-outline" size={40} color={kinds.gym.color} />
          <Text style={styles.welcomeTitle}>Your training plan</Text>
          <Text style={styles.welcomeText}>
            Pick a starter plan and adjust it, or build your own. Each day you'll see exactly what to train, and what
            you lifted last time.
          </Text>
          {STARTER_PLANS.map((p) => (
            <Pressable accessibilityRole="button"
              key={p.id}
              style={styles.planOption}
              onPress={() => updateGym((g) => ({ ...g, sessions: buildSessions(p.sessions, newId) }))}
            >
              <View style={styles.flex}>
                <Text style={styles.planTitle}>{p.title}</Text>
                <Text style={styles.planSummary}>{p.summary}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => openSession()}>
            <Text style={styles.secondaryText}>Build my own</Text>
          </Pressable>
        </Glass>
        <SessionForm
          visible={formOpen}
          session={editing}
          takenDays={[]}
          onClose={() => setFormOpen(false)}
          onSave={saveSession}
        />
      </ScrollView>
    );
  }

  const progress = session ? sessionProgress(gym, today, session) : undefined;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.content, restEnd !== null && styles.contentWithTimer]}>
        {session && progress ? (
          <>
            <Glass style={styles.todayCard}>
              <Text style={styles.eyebrow}>Today's session</Text>
              <Text style={styles.sessionName}>{session.name}</Text>
              <Text style={styles.progressText}>
                {progress.done === progress.total ? 'Workout complete. Nice work!' : `${progress.done} of ${progress.total} sets`}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }]} />
              </View>
            </Glass>

            {session.exercises.map((e) => {
              const last = lastTime(gym, e.name, today);
              const weight = weightFor(session, e);
              return (
                <Glass key={e.id} style={styles.exercise}>
                  <View style={styles.exHeader}>
                    <View style={styles.flex}>
                      <View style={styles.exTitleRow}>
                        <Text style={styles.exName}>{e.name}</Text>
                        {isRecord(gym.logs, e.name, today) && (
                          <View style={styles.prBadge}>
                            <Text style={styles.prText}>🏆 New best</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.exPlan}>
                        {e.sets} × {e.reps}
                        {last ? `  ·  Last: ${formatWeight(last.weight)} × ${last.reps}, ${friendlyDate(last.date, today)}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.exControls}>
                    <View style={styles.stepper}>
                      <Pressable accessibilityRole="button"
                        onPress={() => changeWeight(session, e, -WEIGHT_STEP)}
                        style={styles.stepBtn}
                        accessibilityLabel={`Lower ${e.name} weight`}
                      >
                        <Ionicons name="remove" size={18} color={colors.text} />
                      </Pressable>
                      <Text style={styles.weight}>{formatWeight(weight)}</Text>
                      <Pressable accessibilityRole="button"
                        onPress={() => changeWeight(session, e, WEIGHT_STEP)}
                        style={styles.stepBtn}
                        accessibilityLabel={`Raise ${e.name} weight`}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </Pressable>
                    </View>
                    <View style={styles.sets}>
                      {Array.from({ length: e.sets }, (_, i) => {
                        const done = isSetDone(gym, today, session.id, e.id, i);
                        return (
                          <Pressable
                            key={i}
                            onPress={() => tapSet(session, e, i)}
                            style={[styles.setBubble, done && styles.setDone]}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: done }}
                            accessibilityLabel={`${e.name} set ${i + 1}`}
                          >
                            <Text style={[styles.setText, done && styles.setTextDone]}>{done ? e.reps : i + 1}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </Glass>
              );
            })}
            <Text style={styles.hint}>Tap a set when you finish it. A rest timer starts automatically.</Text>
          </>
        ) : (
          <Glass style={styles.todayCard}>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.sessionName}>Rest day</Text>
            <Text style={styles.progressText}>
              {upcoming
                ? `Next: ${upcoming.session.name}, ${friendlyDate(upcoming.date, today).toLowerCase()}`
                : 'No sessions scheduled this week.'}
            </Text>
          </Glass>
        )}

        <Section
          title="Weekly plan"
          right={
            <Pressable accessibilityRole="button" onPress={() => openSession()} hitSlop={8}>
              <Text style={styles.link}>Add session</Text>
            </Pressable>
          }
        >
          {WEEK.map((d, i) => {
            const s = gym.sessions.find((x) => x.days.includes(d));
            return (
              <View key={d}>
                {i > 0 && <Divider />}
                <Pressable accessibilityRole="button"
                  style={({ pressed }) => [styles.planRow, pressed && s && styles.pressed]}
                  onPress={() => s && openSession(s)}
                  disabled={!s}
                >
                  <Text style={styles.planDay}>{WEEKDAY_SHORT[d]}</Text>
                  <Text style={[styles.planName, !s && styles.rest]}>{s ? s.name : 'Rest'}</Text>
                  {s && <Text style={styles.planCount}>{s.exercises.length} exercises</Text>}
                </Pressable>
              </View>
            );
          })}
        </Section>

        {history.length > 0 && (
          <Section title="History">
            {history.slice(0, 10).map((w, i) => (
              <View key={w.date}>
                {i > 0 && <Divider inset={16} />}
                <View style={styles.historyRow}>
                  <View style={styles.flex}>
                    <Text style={styles.planName}>{w.sessionName}</Text>
                    <Text style={styles.exPlan}>
                      {friendlyDate(w.date, today)} · {w.sets} {w.sets === 1 ? 'set' : 'sets'} · {Math.round(w.volume).toLocaleString('en')} kg
                    </Text>
                  </View>
                  {w.records > 0 && <Text style={styles.historyPr}>🏆 {w.records}</Text>}
                </View>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>

      {restEnd !== null && (
        <Pressable accessibilityRole="button" style={styles.timer} onPress={() => setRestEnd(null)} accessibilityLabel="Dismiss rest timer">
          <Ionicons name="timer-outline" size={22} color={colors.onPrimary} />
          <Text style={styles.timerText}>
            Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
          </Text>
          <Text style={styles.timerSkip}>Skip</Text>
        </Pressable>
      )}

      <SessionForm
        visible={formOpen}
        session={editing}
        takenDays={gym.sessions.filter((s) => s.id !== editing?.id).flatMap((s) => s.days)}
        onClose={() => setFormOpen(false)}
        onSave={saveSession}
        onDelete={
          editing
            ? () => {
                updateGym((g) => ({ ...g, sessions: g.sessions.filter((s) => s.id !== editing.id) }));
                setFormOpen(false);
              }
            : undefined
        }
      />
    </View>
  );
}

const makeStyles = ({ colors, kinds, fonts, radius, glass }: Theme) =>
  StyleSheet.create({
  exTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  prBadge: { backgroundColor: kinds.gym.soft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  prText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: kinds.gym.color },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  historyPr: { fontFamily: fonts.monoMedium, fontSize: 13, color: kinds.gym.color },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 150 },
  contentWithTimer: { paddingBottom: 190 },
  welcome: { padding: 24, alignItems: 'center', marginTop: 12 },
  welcomeTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginTop: 12 },
  welcomeText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 12 },
  planOption: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 14,
    marginTop: 10,
  },
  planTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
  planSummary: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  secondaryButton: { paddingVertical: 14, alignSelf: 'stretch', alignItems: 'center', marginTop: 4 },
  secondaryText: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 16 },
  todayCard: { padding: 16 },
  eyebrow: { fontFamily: fonts.monoMedium, fontSize: 12, color: glass ? colors.muted : kinds.gym.color, textTransform: 'uppercase', letterSpacing: 1.2 },
  sessionName: { fontFamily: fonts.display, fontSize: 26, color: colors.text, marginTop: 4 },
  progressText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, marginTop: 4 },
  track: { height: 8, borderRadius: 4, backgroundColor: kinds.gym.soft, marginTop: 10, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: kinds.gym.color },
  exercise: { padding: 14, marginTop: 10 },
  exHeader: { flexDirection: 'row', alignItems: 'center' },
  exName: { fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.text },
  exPlan: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  exControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  weight: { minWidth: 84, textAlign: 'center', fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text },
  sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', flexShrink: 1 },
  setBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDone: { backgroundColor: kinds.gym.color, borderColor: kinds.gym.color },
  setText: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.muted },
  setTextDone: { color: '#fff' },
  hint: { textAlign: 'center', color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 14 },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  pressed: { backgroundColor: colors.primarySoft },
  planDay: { width: 52, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  planName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text },
  rest: { color: colors.muted },
  planCount: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  timer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  timerText: { flex: 1, color: colors.onPrimary, fontFamily: fonts.monoMedium, fontSize: 18 },
  timerSkip: { color: colors.onPrimary, opacity: 0.7, fontWeight: '600' },
});
