// Pure language practice logic: the languages someone is learning, a shared daily minutes target, and
// spaced-review flashcards that each belong to one language.
//
// Saved under routine.chinese.v1, because the feature began as Chinese practice. The stored shape only ever
// grows: a word keeps its `hanzi` (the word or phrase, in any script) and `pinyin` (its reading) fields, and
// `languages`, `current` and a word's `lang` are additions. upgradeLanguageState reads any older shape.
import { addDays } from './schedule.ts';

export interface Word {
  id: string;
  /** The word or phrase, in any script. Named `hanzi` for saved-data compatibility. */
  hanzi: string;
  /** Optional reading or pronunciation. Named `pinyin` for saved-data compatibility. */
  pinyin: string;
  meaning: string;
  /** Id of the language it belongs to. Words saved before languages existed are Chinese. */
  lang: string;
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

/** A language someone is learning: one from the catalogue (id and code are the same), or "other" with a typed name. */
export interface StudyLanguage {
  id: string;
  code: string;
  /** English name, or the name the person typed for another language. */
  name: string;
}

export interface LanguageState {
  /** Daily target in minutes, shared by every language: one practice habit. */
  target: number;
  words: Word[];
  logs: PracticeLog[];
  languages: StudyLanguage[];
  /** The language the tab is showing. */
  current?: string;
}

export const EMPTY_LANGUAGE: LanguageState = { target: 15, words: [], logs: [], languages: [] };

export type Grade = 'again' | 'good' | 'easy';

export interface LanguageInfo {
  code: string;
  name: string;
  /** The language's name for itself. */
  native: string;
  /** One character for the deck's tile. */
  glyph: string;
  rtl?: boolean;
  /** Label for the reading field; "Pronunciation" when absent. */
  reading?: string;
  /** Label for the word field; "Word or phrase" when absent. */
  word?: string;
  /** Beginner words: [word, reading, meaning]. */
  starter?: [string, string, string][];
}

/** The languages with a starter set come first, in the order the chooser shows them. */
export const POPULAR: LanguageInfo[] = [
  {
    code: 'es',
    name: 'Spanish',
    native: 'Español',
    glyph: 'ñ',
    starter: [
      ['hola', '', 'hello'],
      ['gracias', '', 'thank you'],
      ['por favor', '', 'please'],
      ['adiós', '', 'goodbye'],
      ['sí', '', 'yes'],
      ['el agua', '', 'water'],
      ['comer', '', 'to eat'],
      ['el amigo', '', 'friend'],
    ],
  },
  {
    code: 'fr',
    name: 'French',
    native: 'Français',
    glyph: 'é',
    starter: [
      ['bonjour', '', 'hello'],
      ['merci', '', 'thank you'],
      ["s'il vous plaît", '', 'please'],
      ['au revoir', '', 'goodbye'],
      ['oui', '', 'yes'],
      ["l'eau", '', 'water'],
      ['manger', '', 'to eat'],
      ["l'ami", '', 'friend'],
    ],
  },
  {
    code: 'ja',
    name: 'Japanese',
    native: '日本語',
    glyph: 'あ',
    reading: 'Reading',
    starter: [
      ['こんにちは', 'konnichiwa', 'hello'],
      ['ありがとう', 'arigatō', 'thank you'],
      ['さようなら', 'sayōnara', 'goodbye'],
      ['はい', 'hai', 'yes'],
      ['いいえ', 'iie', 'no'],
      ['水', 'mizu', 'water'],
      ['食べる', 'taberu', 'to eat'],
      ['友達', 'tomodachi', 'friend'],
    ],
  },
  {
    code: 'ko',
    name: 'Korean',
    native: '한국어',
    glyph: '한',
    reading: 'Romanization',
    starter: [
      ['안녕하세요', 'annyeonghaseyo', 'hello'],
      ['감사합니다', 'gamsahamnida', 'thank you'],
      ['안녕히 가세요', 'annyeonghi gaseyo', 'goodbye (to someone leaving)'],
      ['네', 'ne', 'yes'],
      ['아니요', 'aniyo', 'no'],
      ['물', 'mul', 'water'],
      ['먹다', 'meokda', 'to eat'],
      ['친구', 'chingu', 'friend'],
    ],
  },
  {
    code: 'zh',
    name: 'Chinese',
    native: '中文',
    glyph: '字',
    reading: 'Pinyin',
    word: 'Characters',
    starter: [
      ['你好', 'nǐ hǎo', 'hello'],
      ['谢谢', 'xièxie', 'thank you'],
      ['再见', 'zàijiàn', 'goodbye'],
      ['我', 'wǒ', 'I, me'],
      ['你', 'nǐ', 'you'],
      ['是', 'shì', 'to be'],
      ['不', 'bù', 'not, no'],
      ['水', 'shuǐ', 'water'],
    ],
  },
  {
    code: 'de',
    name: 'German',
    native: 'Deutsch',
    glyph: 'ß',
    starter: [
      ['hallo', '', 'hello'],
      ['danke', '', 'thank you'],
      ['bitte', '', 'please'],
      ['tschüss', '', 'bye'],
      ['ja', '', 'yes'],
      ['das Wasser', '', 'water'],
      ['essen', '', 'to eat'],
      ['der Freund', '', 'friend'],
    ],
  },
  {
    code: 'it',
    name: 'Italian',
    native: 'Italiano',
    glyph: 'è',
    starter: [
      ['ciao', '', 'hi, bye'],
      ['grazie', '', 'thank you'],
      ['per favore', '', 'please'],
      ['arrivederci', '', 'goodbye'],
      ['sì', '', 'yes'],
      ["l'acqua", '', 'water'],
      ['mangiare', '', 'to eat'],
      ["l'amico", '', 'friend'],
    ],
  },
  {
    code: 'pt',
    name: 'Portuguese',
    native: 'Português',
    glyph: 'ç',
    starter: [
      ['olá', '', 'hello'],
      ['obrigado / obrigada', '', 'thank you'],
      ['por favor', '', 'please'],
      ['tchau', '', 'bye'],
      ['sim', '', 'yes'],
      ['a água', '', 'water'],
      ['comer', '', 'to eat'],
      ['o amigo', '', 'friend'],
    ],
  },
];

/** Everything else the chooser lists, alphabetically, before "Another language". */
export const MORE: LanguageInfo[] = [
  { code: 'ar', name: 'Arabic', native: 'العربية', glyph: 'ع', rtl: true },
  { code: 'nl', name: 'Dutch', native: 'Nederlands', glyph: 'ij' },
  { code: 'en', name: 'English', native: 'English', glyph: 'Aa' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά', glyph: 'Ω' },
  { code: 'he', name: 'Hebrew', native: 'עברית', glyph: 'א', rtl: true },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', glyph: 'अ' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia', glyph: 'Aa' },
  { code: 'fa', name: 'Persian', native: 'فارسی', glyph: 'پ', rtl: true },
  { code: 'pl', name: 'Polish', native: 'Polski', glyph: 'ł' },
  { code: 'ru', name: 'Russian', native: 'Русский', glyph: 'Я' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', glyph: 'Aa' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', glyph: 'å' },
  { code: 'tl', name: 'Tagalog', native: 'Tagalog', glyph: 'Aa' },
  { code: 'th', name: 'Thai', native: 'ไทย', glyph: 'ก' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', glyph: 'ğ' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська', glyph: 'ї' },
  { code: 'ur', name: 'Urdu', native: 'اردو', glyph: 'ے', rtl: true },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt', glyph: 'ơ' },
];

export const OTHER = 'other';
const LRM = '\u200E';

/**
 * A native name set inside an English line, between left-to-right marks: the line still reads left to right
 * when it opens with Arabic or Hebrew, and a number after the name stays with the English ("العربية · 3 words",
 * not "3 · العربية words").
 */
export const inLine = (name: string) => `${LRM}${name}${LRM}`;
const CATALOGUE = [...POPULAR, ...MORE];
const CHINESE: StudyLanguage = { id: 'zh', code: 'zh', name: 'Chinese' };
/** The longest name a balance ring shows in full; longer names read "Language" there. */
const SHORT_NAME_MAX = 10;

export function languageInfo(code: string): LanguageInfo | undefined {
  return CATALOGUE.find((l) => l.code === code);
}

/** The catalogue entry, or a plain one built from the typed name for another language. */
export function infoFor(lang: StudyLanguage): LanguageInfo {
  return (
    languageInfo(lang.code) ?? {
      code: OTHER,
      name: lang.name,
      native: lang.name,
      glyph: Array.from(lang.name.trim())[0]?.toUpperCase() ?? 'A',
    }
  );
}

export const readingLabel = (lang?: StudyLanguage) => (lang && infoFor(lang).reading) || 'Pronunciation';
export const wordLabel = (lang?: StudyLanguage) => (lang && infoFor(lang).word) || 'Word or phrase';
export const isRtl = (lang?: StudyLanguage) => !!lang && !!infoFor(lang).rtl;
export const starterFor = (lang: StudyLanguage) => infoFor(lang).starter ?? [];

/** A catalogue language, or another language by the name typed for it. */
export function makeLanguage(code: string, typedName = ''): StudyLanguage {
  const info = code === OTHER ? undefined : languageInfo(code);
  if (info) return { id: info.code, code: info.code, name: info.name };
  const name = typedName.trim().replace(/\s+/g, ' ');
  return { id: `other:${name.toLowerCase()}`, code: OTHER, name };
}

/** The language with this name (catalogue or typed), so typing "spanish" under "Another language" finds Spanish. */
export function findByName(name: string): LanguageInfo | undefined {
  const n = name.trim().toLowerCase();
  return CATALOGUE.find((l) => l.name.toLowerCase() === n || l.native.toLowerCase() === n);
}

export function currentLanguage(state: LanguageState): StudyLanguage | undefined {
  return state.languages.find((l) => l.id === state.current) ?? state.languages[0];
}

export function languageOf(state: LanguageState, word: Word): StudyLanguage | undefined {
  return state.languages.find((l) => l.id === word.lang);
}

export function wordsFor(state: LanguageState, langId: string | undefined): Word[] {
  return state.words.filter((w) => w.lang === langId);
}

/**
 * Starts learning a language and switches to it. A language not learnt before gets its starter words, if it has
 * a set; one already on the list is only switched to.
 */
export function addLanguage(state: LanguageState, lang: StudyLanguage, today: string, makeId: () => string): LanguageState {
  if (!lang.name) return state;
  if (state.languages.some((l) => l.id === lang.id)) return { ...state, current: lang.id };
  const fresh = wordsFor(state, lang.id).length === 0;
  const starter = fresh ? starterFor(lang).map(([w, r, m]) => newWord(makeId(), w, r, m, lang.id, today)) : [];
  return { ...state, languages: [...state.languages, lang], current: lang.id, words: [...state.words, ...starter] };
}

/** Stops learning a language: it and its words go. Practice minutes stay, because they belong to the shared habit. */
export function removeLanguage(state: LanguageState, id: string): LanguageState {
  const languages = state.languages.filter((l) => l.id !== id);
  const current = state.current === id || !languages.some((l) => l.id === state.current) ? languages[0]?.id : state.current;
  return { ...state, languages, current, words: state.words.filter((w) => w.lang !== id) };
}

/**
 * The tab's label, and the Today shortcut's: always "Language". It names the subject, so it reads right for one
 * language or several, and it fits a tab cell on a 320dp phone, where "Portuguese" or even "Languages" does not.
 * The language's own name lives where there is room: the page title, the Today row and the Balance ring.
 */
export function tabTitle(_languages: StudyLanguage[]): string {
  return 'Language';
}

/** A short label with more room (the Balance ring): the language when there is one and it fits, else the subject. */
export function shortTitle(languages: StudyLanguage[]): string {
  if (languages.length > 1) return 'Languages';
  const only = languages[0];
  return only && only.name.length <= SHORT_NAME_MAX ? only.name : 'Language';
}

/** What is being practised, for sentences: "Spanish", "Spanish and Japanese", or "language" for none or three plus. */
export function practiceSubject(languages: StudyLanguage[]): string {
  if (languages.length === 1) return languages[0].name;
  if (languages.length === 2) return `${languages[0].name} and ${languages[1].name}`;
  return 'language';
}

/** The Today row's title: "Spanish practice", or "Language practice" for several languages. */
export function practiceTitle(languages: StudyLanguage[]): string {
  return languages.length === 1 ? `${languages[0].name} practice` : 'Language practice';
}

/** Reads any saved shape (a missing value, the Chinese-only state, or this one) and returns the current one. */
export function upgradeLanguageState(raw: unknown): LanguageState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof LanguageState, unknown>>;
  const target = typeof r.target === 'number' && r.target > 0 ? r.target : EMPTY_LANGUAGE.target;
  const logs = (Array.isArray(r.logs) ? r.logs : []) as PracticeLog[];
  const rawWords = (Array.isArray(r.words) ? r.words : []).filter((w): w is Partial<Word> => !!w && typeof w === 'object');
  const legacy = !Array.isArray(r.languages);
  const languages = (legacy ? [] : (r.languages as unknown[])).filter(
    (l): l is StudyLanguage => !!l && typeof l === 'object' && typeof (l as StudyLanguage).id === 'string' && !!(l as StudyLanguage).name,
  );
  // Before languages existed every word and every minute practised was Chinese.
  if (legacy && (rawWords.length > 0 || logs.some((l) => l.minutes > 0))) languages.push({ ...CHINESE });
  const words = rawWords.map((w) => ({
    ...w,
    hanzi: String(w.hanzi ?? ''),
    pinyin: String(w.pinyin ?? ''),
    meaning: String(w.meaning ?? ''),
    lang: typeof w.lang === 'string' && w.lang ? w.lang : CHINESE.id,
  })) as Word[];
  // A word never loses its language: one missing from the list (a hand-edited backup) is put back.
  for (const w of words) {
    if (languages.some((l) => l.id === w.lang)) continue;
    const info = languageInfo(w.lang);
    languages.push(info ? makeLanguage(info.code) : { id: w.lang, code: OTHER, name: w.lang.replace(/^other:/, '') || 'Language' });
  }
  const current = languages.some((l) => l.id === r.current) ? (r.current as string) : languages[0]?.id;
  return current ? { target, words, logs, languages, current } : { target, words, logs, languages };
}

export function dueWords(state: LanguageState, today: string, langId?: string): Word[] {
  return state.words
    .filter((w) => w.due <= today && (langId === undefined || w.lang === langId))
    .sort((a, b) => a.due.localeCompare(b.due));
}

export function todaysLog(state: Pick<LanguageState, 'logs'>, today: string): PracticeLog {
  return state.logs.find((l) => l.date === today) ?? { date: today, minutes: 0, reviewed: 0 };
}

function withLog(state: LanguageState, today: string, change: (l: PracticeLog) => PracticeLog): LanguageState {
  const next = change(todaysLog(state, today));
  const others = state.logs.filter((l) => l.date !== today);
  return { ...state, logs: [...others, next] };
}

export function addMinutes(state: LanguageState, today: string, minutes: number): LanguageState {
  return withLog(state, today, (l) => ({ ...l, minutes: Math.max(0, l.minutes + minutes) }));
}

/** Schedule the next review. "Again" keeps the word due today and resets its interval. */
export function review(state: LanguageState, today: string, wordId: string, grade: Grade): LanguageState {
  const words = state.words.map((w) => {
    if (w.id !== wordId) return w;
    if (grade === 'again') return { ...w, interval: 1, streak: 0, due: today };
    const interval = grade === 'easy' ? Math.max(4, Math.round(w.interval * 3)) : w.streak === 0 ? 1 : Math.round(w.interval * 2);
    return { ...w, interval, streak: w.streak + 1, due: addDays(today, interval) };
  });
  return withLog({ ...state, words }, today, (l) => ({ ...l, reviewed: l.reviewed + 1 }));
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) that met the target. */
export function streakDays(state: Pick<LanguageState, 'logs' | 'target'>, today: string): number {
  const met = new Set(state.logs.filter((l) => l.minutes >= state.target).map((l) => l.date));
  let day = met.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (met.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function newWord(id: string, word: string, reading: string, meaning: string, lang: string, today: string): Word {
  return { id, hanzi: word, pinyin: reading, meaning, lang, due: today, interval: 1, streak: 0 };
}
