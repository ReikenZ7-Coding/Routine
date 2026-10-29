// Pure logic for custom routines (stretching, reading, meds, anything on a schedule).
import { type Repeat, addDays, daysBetween, describeRepeat, parseKey } from './schedule.ts';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

const TIME_ORDER: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];

export interface Routine {
  id: string;
  name: string;
  repeat: Repeat;
  time: TimeOfDay;
  /** Date keys the routine was completed on. */
  doneDates: string[];
}

export function lastDone(r: Routine, before?: string): string | undefined {
  const dates = before ? r.doneDates.filter((d) => d < before) : r.doneDates;
  return dates.reduce<string | undefined>((max, d) => (!max || d > max ? d : max), undefined);
}

export function isDoneOn(r: Routine, date: string): boolean {
  return r.doneDates.includes(date);
}

/** Should this routine appear on the given day (done or not)? */
export function isScheduled(r: Routine, date: string): boolean {
  if (isDoneOn(r, date)) return true;
  switch (r.repeat.kind) {
    case 'once':
      return r.doneDates.length === 0;
    case 'everyNDays': {
      const last = lastDone(r, date);
      return !last || daysBetween(last, date) >= r.repeat.n;
    }
    case 'weekdays':
      return r.repeat.days.includes(parseKey(date).getDay());
  }
}

export function toggleDone(r: Routine, date: string): Routine {
  return isDoneOn(r, date)
    ? { ...r, doneDates: r.doneDates.filter((d) => d !== date) }
    : { ...r, doneDates: [...r.doneDates, date] };
}

/** How many scheduled occasions in a row were completed, counting back from today. */
export function streak(r: Routine, today: string): number {
  const done = new Set(r.doneDates);
  switch (r.repeat.kind) {
    case 'once':
      return 0;
    case 'weekdays': {
      const days = r.repeat.days;
      if (days.length === 0) return 0;
      let n = 0;
      let day = today;
      for (let i = 0; i < 366; i++, day = addDays(day, -1)) {
        if (!days.includes(parseKey(day).getDay())) continue;
        if (done.has(day)) n++;
        else if (day !== today) break;
      }
      return n;
    }
    case 'everyNDays': {
      const sorted = [...r.doneDates].sort().reverse();
      if (sorted.length === 0 || daysBetween(sorted[0], today) > r.repeat.n) return 0;
      let n = 1;
      for (let i = 1; i < sorted.length && daysBetween(sorted[i], sorted[i - 1]) <= r.repeat.n; i++) n++;
      return n;
    }
  }
}

export function sortByTime(routines: Routine[]): Routine[] {
  return [...routines].sort(
    (a, b) => TIME_ORDER.indexOf(a.time) - TIME_ORDER.indexOf(b.time) || a.name.localeCompare(b.name),
  );
}

export const ROUTINE_IDEAS: Omit<Routine, 'id' | 'doneDates'>[] = [
  { name: 'Drink 2 L of water', repeat: { kind: 'everyNDays', n: 1 }, time: 'anytime' },
  { name: 'Stretch 10 minutes', repeat: { kind: 'everyNDays', n: 1 }, time: 'evening' },
  { name: 'Read 20 pages', repeat: { kind: 'everyNDays', n: 1 }, time: 'evening' },
  { name: 'Clean the room', repeat: { kind: 'weekdays', days: [6] }, time: 'morning' },
];

export function routineSubtitle(r: Routine, today: string): string {
  const s = streak(r, today);
  return [TIME_LABELS[r.time], describeRepeat(r.repeat), s > 1 ? `${s} in a row` : ''].filter(Boolean).join(' · ');
}
