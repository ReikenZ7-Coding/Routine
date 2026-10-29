// Pure date + repeat logic. No React Native imports so it can be unit tested with plain Node.

export type Repeat =
  | { kind: 'once' }
  | { kind: 'everyNDays'; n: number }
  | { kind: 'weekdays'; days: number[] }; // 0 = Sunday ... 6 = Saturday

export interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  aisle?: string;
  repeat: Repeat;
  /** Date key (YYYY-MM-DD) of the most recent purchase. */
  lastBought?: string;
  /** lastBought before today's tick, so an accidental tick can be undone. */
  prevBought?: string;
  createdAt: string;
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local-time date key, e.g. 2026-10-29. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

export function boughtOn(item: GroceryItem, today: string): boolean {
  return item.lastBought === today;
}

/** Does this item belong on today's shopping list (bought or not)? */
export function isOnList(item: GroceryItem, today: string): boolean {
  if (boughtOn(item, today)) return true;
  return needsBuying(item, today);
}

/** Still needs buying today. */
export function needsBuying(item: GroceryItem, today: string): boolean {
  if (boughtOn(item, today)) return false;
  const r = item.repeat;
  switch (r.kind) {
    case 'once':
      return !item.lastBought;
    case 'everyNDays':
      return !item.lastBought || daysBetween(item.lastBought, today) >= r.n;
    case 'weekdays':
      return r.days.includes(parseKey(today).getDay());
  }
}

/** The next date (after today) this item comes back on the list, or undefined for one-offs. */
export function nextDue(item: GroceryItem, today: string): string | undefined {
  const r = item.repeat;
  switch (r.kind) {
    case 'once':
      return undefined;
    case 'everyNDays': {
      const base = item.lastBought ?? today;
      const due = addDays(base, r.n);
      return daysBetween(today, due) > 0 ? due : addDays(today, 1);
    }
    case 'weekdays': {
      if (r.days.length === 0) return undefined;
      for (let i = 1; i <= 7; i++) {
        const k = addDays(today, i);
        if (r.days.includes(parseKey(k).getDay())) return k;
      }
      return undefined;
    }
  }
}

export function markBought(item: GroceryItem, today: string): GroceryItem {
  if (boughtOn(item, today)) return item;
  return { ...item, prevBought: item.lastBought, lastBought: today };
}

export function unmarkBought(item: GroceryItem, today: string): GroceryItem {
  if (!boughtOn(item, today)) return item;
  return { ...item, lastBought: item.prevBought, prevBought: undefined };
}

export function describeRepeat(r: Repeat): string {
  switch (r.kind) {
    case 'once':
      return 'One-off';
    case 'everyNDays':
      if (r.n === 1) return 'Every day';
      if (r.n === 7) return 'Every week';
      return `Every ${r.n} days`;
    case 'weekdays':
      if (r.days.length === 7) return 'Every day';
      return [...r.days].sort().map((d) => WEEKDAY_SHORT[d]).join(', ');
  }
}

/** "Today", "Tomorrow", "Mon 3 Nov". */
export function friendlyDate(key: string, today: string): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  const d = parseKey(key);
  const month = d.toLocaleString('en', { month: 'short' });
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${month}`;
}
