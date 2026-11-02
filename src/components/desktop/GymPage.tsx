// The gym on the desktop: today's session as the hero (each exercise on one row with its weight stepper and set
// bubbles, a rest timer that starts on its own), and beside it the weekly plan, the last workouts and the personal
// records. The same plan, logs and sums as the phone's Gym (lib/gym, lib/records).
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
} from '../../lib/gym';
import { plural } from '../../lib/plural';
import { isRecord, personalRecords, workoutHistory } from '../../lib/records';
import { WEEKDAY_SHORT, friendlyDate, friendlyDateInline } from '../../lib/schedule';
import { newId, useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { washOf } from '../glass/colour';
import { Bar, Collapse, FadeSwap, SelectFade } from '../Motion';
import { SessionForm } from '../SessionForm';
import { Hover } from './Hover';
import { Empty, IconButton, Pill, useRowText } from './Kit';
import { SHELL } from './layout';
import { Column, Fig, GlassButton, Page, Panel, Row } from './Page';

const REST_SECONDS = 90;
const WEIGHT_STEP = 2.5;
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function GymPage() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const text = useRowText();
  const { today, gym, updateGym } = useStore();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState<Session | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [anyway, setAnyway] = useState<string | undefined>();

  useEffect(() => {
    if (restEnd === null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [restEnd]);
  const restLeft = restEnd === null ? 0 : Math.max(0, Math.ceil((restEnd - now) / 1000));
  useEffect(() => {
    if (restEnd !== null && restLeft === 0) setRestEnd(null);
  }, [restEnd, restLeft]);

  const planned = sessionFor(gym, today);
  // On a rest day a session done anyway stays on screen: the one picked, or the one already logged today.
  const extraId = anyway ?? (planned ? undefined : gym.logs.find((l) => l.date === today)?.sessionId);
  const session = planned ?? gym.sessions.find((s) => s.id === extraId);
  const upcoming = planned ? undefined : nextSession(gym, today);
  const history = workoutHistory(gym).slice(0, 5);
  const prs = personalRecords(gym.logs).slice(0, 5);
  const perWeek = gym.sessions.reduce((n, s) => n + s.days.length, 0);
  const progress = session ? sessionProgress(gym, today, session) : undefined;

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

  const form = (
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
  );

  if (gym.sessions.length === 0) {
    return (
      <Page
        title="Gym"
        subtitle="Pick a plan to start with, or build your own."
        actions={<GlassButton label="Build my own" icon="add" onPress={() => openSession()} />}
      >
        <Row>
          <Panel span={8} index={0} title="Your training plan" subtitle="Each day shows what to train, and what you lifted last time">
            {STARTER_PLANS.map((p, i) => (
              <Hover
                key={p.id}
                onPress={() => updateGym((g) => ({ ...g, sessions: buildSessions(p.sessions, newId) }))}
                style={[styles.planOption, i > 0 && styles.rule]}
                radius={12}
                accessibilityLabel={`${p.title}. ${p.summary}`}
              >
                <View style={styles.pebble}>
                  <Ionicons name="barbell-outline" size={20} color={kinds.gym.text} />
                </View>
                <View style={styles.flex}>
                  <Text style={text.rowTitle}>{p.title}</Text>
                  <Text style={text.rowMeta}>{p.summary}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Hover>
            ))}
          </Panel>
        </Row>
        {form}
      </Page>
    );
  }

  const restLine = (
    <>
      {' · '}
      <Fig>{plural(perWeek, 'session')}</Fig> a week
    </>
  );

  return (
    <Page
      title="Gym"
      subtitle={
        session && progress ? (
          <>
            <Fig>{session.name}</Fig> {planned ? 'today' : 'today, on a rest day'} ·{' '}
            <Fig>
              {progress.done} of {progress.total}
            </Fig>{' '}
            sets{restLine}
          </>
        ) : (
          <>
            Rest day{upcoming ? ` · Next: ${upcoming.session.name} on ${WEEKDAY_LONG[new Date(`${upcoming.date}T12:00:00`).getDay()]}` : ''}
            {restLine}
          </>
        )
      }
      actions={<GlassButton label="Add session" icon="add" onPress={() => openSession()} />}
    >
      <Row>
        <Column span={8}>
          {session && progress ? (
            <Panel span={8} index={0} tier="hero" bloom>
              <View style={styles.heroHead}>
                <View style={styles.flex}>
                  <Text style={styles.sessionName} role="heading" aria-level={2}>
                    {session.name}
                  </Text>
                  <Text style={styles.progressText}>
                    {progress.done === progress.total
                      ? 'Workout complete. Nice work!'
                      : `Today · ${progress.done} of ${plural(progress.total, 'set')}`}
                  </Text>
                </View>
                <Collapse open={restEnd !== null}>
                  <Hover
                    onPress={() => setRestEnd(null)}
                    squeeze
                    style={styles.timer}
                    radius={20}
                    accessibilityLabel={`Rest timer, ${restLeft} seconds left. Skip rest`}
                  >
                    <Ionicons name="timer-outline" size={18} color={colors.onPrimary} />
                    <Text style={styles.timerText}>
                      Rest {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
                    </Text>
                    <Text style={styles.timerSkip}>Skip</Text>
                  </Hover>
                </Collapse>
              </View>
              <View style={styles.track}>
                <Bar progress={progress.done / Math.max(1, progress.total)} color={kinds.gym.color} track={colors.track} height={8} />
              </View>
              <Text style={[type.hint, styles.hint]}>Click a set when you finish it. A rest timer starts on its own.</Text>
              {session.exercises.map((e) => {
                const last = lastTime(gym, e.name, today);
                const weight = weightFor(session, e);
                return (
                  <View key={e.id} style={styles.exercise}>
                    <View style={styles.flex}>
                      <View style={styles.exTitle}>
                        <Text style={styles.exName}>{e.name}</Text>
                        {isRecord(gym.logs, e.name, today) ? (
                          <View style={[styles.best, { backgroundColor: washOf(kinds.gym.soft, SHELL.wash) }]}>
                            <Ionicons name="trophy" size={13} color={kinds.gym.text} />
                            <Text style={[styles.bestText, { color: kinds.gym.text }]}>New best</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={text.rowMeta}>
                        {e.sets} × {e.reps}
                        {last ? `  ·  Last: ${formatWeight(last.weight)} × ${last.reps}, ${friendlyDate(last.date, today)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.stepper}>
                      <IconButton
                        icon="remove"
                        label={`Lower ${e.name} weight`}
                        size={36}
                        bare
                        onPress={() => changeWeight(session, e, -WEIGHT_STEP)}
                      />
                      <Text
                        style={[styles.weight, weight === 0 && styles.weightWord]}
                        accessibilityLabel={`${e.name} weight, ${formatWeight(weight)}`}
                      >
                        {formatWeight(weight)}
                      </Text>
                      <IconButton
                        icon="add"
                        label={`Raise ${e.name} weight`}
                        size={36}
                        bare
                        onPress={() => changeWeight(session, e, WEIGHT_STEP)}
                      />
                    </View>
                    <View style={styles.sets}>
                      {Array.from({ length: e.sets }, (_, i) => {
                        const done = isSetDone(gym, today, session.id, e.id, i);
                        return (
                          <Hover
                            key={i}
                            onPress={() => tapSet(session, e, i)}
                            squeeze
                            style={styles.bubble}
                            radius={20}
                            role="checkbox"
                            aria={{ 'aria-checked': done }}
                            accessibilityLabel={`${e.name} set ${i + 1}`}
                          >
                            <SelectFade on={done} color={kinds.gym.color} radius={20} bleed={1.5} />
                            <FadeSwap
                              on={done}
                              off={<Text style={styles.setText}>{i + 1}</Text>}
                              onContent={<Text style={[styles.setText, styles.setDone]}>{e.reps}</Text>}
                            />
                          </Hover>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
              {!planned ? (
                <View style={styles.anyway}>
                  <Pill
                    label="Back to rest"
                    icon="close"
                    onPress={() => setAnyway('')}
                    accessibilityLabel="Stop this session and show the rest day"
                  />
                </View>
              ) : null}
            </Panel>
          ) : (
            <Panel span={8} index={0} tier="hero" bloom>
              <Text style={styles.sessionName} role="heading" aria-level={2}>
                Rest day
              </Text>
              <Text style={styles.progressText}>
                {upcoming
                  ? `Next: ${upcoming.session.name}, ${friendlyDateInline(upcoming.date, today)}`
                  : 'No sessions scheduled this week.'}
              </Text>
              <Text style={[type.label, styles.anywayLabel]}>Do a session anyway</Text>
              <View style={styles.anywayRow} role="group" aria-label="Do a session anyway">
                {gym.sessions.map((s) => (
                  <Pill
                    key={s.id}
                    label={s.name}
                    icon="barbell-outline"
                    onPress={() => setAnyway(s.id)}
                    accessibilityLabel={`Do ${s.name} today`}
                  />
                ))}
              </View>
            </Panel>
          )}
          {/* Under the hero, so the two columns end close together. */}
          <Panel span={8} index={2} title="History" subtitle="Your last workouts">
            {history.length === 0 ? (
              <Empty>Your workouts show here once you tick off a set.</Empty>
            ) : (
              history.map((w, i) => (
                <View key={w.date} style={[styles.histRow, i > 0 && styles.rule]}>
                  <View style={styles.flex}>
                    <Text style={styles.planName}>{w.sessionName}</Text>
                    <Text style={text.rowMeta}>
                      {friendlyDate(w.date, today)} · {plural(w.sets, 'set')} · {Math.round(w.volume).toLocaleString('en')} kg
                    </Text>
                  </View>
                  {w.records > 0 ? (
                    <View style={styles.histBest} accessible accessibilityLabel={plural(w.records, 'new best', 'new bests')}>
                      <Ionicons name="trophy" size={14} color={kinds.gym.text} />
                      <Text style={[styles.num, { color: kinds.gym.text }]}>{w.records}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </Panel>
        </Column>
        <Column span={4}>
          <Panel span={4} index={1} title="Weekly plan" subtitle={`${plural(perWeek, 'session')} a week`}>
            {WEEK.map((d, i) => {
              const s = gym.sessions.find((x) => x.days.includes(d));
              const isToday = new Date(`${today}T12:00:00`).getDay() === d;
              const label = s
                ? `${WEEKDAY_LONG[d]}, ${s.name}, ${plural(s.exercises.length, 'exercise')}${isToday ? ', today' : ''}. Edit session`
                : `${WEEKDAY_LONG[d]}, rest${isToday ? ', today' : ''}`;
              const body = (
                <>
                  <Text style={[styles.planDay, isToday && { color: colors.text }]}>{WEEKDAY_SHORT[d]}</Text>
                  <Text style={[styles.planName, !s && { color: colors.muted }]} numberOfLines={1}>
                    {s ? s.name : 'Rest'}
                  </Text>
                  {s ? <Text style={text.rowMeta}>{plural(s.exercises.length, 'exercise')}</Text> : null}
                </>
              );
              return s ? (
                <Hover
                  key={d}
                  onPress={() => openSession(s)}
                  style={[styles.planRow, i > 0 && styles.rule]}
                  radius={10}
                  accessibilityLabel={label}
                >
                  {body}
                </Hover>
              ) : (
                <View key={d} style={[styles.planRow, i > 0 && styles.rule]} accessible accessibilityLabel={label}>
                  {body}
                </View>
              );
            })}
          </Panel>
          <Panel span={4} index={3} title="Personal records" subtitle="Your heaviest set of each lift">
            {prs.length === 0 ? (
              <Empty>Log a workout and your best lifts show up here.</Empty>
            ) : (
              prs.map((p, i) => (
                <View key={p.name} style={[styles.histRow, i > 0 && styles.rule]}>
                  <View style={styles.flex}>
                    <Text style={styles.planName}>{p.name}</Text>
                    <Text style={text.rowMeta}>{friendlyDate(p.date, today)}</Text>
                  </View>
                  <Text style={styles.num}>
                    {formatWeight(p.weight)} × {p.reps}
                  </Text>
                </View>
              ))
            )}
          </Panel>
        </Column>
      </Row>
      {form}
    </Page>
  );
}

const makeStyles = ({ colors, fonts, radii }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    rule: { borderTopWidth: 1, borderTopColor: colors.border },
    pebble: {
      width: 40,
      height: 40,
      borderRadius: radii.inset,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    planOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 64,
      paddingVertical: 10,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    heroHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    sessionName: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: colors.text },
    progressText: { fontFamily: fonts.body, fontSize: 16, color: colors.muted, marginTop: 4 },
    track: { marginTop: 14 },
    hint: { marginTop: 12, marginBottom: 8 },
    timer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    timerText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onPrimary, fontVariant: ['tabular-nums'] },
    timerSkip: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.onPrimary },
    exercise: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      minHeight: 72,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    exTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    exName: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.text },
    best: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    bestText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
      backgroundColor: inset.fill,
      borderRadius: radii.inset + 2,
      padding: 2,
    },
    weight: {
      minWidth: 84,
      textAlign: 'center',
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    weightWord: { fontFamily: fonts.bodyMedium },
    sets: { flexDirection: 'row', gap: 6 },
    bubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    setText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
    setDone: { color: colors.onKind },
    anyway: { flexDirection: 'row', marginTop: 12 },
    anywayLabel: { marginTop: 20, marginBottom: 8 },
    anywayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 8, marginHorizontal: -8 },
    planDay: { width: 44, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    planName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
    histBest: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    num: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  });
};
