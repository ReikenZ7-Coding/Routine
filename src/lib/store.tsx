import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { EMPTY_LANGUAGE, type LanguageState, upgradeLanguageState } from './language';
import type { BackupData } from './backup';
import { EMPTY_GYM, type GymState } from './gym';
import { EMPTY_MUSIC, type MusicState, mergeRestoredMusic, musicToSave, upgradeMusicState } from './music';
import type { InboxItem } from './inbox';
import type { Journal } from './journal';
import type { ThemeName } from '../theme';
import type { Routine } from './routines';
import { type GroceryItem, dateKey, markBought, unmarkBought } from './schedule';

const STORAGE_KEY = 'routine.groceries.v1';
const GYM_KEY = 'routine.gym.v1';
/** Language practice. The key keeps its first name, from when the feature was Chinese only. */
const LANGUAGE_KEY = 'routine.chinese.v1';
const ROUTINES_KEY = 'routine.routines.v1';
const SETTINGS_KEY = 'routine.settings.v1';
const JOURNAL_KEY = 'routine.journal.v1';
const INBOX_KEY = 'routine.inbox.v1';
/** Imported songs (details only; the files live in the app's folder) and saved playlist links. */
const MUSIC_KEY = 'routine.music.v1';

export interface Settings {
  /** User allowed Symphony OS to read the phone's calendars. */
  calendarConnected: boolean;
  theme: ThemeName;
  /** First name for the greeting. */
  name: string;
}

const DEFAULT_SETTINGS: Settings = { calendarConnected: false, theme: 'lavender', name: '' };

export type NewGroceryItem = Omit<GroceryItem, 'id' | 'createdAt' | 'lastBought' | 'prevBought'>;

export const STARTER_STAPLES: NewGroceryItem[] = [
  { name: 'Chicken', quantity: '500 g', aisle: 'Meat', repeat: { kind: 'everyNDays', n: 1 } },
  { name: 'Eggs', quantity: '12', aisle: 'Dairy & eggs', repeat: { kind: 'everyNDays', n: 7 } },
  { name: 'Milk', quantity: '1 L', aisle: 'Dairy & eggs', repeat: { kind: 'everyNDays', n: 3 } },
  { name: 'Rice', quantity: '1 bag', aisle: 'Pantry', repeat: { kind: 'everyNDays', n: 14 } },
  { name: 'Vegetables', aisle: 'Produce', repeat: { kind: 'everyNDays', n: 2 } },
];

interface Store {
  ready: boolean;
  today: string;
  groceries: GroceryItem[];
  addGrocery: (item: NewGroceryItem) => void;
  addGroceries: (items: NewGroceryItem[]) => void;
  updateGrocery: (id: string, changes: NewGroceryItem) => void;
  removeGrocery: (id: string) => void;
  toggleBought: (id: string) => void;
  gym: GymState;
  /** Apply a pure update (see gym.ts) to the gym state. */
  updateGym: (fn: (g: GymState) => GymState) => void;
  language: LanguageState;
  /** Apply a pure update (see language.ts) to the language practice state. */
  updateLanguage: (fn: (l: LanguageState) => LanguageState) => void;
  routines: Routine[];
  updateRoutines: (fn: (r: Routine[]) => Routine[]) => void;
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
  journal: Journal;
  updateJournal: (fn: (j: Journal) => Journal) => void;
  inbox: InboxItem[];
  updateInbox: (fn: (i: InboxItem[]) => InboxItem[]) => void;
  music: MusicState;
  /** Apply a pure update to your music and playlist links. */
  updateMusic: (fn: (m: MusicState) => MusicState) => void;
  /** Replace everything with a restored backup. */
  restore: (data: BackupData) => void;
  /**
   * Saved parts that couldn't be read at start-up ('language', 'music', ...). Each one starts empty, and its
   * damaged save is kept aside under `<key>.damaged`, so the screen can say so instead of looking brand new.
   */
  damaged: DamagedPart[];
  dismissDamaged: (part: DamagedPart) => void;
}

export type DamagedPart = 'groceries' | 'gym' | 'language' | 'routines' | 'settings' | 'journal' | 'inbox' | 'music';

const PART_OF: Record<string, DamagedPart> = {
  [STORAGE_KEY]: 'groceries',
  [GYM_KEY]: 'gym',
  [LANGUAGE_KEY]: 'language',
  [ROUTINES_KEY]: 'routines',
  [SETTINGS_KEY]: 'settings',
  [JOURNAL_KEY]: 'journal',
  [INBOX_KEY]: 'inbox',
  [MUSIC_KEY]: 'music',
};

const StoreContext = createContext<Store | null>(null);

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [gym, setGym] = useState<GymState>(EMPTY_GYM);
  const [language, setLanguage] = useState<LanguageState>(EMPTY_LANGUAGE);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [journal, setJournal] = useState<Journal>({});
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [music, setMusic] = useState<MusicState>(EMPTY_MUSIC);
  const [today, setToday] = useState(dateKey());
  const [damaged, setDamaged] = useState<DamagedPart[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    const damagedKeys: string[] = [];
    // Each key is read on its own, so one damaged save never stops the rest from loading. A value that can't be
    // read is copied aside (under `<key>.damaged`, before anything can save over it) and that part starts empty.
    const read = <T,>(key: string, raw: string | null | undefined, use: (value: unknown) => T): T | undefined => {
      if (!raw) return undefined;
      try {
        return use(JSON.parse(raw));
      } catch {
        damagedKeys.push(key);
        return undefined;
      }
    };
    const keys = [STORAGE_KEY, GYM_KEY, LANGUAGE_KEY, ROUTINES_KEY, SETTINGS_KEY, JOURNAL_KEY, INBOX_KEY, MUSIC_KEY];
    AsyncStorage.multiGet(keys)
      .then(async (pairs) => {
        const raw = new Map(pairs);
        // A value of the wrong shape counts as damaged too, rather than reaching a screen that expects a list.
        const list = <T,>(v: unknown): T[] => {
          if (!Array.isArray(v)) throw new Error('not a list');
          return v as T[];
        };
        const obj = <T,>(v: unknown): T => {
          if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
          return v as T;
        };
        // No music saved yet (every save before music existed) reads as an empty library.
        const m = read(MUSIC_KEY, raw.get(MUSIC_KEY), upgradeMusicState);
        if (m) setMusic(m);
        const i = read(INBOX_KEY, raw.get(INBOX_KEY), list<InboxItem>);
        if (i) setInbox(i);
        const j = read(JOURNAL_KEY, raw.get(JOURNAL_KEY), obj<Journal>);
        if (j) setJournal(j);
        const g = read(STORAGE_KEY, raw.get(STORAGE_KEY), list<GroceryItem>);
        if (g) setGroceries(g);
        const gy = read(GYM_KEY, raw.get(GYM_KEY), obj<GymState>);
        if (gy) setGym(gy);
        // Older saves (Chinese only) are upgraded in memory; the next save writes the new fields alongside.
        const l = read(LANGUAGE_KEY, raw.get(LANGUAGE_KEY), upgradeLanguageState);
        if (l) setLanguage(l);
        const r = read(ROUTINES_KEY, raw.get(ROUTINES_KEY), list<Routine>);
        if (r) setRoutines(r);
        const st = read(SETTINGS_KEY, raw.get(SETTINGS_KEY), obj<Partial<Settings>>);
        if (st) setSettings({ ...DEFAULT_SETTINGS, ...st });
        if (damagedKeys.length) {
          // Only the first damaged copy is kept, so a second bad start never replaces the original with a later one.
          const aside = await AsyncStorage.multiGet(damagedKeys.map((k) => `${k}.damaged`));
          const fresh = damagedKeys.filter((_, n) => !aside[n][1]).map((k) => [`${k}.damaged`, raw.get(k) as string] as [string, string]);
          if (fresh.length) await AsyncStorage.multiSet(fresh);
          setDamaged(damagedKeys.map((k) => PART_OF[k]));
        }
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groceries)).catch(() => {});
  }, [groceries]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(GYM_KEY, JSON.stringify(gym)).catch(() => {});
  }, [gym]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(LANGUAGE_KEY, JSON.stringify(language)).catch(() => {});
  }, [language]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines)).catch(() => {});
  }, [routines]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(journal)).catch(() => {});
  }, [journal]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(INBOX_KEY, JSON.stringify(inbox)).catch(() => {});
  }, [inbox]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(MUSIC_KEY, JSON.stringify(musicToSave(music))).catch(() => {});
  }, [music]);

  const updateInbox = useCallback((fn: (i: InboxItem[]) => InboxItem[]) => setInbox(fn), []);
  const updateJournal = useCallback((fn: (j: Journal) => Journal) => setJournal(fn), []);
  const restore = useCallback((data: BackupData) => {
    setGroceries(data.groceries as GroceryItem[]);
    setGym({ ...EMPTY_GYM, ...(data.gym as GymState) });
    // The backup format keeps its `chinese` field; any older backup's shape is upgraded here.
    setLanguage(upgradeLanguageState(data.chinese));
    setRoutines(data.routines as Routine[]);
    setJournal(data.journal as Journal);
    setInbox(data.inbox as InboxItem[]);
    setMusic((m) => mergeRestoredMusic(m, data.music));
    setDamaged([]);
  }, []);
  const dismissDamaged = useCallback((part: DamagedPart) => setDamaged((d) => d.filter((p) => p !== part)), []);
  const updateMusic = useCallback((fn: (m: MusicState) => MusicState) => setMusic(fn), []);
  const updateSettings = useCallback((changes: Partial<Settings>) => setSettings((s) => ({ ...s, ...changes })), []);
  const updateRoutines = useCallback((fn: (r: Routine[]) => Routine[]) => setRoutines(fn), []);
  const updateGym = useCallback((fn: (g: GymState) => GymState) => setGym(fn), []);
  const updateLanguage = useCallback((fn: (l: LanguageState) => LanguageState) => setLanguage(fn), []);

  // Roll the list over when the app comes back after midnight.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(dateKey());
    });
    return () => sub.remove();
  }, []);

  const addGroceries = useCallback((items: NewGroceryItem[]) => {
    const createdAt = dateKey();
    setGroceries((prev) => [...prev, ...items.map((i) => ({ ...i, id: newId(), createdAt }))]);
  }, []);

  const addGrocery = useCallback((item: NewGroceryItem) => addGroceries([item]), [addGroceries]);

  const updateGrocery = useCallback((id: string, changes: NewGroceryItem) => {
    setGroceries((prev) => prev.map((g) => (g.id === id ? { ...g, ...changes } : g)));
  }, []);

  const removeGrocery = useCallback((id: string) => {
    setGroceries((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const toggleBought = useCallback(
    (id: string) => {
      setGroceries((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          return g.lastBought === today ? unmarkBought(g, today) : markBought(g, today);
        }),
      );
    },
    [today],
  );

  const value = useMemo(
    () => ({
      ready,
      today,
      groceries,
      addGrocery,
      addGroceries,
      updateGrocery,
      removeGrocery,
      toggleBought,
      gym,
      updateGym,
      language,
      updateLanguage,
      routines,
      updateRoutines,
      settings,
      updateSettings,
      journal,
      updateJournal,
      inbox,
      updateInbox,
      music,
      updateMusic,
      restore,
      damaged,
      dismissDamaged,
    }),
    [
      ready,
      today,
      groceries,
      addGrocery,
      addGroceries,
      updateGrocery,
      removeGrocery,
      toggleBought,
      gym,
      updateGym,
      language,
      updateLanguage,
      routines,
      updateRoutines,
      settings,
      updateSettings,
      journal,
      updateJournal,
      inbox,
      updateInbox,
      music,
      updateMusic,
      restore,
      damaged,
      dismissDamaged,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
