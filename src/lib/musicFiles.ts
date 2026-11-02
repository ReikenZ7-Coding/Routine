// Copies of imported songs, kept in the app's own document folder so they keep playing after the picker's
// cache is cleared. The web build has its own version of this file (musicFiles.web.ts).
import { Directory, File, Paths } from 'expo-file-system';

/** Whether imported songs survive a restart here (false on the web, where they last for the session). */
export const KEEPS_IMPORTS = true;

function folder(): Directory {
  const dir = new Directory(Paths.document, 'music');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Copies a picked file into the music folder under `fileName` and returns the copy's uri. */
export async function keepCopy(pickedUri: string, fileName: string): Promise<string> {
  const target = new File(folder(), fileName);
  if (target.exists) target.delete();
  await new File(pickedUri).copy(target);
  return target.uri;
}

/** Deletes a copy made by keepCopy. Anything outside the music folder is left alone. */
export function deleteCopy(uri: string): void {
  try {
    if (!uri.startsWith(folder().uri)) return;
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone: nothing to tidy.
  }
}

/** Whether a song's file is on this phone (a restored backup can list songs from another phone). */
export function hasFile(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
