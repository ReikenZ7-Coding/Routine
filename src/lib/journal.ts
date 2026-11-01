// A line or two and a mood for each day. Keyed by date.

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface DayEntry {
  mood?: Mood;
  note?: string;
}

export type Journal = Record<string, DayEntry>;

/** The five moods, worst to best. `curve` bends the drawn face's mouth: -6 is a frown, +6 a wide smile. */
export const MOODS: { value: Mood; label: string; curve: number }[] = [
  { value: 1, label: 'Rough', curve: -6 },
  { value: 2, label: 'Meh', curve: -3 },
  { value: 3, label: 'Okay', curve: 0 },
  { value: 4, label: 'Good', curve: 3.5 },
  { value: 5, label: 'Great', curve: 6 },
];

/** A saved mood read back safely: the stored 1 to 5 (also when an older copy stored it as text), else undefined. */
export function moodOf(saved: unknown): Mood | undefined {
  const n = typeof saved === 'string' ? Number(saved) : saved;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? (n as Mood) : undefined;
}

/** Set or clear part of a day's entry. Empty entries are removed so the journal stays small. */
export function setEntry(journal: Journal, date: string, changes: DayEntry): Journal {
  const entry = { ...journal[date], ...changes };
  if (!entry.note?.trim()) delete entry.note;
  if (!entry.mood) delete entry.mood;
  const next = { ...journal };
  if (Object.keys(entry).length === 0) delete next[date];
  else next[date] = entry;
  return next;
}
