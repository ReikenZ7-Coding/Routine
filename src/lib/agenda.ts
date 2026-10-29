// What belongs on a given day, across every part of the app. Pure, so the calendar can
// ask about any date (past, today or future) without touching storage.
import { type ChineseState, todaysLog } from './chinese.ts';
import { type GymState, sessionFor } from './gym.ts';
import { type Routine, isScheduled } from './routines.ts';
import { type GroceryItem, isOnList } from './schedule.ts';

export interface DayState {
  groceries: GroceryItem[];
  gym: GymState;
  chinese: ChineseState;
  routines: Routine[];
}

export interface DayMarks {
  routines: boolean;
  gym: boolean;
  chinese: boolean;
  groceries: boolean;
}

/** Which kinds of things happen on this date (for the dots under each calendar day). */
export function marksFor(state: DayState, date: string, today: string): DayMarks {
  // From today on, show what is planned; in the past, show what was actually done.
  const past = date < today;
  return {
    routines: past ? state.routines.some((r) => r.doneDates.includes(date)) : state.routines.some((r) => isScheduled(r, date)),
    gym: past ? state.gym.logs.some((l) => l.date === date) : !!sessionFor(state.gym, date),
    chinese: !past ? state.chinese.words.length > 0 || state.chinese.logs.length > 0 : todaysLog(state.chinese, date).minutes > 0,
    groceries: !past ? state.groceries.some((g) => isOnList(g, date)) : state.groceries.some((g) => g.lastBought === date),
  };
}

/** Monday-first week containing the date, as date keys. */
export function weekOf(date: string): string[] {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  });
}

/** Weeks (Monday-first) covering the month of the date; days outside the month are null. */
export function monthGrid(date: string): (string | null)[][] {
  const [y, m] = date.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const weeks: (string | null)[][] = [];
  let week = weekOf(first);
  while (week.some((d) => Number(d.split('-')[1]) === m && Number(d.split('-')[0]) === y)) {
    weeks.push(week.map((d) => (Number(d.split('-')[1]) === m ? d : null)));
    const [ly, lm, ld] = week[6].split('-').map(Number);
    const next = new Date(ly, lm - 1, ld + 1);
    week = weekOf(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`);
  }
  return weeks;
}
