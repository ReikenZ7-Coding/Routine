import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { EMPTY_LANGUAGE, type LanguageState, upgradeLanguageState } from './language';
import type { BackupData } from './backup';
import { EMPTY_GYM, type GymState } from './gym';
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

export interface Settings {
  /** User allowed Routine to read the phone's calendars. */
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
  /** Replace everything with a restored backup. */
  restore: (data: BackupData) => void;
}

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
  const [today, setToday] = useState(dateKey());
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, GYM_KEY, LANGUAGE_KEY, ROUTINES_KEY, SETTINGS_KEY, JOURNAL_KEY, INBOX_KEY])
      .then(([[, groceriesRaw], [, gymRaw], [, languageRaw], [, routinesRaw], [, settingsRaw], [, journalRaw], [, inboxRaw]]) => {
        if (inboxRaw) setInbox(JSON.parse(inboxRaw));
        if (journalRaw) setJournal(JSON.parse(journalRaw));
        if (groceriesRaw) setGroceries(JSON.parse(groceriesRaw));
        if (gymRaw) setGym(JSON.parse(gymRaw));
        // Older saves (Chinese only) are upgraded in memory; the next save writes the new fields alongside.
        if (languageRaw) setLanguage(upgradeLanguageState(JSON.parse(languageRaw)));
        if (routinesRaw) setRoutines(JSON.parse(routinesRaw));
        if (settingsRaw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) });
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
  }, []);
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
      restore,
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
      restore,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
