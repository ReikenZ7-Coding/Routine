// Quick to-dos that don't need a routine: jot them in the inbox, drop them on a day when you're ready.

export interface InboxItem {
  id: string;
  title: string;
  /** Day it's planned for. No date means it waits in the inbox. */
  date?: string;
  /** Day it was finished. */
  doneOn?: string;
  createdAt: string;
}

/** Waiting in the inbox: no day yet, or planned for a day that passed without being done. */
export function inboxOpen(items: InboxItem[], today: string): InboxItem[] {
  return items.filter((i) => !i.doneOn && (!i.date || i.date < today));
}

export function itemsFor(items: InboxItem[], date: string): InboxItem[] {
  return items.filter((i) => (i.doneOn ? i.doneOn === date : i.date === date));
}

export function planFor(item: InboxItem, date: string | undefined): InboxItem {
  return { ...item, date };
}

export function toggleItem(item: InboxItem, today: string): InboxItem {
  return item.doneOn ? { ...item, doneOn: undefined } : { ...item, doneOn: today, date: item.date ?? today };
}

export function recentlyDone(items: InboxItem[], today: string, days = 7): InboxItem[] {
  const [y, m, d] = today.split('-').map(Number);
  const from = new Date(y, m - 1, d - days);
  const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  return items.filter((i) => i.doneOn && i.doneOn >= fromKey).sort((a, b) => b.doneOn!.localeCompare(a.doneOn!));
}
