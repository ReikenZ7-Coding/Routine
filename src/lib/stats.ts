// Numbers for the "Your week" overview.
import type { LanguageState } from './language.ts';
import type { GymState } from './gym.ts';
import { type Routine, isDoneOn, isScheduled, isSkipped, streak } from './routines.ts';
import { addDays } from './schedule.ts';

export interface WeekStats {
  /** Routine occasions done / planned over the last 7 days (skips don't count against you). */
  routinesDone: number;
  routinesPlanned: number;
  /** One bar per day, oldest first: share of that day's routines done (0..1), or null if nothing was planned. */
  days: { date: string; share: number | null; done: number; planned: number }[];
  gymDays: number;
  gymVolume: number;
  /** Language practice minutes, across every language. */
  practiceMinutes: number;
  bestStreaks: { name: string; streak: number }[];
}

export function weekStats(routines: Routine[], gym: GymState, language: Pick<LanguageState, 'logs'>, today: string): WeekStats {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  let routinesDone = 0;
  let routinesPlanned = 0;
  const days = dates.map((date) => {
    const planned = routines.filter((r) => isScheduled(r, date) && !isSkipped(r, date));
    const done = planned.filter((r) => isDoneOn(r, date)).length;
    routinesDone += done;
    routinesPlanned += planned.length;
    return { date, share: planned.length ? done / planned.length : null, done, planned: planned.length };
  });
  const from = dates[0];
  const weekLogs = gym.logs.filter((l) => l.date >= from && l.date <= today);
  return {
    routinesDone,
    routinesPlanned,
    days,
    gymDays: new Set(weekLogs.map((l) => l.date)).size,
    gymVolume: weekLogs.reduce((v, l) => v + l.weight * l.reps, 0),
    practiceMinutes: language.logs.filter((l) => l.date >= from && l.date <= today).reduce((m, l) => m + l.minutes, 0),
    bestStreaks: routines
      .map((r) => ({ name: r.name, streak: streak(r, today) }))
      .filter((s) => s.streak > 1)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3),
  };
}

/**
 * Days in a row where every planned routine got done, counting back from today.
 * Today only counts once it's complete; a day with nothing planned neither adds nor breaks.
 */
export function dayStreak(routines: Routine[], today: string): number {
  const repeating = routines.filter((r) => r.repeat.kind !== 'once');
  let n = 0;
  let day = today;
  for (let i = 0; i < 366; i++, day = addDays(day, -1)) {
    const planned = repeating.filter((r) => isScheduled(r, day) && !isSkipped(r, day));
    if (planned.length === 0) continue;
    if (planned.every((r) => isDoneOn(r, day))) n++;
    else if (day !== today) break;
  }
  return n;
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'anytime';

/** The part of the day a routine belongs to: its start time when it has one, else its chosen time. */
export function partOf(r: Pick<Routine, 'start' | 'time'>): DayPart {
  if (r.start) {
    const hour = Number(r.start.slice(0, 2));
    return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  }
  return r.time;
}

export interface WhenCell {
  planned: number;
  done: number;
}

/**
 * When things get done: for each part of the day, seven cells from Monday to Sunday, each the routine occasions
 * planned there over the last `days` days up to today (skips left out) and how many got done.
 */
export function whenDone(routines: Routine[], today: string, days = 28): Record<DayPart, WhenCell[]> {
  const empty = () => Array.from({ length: 7 }, () => ({ planned: 0, done: 0 }));
  const out: Record<DayPart, WhenCell[]> = { morning: empty(), afternoon: empty(), evening: empty(), anytime: empty() };
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i);
    const [y, m, d] = date.split('-').map(Number);
    const monFirst = (new Date(y, m - 1, d).getDay() + 6) % 7;
    for (const r of routines) {
      if (!isScheduled(r, date) || isSkipped(r, date)) continue;
      const cell = out[partOf(r)][monFirst];
      cell.planned++;
      if (isDoneOn(r, date)) cell.done++;
    }
  }
  return out;
}
