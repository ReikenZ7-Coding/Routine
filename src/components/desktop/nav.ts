// The desktop's pages, in sidebar order, built from one list so a new module is one entry: Time would join the
// first group after Calendar, Maps would start a group of its own. Nothing is listed for a module that does not
// exist yet.
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import type { NavCounts } from '../../lib/day';

export type PageKey = 'overview' | 'today' | 'calendar' | 'inbox' | 'gym' | 'language' | 'groceries' | 'library' | 'music';

export interface NavItem {
  key: PageKey;
  label: string;
  href: '/overview' | '/' | '/calendar' | '/inbox' | '/gym' | '/language' | '/groceries' | '/library' | '/music';
  icon: string;
  iconActive: string;
  /** Which count sits beside it, and how its accessible name reads it ("Inbox, 1 to sort"). */
  count?: { of: keyof NavCounts; says: string };
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    items: [
      { key: 'overview', label: 'Overview', href: '/overview', icon: 'home-outline', iconActive: 'home' },
      { key: 'today', label: 'Today', href: '/', icon: 'today-outline', iconActive: 'today', count: { of: 'today', says: 'still to do' } },
      { key: 'calendar', label: 'Calendar', href: '/calendar', icon: 'calendar-outline', iconActive: 'calendar' },
      {
        key: 'inbox',
        label: 'Inbox',
        href: '/inbox',
        icon: 'file-tray-outline',
        iconActive: 'file-tray',
        count: { of: 'inbox', says: 'to sort' },
      },
    ],
  },
  {
    label: 'Health and growth',
    items: [
      { key: 'gym', label: 'Gym', href: '/gym', icon: 'barbell-outline', iconActive: 'barbell' },
      {
        key: 'language',
        label: 'Language',
        href: '/language',
        icon: 'language-outline',
        iconActive: 'language',
        count: { of: 'language', says: 'to review' },
      },
    ],
  },
  {
    label: 'Home life',
    items: [
      {
        key: 'groceries',
        label: 'Groceries',
        href: '/groceries',
        icon: 'basket-outline',
        iconActive: 'basket',
        count: { of: 'groceries', says: 'to buy' },
      },
      { key: 'library', label: 'Library', href: '/library', icon: 'library-outline', iconActive: 'library' },
      { key: 'music', label: 'Music', href: '/music', icon: 'musical-notes-outline', iconActive: 'musical-notes' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

/** Every place the shell can go: the sidebar's pages, and Settings and Your week (reached from the user card, the
 *  palette and Overview). */
export type Href = NavItem['href'] | '/settings' | '/stats';

/** Which sidebar item the current path belongs to. */
export function pageOf(pathname: string): NavItem | undefined {
  const path = pathname.replace(/\/+$/, '') || '/';
  return NAV_ITEMS.find((i) => i.href === path);
}

export function useCurrentPage(): NavItem | undefined {
  return pageOf(usePathname());
}

/** The minute of the day, kept current (every 30 s). */
export function useNow(): number {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const t = setInterval(() => setNow(read()), 30000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Monday 2 November". */
export function longDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.toLocaleDateString('en-GB', { weekday: 'long' })} ${d} ${date.toLocaleDateString('en-GB', { month: 'long' })}`;
}

/** Running as the Windows app, where every shortcut reaches the page. A browser keeps Ctrl+N (a new window) and
 *  Ctrl+1 to 9 (its tabs) for itself, so in a browser neither is offered. */
export const IN_APP = !!(globalThis as { symphonyDesktop?: unknown }).symphonyDesktop;

/** Ctrl on Windows and Linux, ⌘ in a Mac browser. */
export const MOD =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test((navigator as { platform?: string }).platform ?? '') ? '⌘' : 'Ctrl';
