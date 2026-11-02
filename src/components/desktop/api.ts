// What any part of the desktop shell can ask of it: open the command palette, one of the forms, Settings or Your
// week, and dock or collapse the sidebar.
import { createContext, useContext } from 'react';
import type { Routine } from '../../lib/routines';
import type { RoutineFields } from '../RoutineForm';

export type AddKind = 'routine' | 'todo' | 'grocery' | 'word';
export type ShellPanel = AddKind | 'settings' | 'stats' | 'backup' | null;

export interface ShellApi {
  /** The sidebar is labelled (docked on a comfortable window, open over the content on a compact one). */
  expanded: boolean;
  toggleSidebar: () => void;
  openPalette: () => void;
  /** Open a form or panel; for 'routine', `routine` edits that one and `draft` fills a new one (a calendar slot).
   *  'settings' and 'stats' go to their pages. */
  open: (panel: ShellPanel, routine?: Routine, draft?: Partial<RoutineFields>) => void;
  /** The day Today is showing when it is not today: New adds a to-do to it, and the breadcrumbs name it. */
  day?: string;
  setDay: (day: string | undefined) => void;
}

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
  const s = useContext(ShellContext);
  if (!s) throw new Error('useShell outside the desktop shell');
  return s;
}
