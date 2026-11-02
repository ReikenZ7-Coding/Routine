// What any part of the desktop shell can ask of it: open the command palette, one of the forms, Settings or Your
// week, and dock or collapse the sidebar.
import { createContext, useContext } from 'react';
import type { Routine } from '../../lib/routines';

export type AddKind = 'routine' | 'todo' | 'grocery' | 'word';
export type ShellPanel = AddKind | 'settings' | 'stats' | 'backup' | null;

export interface ShellApi {
  /** The sidebar is labelled (docked on a comfortable window, open over the content on a compact one). */
  expanded: boolean;
  toggleSidebar: () => void;
  openPalette: () => void;
  /** Open a form or panel; for 'routine', `routine` edits that one. */
  open: (panel: ShellPanel, routine?: Routine) => void;
}

export const ShellContext = createContext<ShellApi | null>(null);

export function useShell(): ShellApi {
  const s = useContext(ShellContext);
  if (!s) throw new Error('useShell outside the desktop shell');
  return s;
}
