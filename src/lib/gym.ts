// Pure gym plan + logging logic. No React Native imports so it can be unit tested with plain Node.

// Kept local (same as schedule.ts) so this file has no imports and runs under plain Node tests.
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface PlanExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  /** Starting weight in kg; 0 for bodyweight. */
  weight: number;
}

export interface Session {
  id: string;
  name: string;
  /** Weekdays this session is trained, 0 = Sunday ... 6 = Saturday. */
  days: number[];
  exercises: PlanExercise[];
}

export interface SetLog {
  date: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string;
  set: number; // 0-based
  reps: number;
  weight: number;
}

export interface GymState {
  sessions: Session[];
  logs: SetLog[];
}

export const EMPTY_GYM: GymState = { sessions: [], logs: [] };

export function sessionFor(state: GymState, date: string): Session | undefined {
  const day = parseKey(date).getDay();
  return state.sessions.find((s) => s.days.includes(day));
}

export function logsFor(state: GymState, date: string, sessionId: string): SetLog[] {
  return state.logs.filter((l) => l.date === date && l.sessionId === sessionId);
}

export function isSetDone(state: GymState, date: string, sessionId: string, exerciseId: string, set: number): boolean {
  return state.logs.some(
    (l) => l.date === date && l.sessionId === sessionId && l.exerciseId === exerciseId && l.set === set,
  );
}

export function sessionProgress(state: GymState, date: string, session: Session): { done: number; total: number } {
  const total = session.exercises.reduce((n, e) => n + e.sets, 0);
  const done = session.exercises.reduce(
    (n, e) => n + Array.from({ length: e.sets }, (_, i) => isSetDone(state, date, session.id, e.id, i)).filter(Boolean).length,
    0,
  );
  return { done, total };
}

/** The most recent earlier workout for an exercise (matched by name, so it survives plan edits). */
export function lastTime(state: GymState, exerciseName: string, before: string): { date: string; weight: number; reps: number } | undefined {
  const key = exerciseName.trim().toLowerCase();
  const past = state.logs.filter((l) => l.date < before && l.exerciseName.trim().toLowerCase() === key);
  if (past.length === 0) return undefined;
  const date = past.reduce((d, l) => (l.date > d ? l.date : d), past[0].date);
  const sameDay = past.filter((l) => l.date === date);
  const top = sameDay.reduce((best, l) => (l.weight > best.weight ? l : best), sameDay[0]);
  return { date, weight: top.weight, reps: top.reps };
}

/** Weight to show for today: what you already used today, else last time's top weight, else the plan. */
export function workingWeight(state: GymState, date: string, session: Session, exercise: PlanExercise): number {
  const todays = logsFor(state, date, session.id).filter((l) => l.exerciseId === exercise.id);
  if (todays.length) return todays[todays.length - 1].weight;
  return lastTime(state, exercise.name, date)?.weight ?? exercise.weight;
}

export function toggleSet(
  state: GymState,
  date: string,
  session: Session,
  exercise: PlanExercise,
  set: number,
  weight: number,
): GymState {
  const match = (l: SetLog) =>
    l.date === date && l.sessionId === session.id && l.exerciseId === exercise.id && l.set === set;
  if (state.logs.some(match)) return { ...state, logs: state.logs.filter((l) => !match(l)) };
  const log: SetLog = {
    date,
    sessionId: session.id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    set,
    reps: exercise.reps,
    weight,
  };
  return { ...state, logs: [...state.logs, log] };
}

/** Change today's weight for an exercise, updating any sets already logged today. */
export function setTodaysWeight(state: GymState, date: string, sessionId: string, exerciseId: string, weight: number): GymState {
  return {
    ...state,
    logs: state.logs.map((l) =>
      l.date === date && l.sessionId === sessionId && l.exerciseId === exerciseId ? { ...l, weight } : l,
    ),
  };
}

/** Next date (after `date`) with a session, within a week. */
export function nextSession(state: GymState, date: string): { date: string; session: Session } | undefined {
  const d = parseKey(date);
  for (let i = 1; i <= 7; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    const s = state.sessions.find((x) => x.days.includes(next.getDay()));
    if (s) {
      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, '0');
      const day = String(next.getDate()).padStart(2, '0');
      return { date: `${y}-${m}-${day}`, session: s };
    }
  }
  return undefined;
}

export function formatWeight(kg: number): string {
  if (kg === 0) return 'Bodyweight';
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}

type Template = { name: string; days: number[]; exercises: [string, number, number, number][] };

const PUSH: Template['exercises'] = [
  ['Bench press', 3, 8, 40],
  ['Overhead press', 3, 8, 25],
  ['Incline dumbbell press', 3, 10, 14],
  ['Triceps pushdown', 3, 12, 20],
];
const PULL: Template['exercises'] = [
  ['Deadlift', 3, 5, 60],
  ['Lat pulldown', 3, 10, 40],
  ['Seated row', 3, 10, 35],
  ['Biceps curl', 3, 12, 10],
];
const LEGS: Template['exercises'] = [
  ['Squat', 3, 8, 50],
  ['Romanian deadlift', 3, 10, 40],
  ['Leg press', 3, 12, 80],
  ['Calf raise', 3, 15, 30],
];
const FULL_A: Template['exercises'] = [
  ['Squat', 3, 8, 40],
  ['Bench press', 3, 8, 40],
  ['Seated row', 3, 10, 35],
  ['Plank (sec)', 3, 30, 0],
];
const FULL_B: Template['exercises'] = [
  ['Deadlift', 3, 5, 50],
  ['Overhead press', 3, 8, 25],
  ['Lat pulldown', 3, 10, 40],
  ['Lunges', 3, 10, 0],
];

export const STARTER_PLANS: { id: string; title: string; summary: string; sessions: Template[] }[] = [
  {
    id: 'ppl',
    title: 'Push / Pull / Legs',
    summary: '6 days: Mon–Sat, Sunday off',
    sessions: [
      { name: 'Push', days: [1, 4], exercises: PUSH },
      { name: 'Pull', days: [2, 5], exercises: PULL },
      { name: 'Legs', days: [3, 6], exercises: LEGS },
    ],
  },
  {
    id: 'full',
    title: 'Full body',
    summary: '3 days: Mon, Wed, Fri',
    sessions: [
      { name: 'Full body A', days: [1, 5], exercises: FULL_A },
      { name: 'Full body B', days: [3], exercises: FULL_B },
    ],
  },
];

export function buildSessions(templates: Template[], newId: () => string): Session[] {
  return templates.map((t) => ({
    id: newId(),
    name: t.name,
    days: t.days,
    exercises: t.exercises.map(([name, sets, reps, weight]) => ({ id: newId(), name, sets, reps, weight })),
  }));
}
