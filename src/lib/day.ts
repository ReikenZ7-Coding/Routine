// What a day holds across every part of the app, and what needs the person now. Pure, so Today, the desktop
// Overview, the sidebar's counts and the reminders bell all read the same sums, and tests can ask about any
// date and minute.
import { type GymState, nextSession, type Session, sessionFor, sessionProgress } from './gym.ts';
import { type InboxItem, inboxOpen, itemsFor } from './inbox.ts';
import { type LanguageState, dueWords, todaysLog } from './language.ts';
import { type Routine, isDoneOn, isScheduled, isSkipped, sortByTime } from './routines.ts';
import { type GroceryItem, addDays, boughtOn, isOnList, needsBuying } from './schedule.ts';
import { type TimedEntry, clock, parseClock, timedRoutines, upNext } from './timeline.ts';

/** Everything the day sums read. */
export interface LifeState {
  routines: Routine[];
  inbox: InboxItem[];
  groceries: GroceryItem[];
  gym: GymState;
  language: LanguageState;
}

export interface DayPlan {
  /** Every routine on the day (done, skipped or open), timed ones first. */
  routines: Routine[];
  /** The routines that count: on the day and not skipped. */
  planned: Routine[];
  timed: TimedEntry[];
  anytime: Routine[];
  todos: InboxItem[];
  session?: Session;
  gym?: { done: number; total: number };
  gymDone: boolean;
  /** Practice joins the day once a language is chosen; a past day keeps it if minutes were logged. */
  showPractice: boolean;
  practice: { minutes: number; target: number };
  practiceDone: boolean;
  /** The day's shopping (what was bought, for a past day), not yet bought first. */
  groceries: GroceryItem[];
  /** Every routine, to-do and grocery item counts once, the workout and practice once each. */
  done: number;
  total: number;
}

/** The day's things and its progress, exactly as Today counts them. */
export function dayPlan(state: LifeState, date: string, today: string): DayPlan {
  const isPast = date < today;
  const routines = sortByTime(state.routines.filter((r) => isScheduled(r, date)));
  const { timed, anytime } = timedRoutines(routines);
  const todos = itemsFor(state.inbox, date);
  const session = sessionFor(state.gym, date);
  const gym = session ? sessionProgress(state.gym, date, session) : undefined;
  const gymDone = !!gym && gym.total > 0 && gym.done === gym.total;
  const log = todaysLog(state.language, date);
  const practiceDone = log.minutes >= state.language.target;
  const showPractice = (state.language.languages.length > 0 && !isPast) || log.minutes > 0;
  const groceries = (isPast ? state.groceries.filter((g) => g.lastBought === date) : state.groceries.filter((g) => isOnList(g, date))).sort(
    (a, b) => Number(boughtOn(a, date)) - Number(boughtOn(b, date)) || a.name.localeCompare(b.name),
  );
  const planned = routines.filter((r) => !isSkipped(r, date));
  const done =
    planned.filter((r) => isDoneOn(r, date)).length +
    todos.filter((t) => t.doneOn).length +
    groceries.filter((g) => boughtOn(g, date)).length +
    (gymDone ? 1 : 0) +
    (showPractice && practiceDone ? 1 : 0);
  const total = planned.length + todos.length + groceries.length + (session ? 1 : 0) + (showPractice ? 1 : 0);
  return {
    routines,
    planned,
    timed,
    anytime,
    todos,
    session,
    gym,
    gymDone,
    showPractice,
    practice: { minutes: log.minutes, target: state.language.target },
    practiceDone,
    groceries,
    done,
    total,
  };
}

/** The counts beside the desktop sidebar's items. Zero means no count is shown. */
export interface NavCounts {
  /** Steps still to do today. */
  today: number;
  /** To-dos waiting in the inbox (no day yet, or a day that passed). */
  inbox: number;
  /** Words due for review. */
  language: number;
  /** Grocery items still to buy today. */
  groceries: number;
}

export function navCounts(state: LifeState, today: string): NavCounts {
  const plan = dayPlan(state, today, today);
  return {
    today: Math.max(0, plan.total - plan.done),
    inbox: inboxOpen(state.inbox, today).length,
    language: dueWords(state.language, today).length,
    groceries: state.groceries.filter((g) => needsBuying(g, today)).length,
  };
}

export type NeedKind = 'routines' | 'inbox' | 'chinese' | 'gym' | 'groceries';

/** One thing that needs the person now, most urgent first in the list `needsYou` returns. */
export interface Need {
  key: string;
  kind: NeedKind;
  /** Ionicons name. */
  icon: string;
  title: string;
  /** One short line: when, or how much. */
  meta: string;
  /** A short fact for the right-hand side of a compact row ("21:00", "2", "late"). */
  fact: string;
  /** Where pressing it goes. */
  to: 'today' | 'inbox' | 'language' | 'gym' | 'groceries';
  /** A routine or to-do that can be ticked off right where it is shown. */
  tick?: { routine?: string; todo?: string };
}

/** Minutes ahead within which a timed step counts as "up next" and needs you. */
export const SOON = 60;

/**
 * What needs the person now, most urgent first: timed steps whose time passed today and are still open, what is
 * happening now or starts within the hour, today's to-dos, words to review, today's workout if unfinished, the
 * shopping, then the inbox to sort. Calm words: "still open", never "overdue".
 */
export function needsYou(state: LifeState, today: string, now: number): Need[] {
  const plan = dayPlan(state, today, today);
  const out: Need[] = [];
  const open = (r: Routine) => !isDoneOn(r, today) && !isSkipped(r, today);
  for (const e of plan.timed) {
    const r = e.routine!;
    if (open(r) && e.end <= now) {
      out.push({
        key: `late-${r.id}`,
        kind: 'routines',
        icon: 'time-outline',
        title: r.name,
        meta: `Was at ${clock(e.start)} · still open`,
        fact: 'still open',
        to: 'today',
        tick: { routine: r.id },
      });
    }
  }
  const next = upNext(plan.timed, today, now);
  if (next && (next.state === 'now' || next.minutes <= SOON)) {
    const r = next.entry.routine!;
    out.push({
      key: `next-${r.id}`,
      kind: 'routines',
      icon: next.state === 'now' ? 'radio-button-on-outline' : 'arrow-forward-circle-outline',
      title: r.name,
      meta:
        next.state === 'now'
          ? `Happening now · ${next.minutes} min left`
          : `Up next at ${clock(next.entry.start)} · in ${next.minutes} min`,
      fact: next.state === 'now' ? 'now' : clock(next.entry.start),
      to: 'today',
      tick: { routine: r.id },
    });
  }
  for (const t of plan.todos.filter((x) => !x.doneOn)) {
    out.push({
      key: `todo-${t.id}`,
      kind: 'inbox',
      icon: 'checkbox-outline',
      title: t.title,
      meta: 'To-do for today',
      fact: 'today',
      to: 'today',
      tick: { todo: t.id },
    });
  }
  const words = dueWords(state.language, today).length;
  if (words > 0) {
    out.push({
      key: 'words',
      kind: 'chinese',
      icon: 'language-outline',
      title: `${words} ${words === 1 ? 'word' : 'words'} to review`,
      meta: 'Flashcards due today',
      fact: String(words),
      to: 'language',
    });
  }
  if (plan.session && plan.gym && !plan.gymDone) {
    out.push({
      key: 'gym',
      kind: 'gym',
      icon: 'barbell-outline',
      title: plan.session.name,
      meta: `${plan.gym.done} of ${plan.gym.total} sets`,
      fact: `${plan.gym.done}/${plan.gym.total}`,
      to: 'gym',
    });
  }
  const toBuy = state.groceries.filter((g) => needsBuying(g, today)).length;
  if (toBuy > 0) {
    out.push({
      key: 'groceries',
      kind: 'groceries',
      icon: 'basket-outline',
      title: `${toBuy} to buy`,
      meta: 'On today’s list',
      fact: String(toBuy),
      to: 'groceries',
    });
  }
  const toSort = inboxOpen(state.inbox, today).length;
  if (toSort > 0) {
    out.push({
      key: 'inbox',
      kind: 'inbox',
      icon: 'file-tray-outline',
      title: `${toSort} to sort`,
      meta: 'Waiting in the inbox',
      fact: String(toSort),
      to: 'inbox',
    });
  }
  return out;
}

/** A reminder that has come up: a routine whose reminder time passed today, or a timed step whose time passed. */
export interface DueItem {
  key: string;
  routine: string;
  title: string;
  line: string;
  /** Minutes since midnight it came up, for ordering. */
  at: number;
}

/**
 * What the reminders bell counts: open routines on today's plan whose reminder time has passed, and timed steps
 * whose start has passed without a tick or a skip. Each routine once, at its earliest moment.
 */
export function dueNow(state: LifeState, today: string, now: number): DueItem[] {
  const plan = dayPlan(state, today, today);
  const out: DueItem[] = [];
  for (const r of plan.planned) {
    if (isDoneOn(r, today)) continue;
    const reminder = r.reminder ? r.reminder.hour * 60 + r.reminder.minute : undefined;
    const start = parseClock(r.start);
    if (reminder !== undefined && reminder <= now) {
      out.push({ key: r.id, routine: r.id, title: r.name, line: `Reminder at ${clock(reminder)}`, at: reminder });
    } else if (start !== undefined && start <= now) {
      out.push({ key: r.id, routine: r.id, title: r.name, line: `Was at ${clock(start)}, still open`, at: start });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
}

/** One day of the "Your week" chart. */
export interface WeekDay {
  date: string;
  /** Planned routines (skips left out) and how many got done. */
  planned: number;
  done: number;
  /** Gym sets logged that day. */
  sets: number;
  /** Language practice minutes that day. */
  minutes: number;
}

/** The last seven days, oldest first, for the week chart's three series. */
export function weekSeries(state: Pick<LifeState, 'routines' | 'gym' | 'language'>, today: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => {
    const planned = state.routines.filter((r) => isScheduled(r, date) && !isSkipped(r, date));
    return {
      date,
      planned: planned.length,
      done: planned.filter((r) => isDoneOn(r, date)).length,
      sets: state.gym.logs.filter((l) => l.date === date).length,
      minutes: todaysLog(state.language, date).minutes,
    };
  });
}

/** The next workout after a rest day, for "Rest day. Next: Pull day on Wednesday." */
export function nextWorkout(gym: GymState, today: string): { name: string; date: string } | undefined {
  const n = nextSession(gym, today);
  return n ? { name: n.session.name, date: n.date } : undefined;
}

/** A non-breaking space: a number never leaves its unit. */
const NB = ' ';

/** "53 min", "2 h", "1 h 5 min", with non-breaking spaces, as Today words it. */
export function formatLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${NB}min`;
  return m === 0 ? `${h}${NB}h` : `${h}${NB}h${NB}${m}${NB}min`;
}

/** What is happening now or next on today's trail, with Today's own line for it. */
export function nextUp(plan: DayPlan, today: string, now: number) {
  const next = upNext(plan.timed, today, now);
  if (!next) return undefined;
  const line =
    next.state === 'now'
      ? `Happening now${NB}· ${formatLeft(next.minutes)}${NB}left`
      : `Up next${NB}· ${clock(next.entry.start)}${NB}· in${NB}${formatLeft(next.minutes)}`;
  return { ...next, line };
}
