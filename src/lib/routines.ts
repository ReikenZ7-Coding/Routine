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
  /** Counter routines ("8 glasses of water"): done once the day's count reaches this. */
  target?: number;
  counts?: Record<string, number>;
  /** Days deliberately skipped. They don't break the streak. */
  skipDates?: string[];
  /** Daily reminder time, local. */
  reminder?: { hour: number; minute: number };
  /** Start time on the timeline, "HH:MM". Without it the routine is "anytime". */
  start?: string;
  /** Minutes it takes. */
  duration?: number;
  /** Ionicons name. */
  icon?: string;
  /** Shown as a one-tap shortcut at the top of Today. */
  pinned?: boolean;
}

export const ROUTINE_ICONS = [
  'sunny', 'water', 'barbell', 'body', 'walk', 'bicycle', 'book', 'cafe', 'restaurant', 'bed',
  'medkit', 'leaf', 'brush', 'call', 'laptop', 'musical-notes', 'heart', 'sparkles',
] as const;

const ICON_WORDS: [RegExp, string][] = [
  [/water|drink|hydrat/i, 'water'],
  [/yoga|stretch|pilates/i, 'body'],
  [/gym|lift|workout|push|weights/i, 'barbell'],
  [/walk|steps|run/i, 'walk'],
  [/bike|cycl/i, 'bicycle'],
  [/read|book|study|learn/i, 'book'],
  [/coffee|tea/i, 'cafe'],
  [/eat|cook|meal|breakfast|lunch|dinner/i, 'restaurant'],
  [/sleep|bed|nap/i, 'bed'],
  [/vitamin|pill|med/i, 'medkit'],
  [/plant|garden|meditat|breath/i, 'leaf'],
  [/clean|tidy|teeth|shower/i, 'sparkles'],
  [/call|mum|mom|dad|phone/i, 'call'],
  [/wake|rise|morning|sun/i, 'sunny'],
  [/music|piano|guitar|practi/i, 'musical-notes'],
  [/work|email|code/i, 'laptop'],
];

export function iconFor(r: Pick<Routine, 'name' | 'icon'>): string {
  if (r.icon) return r.icon;
  return ICON_WORDS.find(([re]) => re.test(r.name))?.[1] ?? 'ellipse';
}

export function lastDone(r: Routine, before?: string): string | undefined {
  const dates = before ? r.doneDates.filter((d) => d < before) : r.doneDates;
  return dates.reduce<string | undefined>((max, d) => (!max || d > max ? d : max), undefined);
}

export function isDoneOn(r: Routine, date: string): boolean {
  return r.doneDates.includes(date);
}

export function isSkipped(r: Routine, date: string): boolean {
  return !!r.skipDates?.includes(date);
}

/** Last day the routine was done or skipped before the date: either one "uses up" an occasion. */
function lastHandled(r: Routine, before: string): string | undefined {
  return lastDone({ ...r, doneDates: [...r.doneDates, ...(r.skipDates ?? [])] }, before);
}

/** Should this routine appear on the given day (done or not)? */
export function isScheduled(r: Routine, date: string): boolean {
  if (isDoneOn(r, date) || isSkipped(r, date)) return true;
  switch (r.repeat.kind) {
    case 'once':
      return r.doneDates.length === 0;
    case 'everyNDays': {
      const last = lastHandled(r, date);
      return !last || daysBetween(last, date) >= r.repeat.n;
    }
    case 'weekdays':
      return r.repeat.days.includes(parseKey(date).getDay());
  }
}

export function toggleDone(r: Routine, date: string): Routine {
  const skipDates = r.skipDates?.filter((d) => d !== date);
  return isDoneOn(r, date)
    ? { ...r, skipDates, doneDates: r.doneDates.filter((d) => d !== date) }
    : { ...r, skipDates, doneDates: [...r.doneDates, date] };
}

export function countOn(r: Routine, date: string): number {
  return r.counts?.[date] ?? (isDoneOn(r, date) && r.target ? r.target : 0);
}

/** One tap: +1 on a counter (done when it hits the target, a tap after that starts over), else tick / untick. */
export function tapRoutine(r: Routine, date: string): Routine {
  if (!r.target || r.target < 2) return toggleDone(r, date);
  const next = isDoneOn(r, date) ? 0 : countOn(r, date) + 1;
  const counts = { ...r.counts, [date]: next };
  if (next === 0) delete counts[date];
  const base = { ...r, counts, skipDates: r.skipDates?.filter((d) => d !== date) };
  const doneDates = r.doneDates.filter((d) => d !== date);
  return { ...base, doneDates: next >= r.target ? [...doneDates, date] : doneDates };
}

export function toggleSkip(r: Routine, date: string): Routine {
  if (isSkipped(r, date)) return { ...r, skipDates: r.skipDates!.filter((d) => d !== date) };
  const counts = { ...r.counts };
  delete counts[date];
  return { ...r, counts, doneDates: r.doneDates.filter((d) => d !== date), skipDates: [...(r.skipDates ?? []), date] };
}

/** How many scheduled occasions in a row were completed, counting back from today. */
export function streak(r: Routine, today: string): number {
  const done = new Set(r.doneDates);
  const skipped = new Set(r.skipDates ?? []);
  switch (r.repeat.kind) {
    case 'once':
      return 0;
    case 'weekdays': {
      const days = r.repeat.days;
      if (days.length === 0) return 0;
      let n = 0;
      let day = today;
      for (let i = 0; i < 366; i++, day = addDays(day, -1)) {
        if (!days.includes(parseKey(day).getDay()) || skipped.has(day)) continue;
        if (done.has(day)) n++;
        else if (day !== today) break;
      }
      return n;
    }
    case 'everyNDays': {
      // Skipped days keep the chain alive but don't add to it.
      const sorted = [...new Set([...r.doneDates, ...skipped])].sort().reverse();
      if (sorted.length === 0 || daysBetween(sorted[0], today) > r.repeat.n) return 0;
      let n = done.has(sorted[0]) ? 1 : 0;
      for (let i = 1; i < sorted.length && daysBetween(sorted[i], sorted[i - 1]) <= r.repeat.n; i++) {
        if (done.has(sorted[i])) n++;
      }
      return n;
    }
  }
}

export function sortByTime(routines: Routine[]): Routine[] {
  // Timed routines first, by start; then the rest by time of day.
  const key = (r: Routine) => r.start ?? `~${TIME_ORDER.indexOf(r.time)}`;
  return [...routines].sort((a, b) => key(a).localeCompare(key(b)) || a.name.localeCompare(b.name));
}

export const ROUTINE_IDEAS: Omit<Routine, 'id' | 'doneDates'>[] = [
  { name: 'Rise and shine', repeat: { kind: 'everyNDays', n: 1 }, time: 'morning', start: '07:00', duration: 15, icon: 'sunny' },
  { name: 'Drink water', repeat: { kind: 'everyNDays', n: 1 }, time: 'anytime', target: 8, icon: 'water' },
  { name: 'Stretch', repeat: { kind: 'everyNDays', n: 1 }, time: 'evening', start: '21:00', duration: 10, icon: 'body' },
  { name: 'Read 20 pages', repeat: { kind: 'everyNDays', n: 1 }, time: 'evening', start: '21:30', duration: 30, icon: 'book' },
  { name: 'Clean the room', repeat: { kind: 'weekdays', days: [6] }, time: 'morning', start: '10:00', duration: 45, icon: 'sparkles' },
];

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function routineSubtitle(r: Routine, today: string): string {
  if (isSkipped(r, today)) return 'Skipped · streak kept';
  const s = streak(r, today);
  return [
    r.start ?? (r.reminder ? formatTime(r.reminder.hour, r.reminder.minute) : TIME_LABELS[r.time]),
    describeRepeat(r.repeat),
    s > 1 ? `${s} in a row` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** When to fire reminders: one daily trigger, or one weekly trigger per chosen weekday (1 = Sunday). */
export function reminderTriggers(r: Routine): { weekday?: number; hour: number; minute: number }[] {
  if (!r.reminder) return [];
  const { hour, minute } = r.reminder;
  if (r.repeat.kind === 'weekdays') return r.repeat.days.map((d) => ({ weekday: d + 1, hour, minute }));
  if (r.repeat.kind === 'once' && r.doneDates.length > 0) return [];
  return [{ hour, minute }];
}
