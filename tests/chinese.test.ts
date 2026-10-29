import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_CHINESE, addMinutes, dueWords, newWord, review, streakDays, todaysLog } from '../src/lib/chinese.ts';

const today = '2026-10-29';

test('new words are due today and move out after a good review', () => {
  let s = { ...EMPTY_CHINESE, words: [newWord('a', '你好', 'nǐ hǎo', 'hello', today)] };
  assert.equal(dueWords(s, today).length, 1);
  s = review(s, today, 'a', 'good');
  assert.equal(dueWords(s, today).length, 0);
  assert.equal(s.words[0].due, '2026-10-30');
  assert.equal(todaysLog(s, today).reviewed, 1);
});

test('intervals grow with good answers and reset on again', () => {
  let s = { ...EMPTY_CHINESE, words: [newWord('a', '水', 'shuǐ', 'water', today)] };
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
  let s = { ...EMPTY_CHINESE, target: 10 };
  s = addMinutes(s, '2026-10-27', 10);
  s = addMinutes(s, '2026-10-28', 15);
  assert.equal(streakDays(s, today), 2); // today not done yet, streak still alive
  s = addMinutes(s, today, 5);
  s = addMinutes(s, today, 5);
  assert.equal(todaysLog(s, today).minutes, 10);
  assert.equal(streakDays(s, today), 3);
});
