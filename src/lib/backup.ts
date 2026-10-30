// Everything in one JSON string, so people can move to a new phone or keep a copy.

export const BACKUP_KEYS = ['groceries', 'gym', 'chinese', 'routines', 'journal', 'inbox'] as const;
export type BackupKey = (typeof BACKUP_KEYS)[number];
export type BackupData = Record<BackupKey, unknown>;

export function makeBackup(data: BackupData, now = new Date()): string {
  return JSON.stringify({ app: 'routine', version: 1, exportedAt: now.toISOString(), ...data });
}

/** Reads a pasted backup. Throws a friendly message when it isn't one. */
export function parseBackup(text: string): BackupData {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error("That doesn't look like a Routine backup. Paste the whole text you exported.");
  }
  if (!raw || raw.app !== 'routine') throw new Error("That doesn't look like a Routine backup.");
  const ok =
    Array.isArray(raw.groceries) &&
    Array.isArray(raw.routines) &&
    typeof raw.gym === 'object' &&
    raw.gym !== null &&
    typeof raw.chinese === 'object' &&
    raw.chinese !== null;
  if (!ok) throw new Error('This backup is missing some parts, so nothing was changed.');
  return {
    groceries: raw.groceries,
    gym: raw.gym,
    chinese: raw.chinese,
    routines: raw.routines,
    journal: raw.journal && typeof raw.journal === 'object' ? raw.journal : {},
    inbox: Array.isArray(raw.inbox) ? raw.inbox : [],
  };
}
