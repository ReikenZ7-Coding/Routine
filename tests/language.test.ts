import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup } from '../src/lib/backup.ts';
import {
  EMPTY_LANGUAGE,
  MORE,
  OTHER,
  POPULAR,
  addLanguage,
  addMinutes,
  currentLanguage,
  dueWords,
  findByName,
  infoFor,
  isRtl,
  makeLanguage,
  newWord,
  practiceSubject,
  practiceTitle,
  readingLabel,
  removeLanguage,
  review,
  streakDays,
  tabTitle,
  todaysLog,
  upgradeLanguageState,
  wordLabel,
  wordsFor,
} from '../src/lib/language.ts';

const today = '2026-10-29';
let n = 0;
const id = () => `id${++n}`;

// The shape saved before languages existed: Chinese words with no language of their own.
const LEGACY = {
  target: 20,
  words: [
    { id: 'w1', hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', due: '2026-10-29', interval: 1, streak: 1 },
    { id: 'w2', hanzi: '谢谢', pinyin: 'xièxie', meaning: 'thank you', due: '2026-11-02', interval: 3, streak: 2 },
  ],
  logs: [{ date: '2026-10-28', minutes: 20, reviewed: 4 }],
};

test('new words are due today and move out after a good review', () => {
  let s = { ...EMPTY_LANGUAGE, words: [newWord('a', '你好', 'nǐ hǎo', 'hello', 'zh', today)] };
  assert.equal(dueWords(s, today).length, 1);
  s = review(s, today, 'a', 'good');
  assert.equal(dueWords(s, today).length, 0);
  assert.equal(s.words[0].due, '2026-10-30');
  assert.equal(todaysLog(s, today).reviewed, 1);
});

test('intervals grow with good answers and reset on again', () => {
  let s = { ...EMPTY_LANGUAGE, words: [newWord('a', '水', 'shuǐ', 'water', 'zh', today)] };
  s = review(s, today, 'a', 'good'); // 1 day
  s = review(s, '2026-10-30', 'a', 'good'); // 2 days
  assert.equal(s.words[0].due, '2026-11-01');
  s = review(s, '2026-11-01', 'a', 'easy'); // 6 days
  assert.equal(s.words[0].interval, 6);
  s = review(s, '2026-11-07', 'a', 'again');
  assert.equal(s.words[0].due, '2026-11-07');
  assert.equal(s.words[0].streak, 0);
});

test('minutes add up and the streak counts days that met the target', () => {
  let s = { ...EMPTY_LANGUAGE, target: 10 };
  s = addMinutes(s, '2026-10-27', 10);
  s = addMinutes(s, '2026-10-28', 15);
  assert.equal(streakDays(s, today), 2); // today not done yet, streak still alive
  s = addMinutes(s, today, 5);
  s = addMinutes(s, today, 5);
  assert.equal(todaysLog(s, today).minutes, 10);
  assert.equal(streakDays(s, today), 3);
});

test('a Chinese-only save loads unchanged, with Chinese as its language', () => {
  const s = upgradeLanguageState(structuredClone(LEGACY));
  assert.deepEqual(s.languages, [{ id: 'zh', code: 'zh', name: 'Chinese' }]);
  assert.equal(s.current, 'zh');
  assert.equal(s.target, 20);
  assert.deepEqual(s.logs, LEGACY.logs);
  assert.equal(s.words.length, 2);
  for (const [i, w] of s.words.entries()) assert.deepEqual(w, { ...LEGACY.words[i], lang: 'zh' });
  assert.equal(currentLanguage(s)?.name, 'Chinese');
  assert.equal(wordsFor(s, 'zh').length, 2);
});

test('a save with only practice minutes is Chinese too; an untouched one has no language yet', () => {
  assert.equal(upgradeLanguageState({ target: 15, words: [], logs: [{ date: today, minutes: 5, reviewed: 0 }] }).current, 'zh');
  const fresh = upgradeLanguageState({ target: 15, words: [], logs: [] });
  assert.deepEqual(fresh.languages, []);
  assert.equal(fresh.current, undefined);
  assert.deepEqual(upgradeLanguageState(null), EMPTY_LANGUAGE);
  assert.deepEqual(upgradeLanguageState('nonsense'), EMPTY_LANGUAGE);
});

test('upgrading is idempotent and keeps a current save as it is', () => {
  let s = upgradeLanguageState(structuredClone(LEGACY));
  s = addLanguage(s, makeLanguage('es'), today, id);
  const again = upgradeLanguageState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(again, s);
});

test('a word whose language went missing keeps it', () => {
  const s = upgradeLanguageState({
    target: 15,
    languages: [],
    words: [newWord('a', 'hola', '', 'hello', 'es', today), newWord('b', 'kia ora', '', 'hello', 'other:māori', today)],
    logs: [],
  });
  assert.deepEqual(
    s.languages.map((l) => [l.id, l.name]),
    [
      ['es', 'Spanish'],
      ['other:māori', 'māori'],
    ],
  );
});

test('an old backup restores into the language state', () => {
  const backup = makeBackup({ groceries: [], gym: { sessions: [], logs: [] }, chinese: LEGACY, routines: [], journal: {}, inbox: [] });
  const s = upgradeLanguageState(parseBackup(backup).chinese);
  assert.equal(s.current, 'zh');
  assert.equal(s.words[1].hanzi, '谢谢');
  // and a new backup keeps every language
  const two = addLanguage(s, makeLanguage('ja'), today, id);
  const back = upgradeLanguageState(
    parseBackup(makeBackup({ groceries: [], gym: {}, chinese: two, routines: [], journal: {}, inbox: [] })).chinese,
  );
  assert.deepEqual(back, two);
});

test('choosing a language switches to it and brings its starter words', () => {
  let s = addLanguage(EMPTY_LANGUAGE, makeLanguage('es'), today, id);
  assert.equal(s.current, 'es');
  assert.equal(wordsFor(s, 'es').length, 8);
  assert.ok(s.words.every((w) => w.lang === 'es' && w.due === today));
  s = addLanguage(s, makeLanguage('ja'), today, id);
  assert.equal(s.current, 'ja');
  assert.equal(s.words.length, 16);
  // choosing one already learnt only switches back to it
  s = addLanguage(s, makeLanguage('es'), today, id);
  assert.equal(s.current, 'es');
  assert.equal(s.languages.length, 2);
  assert.equal(s.words.length, 16);
});

test('another language takes the typed name and has no starter set', () => {
  const lang = makeLanguage(OTHER, '  Scottish   Gaelic ');
  assert.deepEqual(lang, { id: 'other:scottish gaelic', code: OTHER, name: 'Scottish Gaelic' });
  const s = addLanguage(EMPTY_LANGUAGE, lang, today, id);
  assert.equal(s.words.length, 0);
  assert.equal(infoFor(lang).glyph, 'S');
  assert.equal(addLanguage(EMPTY_LANGUAGE, makeLanguage(OTHER, '   '), today, id), EMPTY_LANGUAGE);
  assert.equal(findByName('español')?.code, 'es');
  assert.equal(findByName('Japanese')?.code, 'ja');
  assert.equal(findByName('Klingon'), undefined);
});

test('removing a language takes its words and keeps the minutes', () => {
  let s = addLanguage(EMPTY_LANGUAGE, makeLanguage('es'), today, id);
  s = addLanguage(s, makeLanguage('fr'), today, id);
  s = addMinutes(s, today, 10);
  s = removeLanguage(s, 'fr');
  assert.deepEqual(
    s.languages.map((l) => l.id),
    ['es'],
  );
  assert.equal(s.current, 'es');
  assert.ok(s.words.every((w) => w.lang === 'es'));
  assert.equal(todaysLog(s, today).minutes, 10);
  s = removeLanguage(s, 'es');
  assert.deepEqual(s.languages, []);
  assert.equal(s.current, undefined);
  assert.equal(s.words.length, 0);
});

test('due words can be counted for one language or all of them', () => {
  let s = addLanguage(EMPTY_LANGUAGE, makeLanguage('es'), today, id);
  s = addLanguage(s, makeLanguage('ko'), today, id);
  assert.equal(dueWords(s, today).length, 16);
  assert.equal(dueWords(s, today, 'ko').length, 8);
});

test('labels follow the languages', () => {
  const es = makeLanguage('es');
  const ja = makeLanguage('ja');
  assert.equal(tabTitle([]), 'Language');
  assert.equal(tabTitle([es]), 'Spanish');
  assert.equal(tabTitle([es, ja]), 'Languages');
  assert.equal(tabTitle([makeLanguage(OTHER, 'Scottish Gaelic')]), 'Language'); // too long for the tab bar
  assert.equal(practiceTitle([es]), 'Spanish practice');
  assert.equal(practiceTitle([es, ja]), 'Language practice');
  assert.equal(practiceSubject([es, ja]), 'Spanish and Japanese');
  assert.equal(practiceSubject([es, ja, makeLanguage('fr')]), 'language');
  assert.equal(readingLabel(makeLanguage('zh')), 'Pinyin');
  assert.equal(readingLabel(ja), 'Reading');
  assert.equal(readingLabel(makeLanguage('ko')), 'Romanization');
  assert.equal(readingLabel(es), 'Pronunciation');
  assert.equal(wordLabel(makeLanguage('zh')), 'Characters');
  assert.equal(wordLabel(es), 'Word or phrase');
  assert.deepEqual(
    ['ar', 'he', 'fa', 'ur', 'es'].map((c) => isRtl(makeLanguage(c))),
    [true, true, true, true, false],
  );
});

test('the catalogue is consistent', () => {
  const all = [...POPULAR, ...MORE];
  assert.equal(new Set(all.map((l) => l.code)).size, all.length);
  for (const l of POPULAR) assert.equal(l.starter?.length, 8, l.name);
  for (const l of MORE) assert.equal(l.starter, undefined, l.name);
  // every name fits the tab bar
  for (const l of all) assert.equal(tabTitle([makeLanguage(l.code)]), l.name);
});
