import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { EMPTY_GYM, type GymState } from './gym';
import { type GroceryItem, dateKey, markBought, unmarkBought } from './schedule';

const STORAGE_KEY = 'routine.groceries.v1';
const GYM_KEY = 'routine.gym.v1';

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
}

const StoreContext = createContext<Store | null>(null);

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [gym, setGym] = useState<GymState>(EMPTY_GYM);
  const [today, setToday] = useState(dateKey());
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.multiGet([STORAGE_KEY, GYM_KEY])
      .then(([[, groceriesRaw], [, gymRaw]]) => {
        if (groceriesRaw) setGroceries(JSON.parse(groceriesRaw));
        if (gymRaw) setGym(JSON.parse(gymRaw));
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

  const updateGym = useCallback((fn: (g: GymState) => GymState) => setGym(fn), []);

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
    () => ({ ready, today, groceries, addGrocery, addGroceries, updateGrocery, removeGrocery, toggleBought, gym, updateGym }),
    [ready, today, groceries, addGrocery, addGroceries, updateGrocery, removeGrocery, toggleBought, gym, updateGym],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
