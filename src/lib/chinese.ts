// Pure Chinese practice logic: daily minutes target and spaced-review flashcards.
import { addDays } from './schedule.ts';

export interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  /** Date key when the word is next due for review. */
  due: string;
  /** Days until the next review after a correct answer. */
  interval: number;
  /** Times reviewed correctly in a row. */
  streak: number;
}

export interface PracticeLog {
  date: string;
  minutes: number;
  reviewed: number;
}

export interface ChineseState {
  /** Daily target in minutes. */
  target: number;
  words: Word[];
  logs: PracticeLog[];
}

export const EMPTY_CHINESE: ChineseState = { target: 15, words: [], logs: [] };

export type Grade = 'again' | 'good' | 'easy';

export function dueWords(state: ChineseState, today: string): Word[] {
  return state.words.filter((w) => w.due <= today).sort((a, b) => a.due.localeCompare(b.due));
}

export function todaysLog(state: ChineseState, today: string): PracticeLog {
  return state.logs.find((l) => l.date === today) ?? { date: today, minutes: 0, reviewed: 0 };
}

function withLog(state: ChineseState, today: string, change: (l: PracticeLog) => PracticeLog): ChineseState {
  const next = change(todaysLog(state, today));
  const others = state.logs.filter((l) => l.date !== today);
  return { ...state, logs: [...others, next] };
}

export function addMinutes(state: ChineseState, today: string, minutes: number): ChineseState {
  return withLog(state, today, (l) => ({ ...l, minutes: Math.max(0, l.minutes + minutes) }));
}

/** Schedule the next review. "Again" keeps the word due today and resets its interval. */
export function review(state: ChineseState, today: string, wordId: string, grade: Grade): ChineseState {
  const words = state.words.map((w) => {
    if (w.id !== wordId) return w;
    if (grade === 'again') return { ...w, interval: 1, streak: 0, due: today };
    const interval = grade === 'easy' ? Math.max(4, Math.round(w.interval * 3)) : w.streak === 0 ? 1 : Math.round(w.interval * 2);
    return { ...w, interval, streak: w.streak + 1, due: addDays(today, interval) };
  });
  return withLog({ ...state, words }, today, (l) => ({ ...l, reviewed: l.reviewed + 1 }));
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) that met the target. */
export function streakDays(state: ChineseState, today: string): number {
  const met = new Set(state.logs.filter((l) => l.minutes >= state.target).map((l) => l.date));
  let day = met.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (met.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function newWord(id: string, hanzi: string, pinyin: string, meaning: string, today: string): Word {
  return { id, hanzi, pinyin, meaning, due: today, interval: 1, streak: 0 };
}

/** A few beginner words to start with; users can edit or delete them. */
export const STARTER_WORDS: [string, string, string][] = [
  ['你好', 'nǐ hǎo', 'hello'],
  ['谢谢', 'xièxie', 'thank you'],
  ['我', 'wǒ', 'I, me'],
  ['你', 'nǐ', 'you'],
  ['是', 'shì', 'to be'],
  ['不', 'bù', 'not, no'],
  ['吃', 'chī', 'to eat'],
  ['喝', 'hē', 'to drink'],
  ['水', 'shuǐ', 'water'],
  ['鸡肉', 'jīròu', 'chicken (meat)'],
];
