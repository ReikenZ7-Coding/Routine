// Personal records and workout history, worked out from the set logs.
import type { GymState, SetLog } from './gym.ts';

const norm = (name: string) => name.trim().toLowerCase();

/** Heaviest weight ever lifted for an exercise before a date. */
export function bestBefore(logs: SetLog[], exerciseName: string, before: string): number {
  const key = norm(exerciseName);
  return logs.reduce((max, l) => (l.date < before && norm(l.exerciseName) === key && l.weight > max ? l.weight : max), 0);
}

/** True when this day's top weight for the exercise beats every earlier day. A first ever lift isn't a record. */
export function isRecord(logs: SetLog[], exerciseName: string, date: string): boolean {
  const key = norm(exerciseName);
  const hadBefore = logs.some((l) => l.date < date && norm(l.exerciseName) === key);
  if (!hadBefore) return false;
  const today = logs.filter((l) => l.date === date && norm(l.exerciseName) === key);
  if (today.length === 0) return false;
  return Math.max(...today.map((l) => l.weight)) > bestBefore(logs, exerciseName, date);
}

export interface PersonalRecord {
  name: string;
  weight: number;
  reps: number;
  date: string;
}

/** Best lift per exercise, heaviest first. */
export function personalRecords(logs: SetLog[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const l of logs) {
    if (l.weight <= 0) continue;
    const key = norm(l.exerciseName);
    const cur = best.get(key);
    if (!cur || l.weight > cur.weight || (l.weight === cur.weight && l.reps > cur.reps)) {
      best.set(key, { name: l.exerciseName, weight: l.weight, reps: l.reps, date: l.date });
    }
  }
  return [...best.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

export interface Workout {
  date: string;
  sessionName: string;
  sets: number;
  /** Sum of weight × reps, in kg. */
  volume: number;
  records: number;
}

/** One entry per day trained, newest first. */
export function workoutHistory(state: GymState): Workout[] {
  const byDate = new Map<string, SetLog[]>();
  for (const l of state.logs) byDate.set(l.date, [...(byDate.get(l.date) ?? []), l]);
  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, logs]) => {
      const names = [...new Set(logs.map((l) => l.exerciseName))];
      const session = state.sessions.find((s) => s.id === logs[0].sessionId);
      return {
        date,
        sessionName: session?.name ?? 'Workout',
        sets: logs.length,
        volume: logs.reduce((v, l) => v + l.weight * l.reps, 0),
        records: names.filter((n) => isRecord(state.logs, n, date)).length,
      };
    });
}
