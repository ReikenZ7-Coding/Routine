import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Divider, Section } from '../components/Section';
import { PageTitle } from '../components/PageTitle';
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
import { Glass, GlassScroll } from '../components/Glass';
import { ActionChip } from '../components/Chip';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Bar, EASE_OUT, Enter, FadeSwap, Press, SelectFade } from '../components/Motion';
import { useContentBottom, useFabBottom } from '../components/NowPlaying';
import { Skeleton } from '../components/Skeleton';
import { plural } from '../lib/plural';

const REST_SECONDS = 90;
const TIMER_IN = FadeInDown.duration(240).easing(EASE_OUT);
const TIMER_OUT = FadeOut.duration(160).easing(EASE_OUT);
const WEIGHT_STEP = 2.5;
// Monday-first week for the plan list.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function GymScreen() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { ready, today, gym, updateGym } = useStore();
  const fabBottom = useFabBottom();
  const contentBottom = useContentBottom();
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

  if (!ready) return <Skeleton label="Loading your training plan" />;

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
      const others = g.sessions.filter((x) => x.id !== s.id).map((x) => ({ ...x, days: x.days.filter((d) => !s.days.includes(d)) }));
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
      <GlassScroll contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
        <PageTitle title="Gym" subtitle="Pick a plan to start with, or build your own" />
        <Glass style={styles.welcome}>
          <Ionicons name="barbell-outline" size={40} color={kinds.gym.color} />
          <Text style={styles.welcomeTitle}>Your training plan</Text>
          <Text style={styles.welcomeText}>
            Pick a starter plan and adjust it, or build your own. Each day you'll see exactly what to train, and what you lifted last time.
          </Text>
          {STARTER_PLANS.map((p) => (
            <Press
              key={p.id}
              outerStyle={styles.planSlot}
              style={styles.planOption}
              overlay={colors.material.pressFill}
              onPress={() => updateGym((g) => ({ ...g, sessions: buildSessions(p.sessions, newId) }))}
              accessibilityLabel={`${p.title}. ${p.summary}`}
            >
              <View style={styles.flex}>
                <Text style={styles.planTitle}>{p.title}</Text>
                <Text style={styles.planSummary}>{p.summary}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Press>
          ))}
          <Button label="Build my own" icon="add" variant="plain" onPress={() => openSession()} style={styles.buildOwn} />
        </Glass>
        <SessionForm visible={formOpen} session={editing} takenDays={[]} onClose={() => setFormOpen(false)} onSave={saveSession} />
      </GlassScroll>
    );
  }

  const progress = session ? sessionProgress(gym, today, session) : undefined;

  return (
    <View style={styles.flex}>
      <GlassScroll contentContainerStyle={[styles.content, { paddingBottom: contentBottom + (restEnd !== null ? 68 : 0) }]}>
        <PageTitle title="Gym" subtitle="Your training plan, one day at a time" badge={plural(gym.sessions.length, 'session')} />
        {session && progress ? (
          <>
            <Enter index={0}>
              <Glass tier="hero" bloom style={styles.todayCard}>
                <Text style={styles.sessionName} accessibilityRole="header">
                  {session.name}
                </Text>
                <Text style={styles.progressText}>
                  {progress.done === progress.total
                    ? 'Workout complete. Nice work!'
                    : `Today · ${progress.done} of ${plural(progress.total, 'set')}`}
                </Text>
                <View style={styles.track}>
                  <Bar progress={progress.done / Math.max(1, progress.total)} color={kinds.gym.color} track={colors.track} height={8} />
                </View>
                <Text style={[type.hint, styles.cardHint]}>Tap a set when you finish it. A rest timer starts on its own.</Text>
              </Glass>
            </Enter>

            {session.exercises.map((e, ei) => {
              const last = lastTime(gym, e.name, today);
              const weight = weightFor(session, e);
              return (
                <Enter key={e.id} index={ei + 1}>
                  <Glass style={styles.exercise}>
                    <View style={styles.exHeader}>
                      <View style={styles.flex}>
                        <View style={styles.exTitleRow}>
                          <Text style={styles.exName}>{e.name}</Text>
                          {isRecord(gym.logs, e.name, today) && (
                            <View style={styles.prBadge}>
                              <Ionicons name="trophy" size={12} color={kinds.gym.text} />
                              <Text style={styles.prText}>New best</Text>
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
                        <Press
                          onPress={() => changeWeight(session, e, -WEIGHT_STEP)}
                          style={styles.stepBtn}
                          overlay={colors.material.pressFill}
                          haptic
                          accessibilityLabel={`Lower ${e.name} weight`}
                        >
                          <Ionicons name="remove" size={18} color={colors.text} />
                        </Press>
                        <Text style={styles.weight}>{formatWeight(weight)}</Text>
                        <Press
                          onPress={() => changeWeight(session, e, WEIGHT_STEP)}
                          style={styles.stepBtn}
                          overlay={colors.material.pressFill}
                          haptic
                          accessibilityLabel={`Raise ${e.name} weight`}
                        >
                          <Ionicons name="add" size={18} color={colors.text} />
                        </Press>
                      </View>
                      <View style={styles.sets}>
                        {Array.from({ length: e.sets }, (_, i) => {
                          const done = isSetDone(gym, today, session.id, e.id, i);
                          return (
                            <Press
                              key={i}
                              onPress={() => tapSet(session, e, i)}
                              style={styles.setBubble}
                              overlay={colors.material.pressFill}
                              haptic
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: done }}
                              accessibilityLabel={`${e.name} set ${i + 1}`}
                            >
                              <SelectFade on={done} color={kinds.gym.color} radius={22} bleed={1.5} />
                              <FadeSwap
                                on={done}
                                off={<Text style={styles.setText}>{i + 1}</Text>}
                                onContent={<Text style={[styles.setText, styles.setTextDone]}>{e.reps}</Text>}
                              />
                            </Press>
                          );
                        })}
                      </View>
                    </View>
                  </Glass>
                </Enter>
              );
            })}
          </>
        ) : (
          <Glass style={styles.todayCard}>
            <Text style={styles.sessionName} accessibilityRole="header">
              Rest day
            </Text>
            <Text style={styles.progressText}>
              {upcoming
                ? `Next: ${upcoming.session.name}, ${friendlyDate(upcoming.date, today).toLowerCase()}`
                : 'No sessions scheduled this week.'}
            </Text>
          </Glass>
        )}

        <Section title="Weekly plan" right={<ActionChip icon="add" label="Add session" onPress={() => openSession()} />}>
          {WEEK.map((d, i) => {
            const s = gym.sessions.find((x) => x.days.includes(d));
            return (
              <View key={d}>
                {i > 0 && <Divider />}
                <Press
                  style={styles.planRow}
                  overlay={colors.material.pressFill}
                  onPress={() => s && openSession(s)}
                  disabled={!s}
                  accessibilityLabel={
                    s
                      ? `${WEEKDAY_SHORT[d]}, ${s.name}, ${plural(s.exercises.length, 'exercise')}. Edit session`
                      : `${WEEKDAY_SHORT[d]}, rest`
                  }
                >
                  <Text style={styles.planDay}>{WEEKDAY_SHORT[d]}</Text>
                  <Text style={[styles.planName, !s && styles.rest]}>{s ? s.name : 'Rest'}</Text>
                  {s && <Text style={styles.planCount}>{plural(s.exercises.length, 'exercise')}</Text>}
                </Press>
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
                      {friendlyDate(w.date, today)} · {plural(w.sets, 'set')} · {Math.round(w.volume).toLocaleString('en')} kg
                    </Text>
                  </View>
                  {w.records > 0 && (
                    <View style={styles.historyPr} accessible accessibilityLabel={plural(w.records, 'new best', 'new bests')}>
                      <Ionicons name="trophy" size={14} color={kinds.gym.text} />
                      <Text style={styles.historyPrText}>{w.records}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </Section>
        )}
      </GlassScroll>

      {restEnd !== null && (
        <Animated.View entering={TIMER_IN} exiting={TIMER_OUT} style={[styles.timerSpot, { bottom: fabBottom }]}>
          <Press
            style={styles.timer}
            overlay={colors.material.pressFill}
            onPress={() => setRestEnd(null)}
            accessibilityLabel={`Rest timer, ${restLeft} seconds left. Skip rest`}
          >
            <Ionicons name="timer-outline" size={22} color={colors.onPrimary} />
            <Text style={styles.timerText}>
              Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
            </Text>
            <Text style={styles.timerSkip}>Skip</Text>
          </Press>
        </Animated.View>
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
    prBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: kinds.gym.soft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    prText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: kinds.gym.text },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    historyPr: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    historyPrText: { fontFamily: fonts.monoMedium, fontSize: 14, color: kinds.gym.text, fontVariant: ['tabular-nums'] },
    flex: { flex: 1 },
    content: { padding: 16 },
    welcome: { padding: 24, alignItems: 'center', marginTop: 12 },
    welcomeTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginTop: 12 },
    welcomeText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: 8,
      marginBottom: 12,
    },
    planSlot: { alignSelf: 'stretch', marginTop: 10 },
    buildOwn: { alignSelf: 'stretch', marginTop: 4 },
    planOption: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      padding: 14,
      minHeight: 56,
    },
    planTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    planSummary: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
    todayCard: { padding: 16 },
    sessionName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, color: colors.text },
    cardHint: { marginTop: 12 },
    progressText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, marginTop: 4 },
    track: { marginTop: 12 },
    exercise: { padding: 14, marginTop: 10 },
    exHeader: { flexDirection: 'row', alignItems: 'center' },
    exName: { fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.text },
    exPlan: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 2 },
    exControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    stepBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    weight: {
      minWidth: 84,
      textAlign: 'center',
      fontFamily: fonts.monoMedium,
      fontSize: 15,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    sets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', flexShrink: 1 },
    setBubble: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setText: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
    setTextDone: { color: colors.onKind },
    planRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingVertical: 12, paddingHorizontal: 14 },
    planDay: { width: 52, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    planName: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text },
    rest: { color: colors.muted },
    planCount: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    timerSpot: { position: 'absolute', left: 16, right: 16 },
    timer: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: colors.material.shadowPane,
      borderRadius: radius,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    timerText: { flex: 1, color: colors.onPrimary, fontFamily: fonts.monoMedium, fontSize: 18, fontVariant: ['tabular-nums'] },
    timerSkip: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 15 },
  });
