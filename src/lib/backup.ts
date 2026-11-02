// Everything in one JSON string, so people can move to a new phone or keep a copy. The `chinese` part holds
// language practice (every language, its words and the minutes log); it keeps that name so old backups restore.
// The `music` part holds playlist links and the details of imported songs, not the audio files themselves; older
// backups have none, and restoring one leaves the music as it is.

export const BACKUP_KEYS = ['groceries', 'gym', 'chinese', 'routines', 'journal', 'inbox', 'music'] as const;
export type BackupKey = (typeof BACKUP_KEYS)[number];
export type BackupData = Record<BackupKey, unknown>;

export function makeBackup(data: BackupData, now = new Date()): string {
  // 'routine' is the backup format's id from before the app was renamed; keep it so old backups still restore.
  return JSON.stringify({ app: 'routine', version: 1, exportedAt: now.toISOString(), ...data });
}

/** Reads a pasted backup. Throws a friendly message when it isn't one. */
export function parseBackup(text: string): BackupData {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.trim());
  } catch {
    throw new Error("That doesn't look like a Symphony OS backup. Paste the whole text you exported.");
  }
  if (!raw || raw.app !== 'routine') throw new Error("That doesn't look like a Symphony OS backup.");
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
    music: raw.music && typeof raw.music === 'object' ? raw.music : null,
  };
}
