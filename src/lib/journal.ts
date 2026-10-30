// A line or two and a mood for each day. Keyed by date.

export type Mood = 1 | 2 | 3 | 4 | 5;

export interface DayEntry {
  mood?: Mood;
  note?: string;
}

export type Journal = Record<string, DayEntry>;

export const MOODS: { value: Mood; face: string; label: string }[] = [
  { value: 1, face: '😞', label: 'Rough' },
  { value: 2, face: '😕', label: 'Meh' },
  { value: 3, face: '🙂', label: 'Okay' },
  { value: 4, face: '😊', label: 'Good' },
  { value: 5, face: '🤩', label: 'Great' },
];

export function moodFace(mood?: Mood): string | undefined {
  return MOODS.find((m) => m.value === mood)?.face;
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
