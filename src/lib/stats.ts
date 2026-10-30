// Numbers for the "Your week" overview.
import type { ChineseState } from './chinese.ts';
import type { GymState } from './gym.ts';
import { type Routine, isDoneOn, isScheduled, isSkipped, streak } from './routines.ts';
import { addDays } from './schedule.ts';

export interface WeekStats {
  /** Routine occasions done / planned over the last 7 days (skips don't count against you). */
  routinesDone: number;
  routinesPlanned: number;
  /** One bar per day, oldest first: share of that day's routines done (0..1), or null if nothing was planned. */
  days: { date: string; share: number | null }[];
  gymDays: number;
  gymVolume: number;
  chineseMinutes: number;
  bestStreaks: { name: string; streak: number }[];
}

export function weekStats(routines: Routine[], gym: GymState, chinese: ChineseState, today: string): WeekStats {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  let routinesDone = 0;
  let routinesPlanned = 0;
  const days = dates.map((date) => {
    const planned = routines.filter((r) => isScheduled(r, date) && !isSkipped(r, date));
    const done = planned.filter((r) => isDoneOn(r, date)).length;
    routinesDone += done;
    routinesPlanned += planned.length;
    return { date, share: planned.length ? done / planned.length : null };
  });
  const from = dates[0];
  const weekLogs = gym.logs.filter((l) => l.date >= from && l.date <= today);
  return {
    routinesDone,
    routinesPlanned,
    days,
    gymDays: new Set(weekLogs.map((l) => l.date)).size,
    gymVolume: weekLogs.reduce((v, l) => v + l.weight * l.reps, 0),
    chineseMinutes: chinese.logs.filter((l) => l.date >= from && l.date <= today).reduce((m, l) => m + l.minutes, 0),
    bestStreaks: routines
      .map((r) => ({ name: r.name, streak: streak(r, today) }))
      .filter((s) => s.streak > 1)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3),
  };
}
