import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type LifeState, dayPlan, dueNow, navCounts, needsYou, nextUp, weekSeries } from '../src/lib/day.ts';
import { EMPTY_GYM, type GymState } from '../src/lib/gym.ts';
import { EMPTY_LANGUAGE, type LanguageState } from '../src/lib/language.ts';
import type { Routine } from '../src/lib/routines.ts';
import type { GroceryItem } from '../src/lib/schedule.ts';

const today = '2026-11-02'; // a Monday

const routine = (p: Partial<Routine>): Routine => ({
  id: 'r',
  name: 'Stretch',
  repeat: { kind: 'everyNDays', n: 1 },
  time: 'anytime',
  doneDates: [],
  ...p,
});

const empty: LifeState = { routines: [], inbox: [], groceries: [], gym: EMPTY_GYM, language: EMPTY_LANGUAGE };

const gym: GymState = {
  sessions: [{ id: 's1', name: 'Push day', days: [1], exercises: [{ id: 'e1', name: 'Bench press', sets: 3, reps: 8, weight: 40 }] }],
  logs: [{ date: today, sessionId: 's1', exerciseId: 'e1', exerciseName: 'Bench press', set: 0, weight: 40, reps: 8 }],
};
const language: LanguageState = {
  target: 15,
  languages: [{ id: 'zh', code: 'zh', name: 'Chinese' }],
  current: 'zh',
  words: [
    { id: 'w1', hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', lang: 'zh', due: today, interval: 1, streak: 1 },
    { id: 'w2', hanzi: '谢谢', pinyin: 'xièxie', meaning: 'thanks', lang: 'zh', due: '2026-11-04', interval: 3, streak: 2 },
  ],
  logs: [{ date: today, minutes: 5, reviewed: 1 }],
};
const milk: GroceryItem = { id: 'g1', name: 'Milk', repeat: { kind: 'everyNDays', n: 1 }, createdAt: '2026-10-01' };

const full: LifeState = {
  routines: [
    routine({ id: 'a', name: 'Rise and shine', start: '07:00', duration: 15, doneDates: [today] }),
    routine({ id: 'b', name: 'Walk', start: '09:00', duration: 20 }),
    routine({ id: 'c', name: 'Stretch', start: '10:45', duration: 10 }),
    routine({ id: 'd', name: 'Read', start: '21:30', duration: 30, reminder: { hour: 21, minute: 0 } }),
    routine({ id: 'e', name: 'Water', target: 8 }),
  ],
  inbox: [
    { id: 'i1', title: 'Call Mum', date: today, createdAt: '2026-10-30' },
    { id: 'i2', title: 'Book the dentist', createdAt: '2026-10-30' },
  ],
  groceries: [milk],
  gym,
  language,
};

test('a brand-new day has nothing on it', () => {
  const plan = dayPlan(empty, today, today);
  assert.equal(plan.total, 0);
  assert.equal(plan.done, 0);
  assert.deepEqual(navCounts(empty, today), { today: 0, inbox: 0, language: 0, groceries: 0 });
  assert.deepEqual(needsYou(empty, today, 600), []);
  assert.deepEqual(dueNow(empty, today, 600), []);
});

test('the day counts routines, to-dos, groceries, the workout and practice once each', () => {
  const plan = dayPlan(full, today, today);
  // 5 routines + 1 to-do + 1 grocery + workout + practice
  assert.equal(plan.total, 9);
  assert.equal(plan.done, 1);
  assert.equal(plan.gym?.done, 1);
  assert.equal(plan.timed.length, 4);
  assert.deepEqual(navCounts(full, today), { today: 8, inbox: 1, language: 1, groceries: 1 });
});

test('a skipped routine leaves the count, and a past day shows only what was bought', () => {
  const skipped = { ...full, routines: full.routines.map((r) => (r.id === 'b' ? { ...r, skipDates: [today] } : r)) };
  assert.equal(dayPlan(skipped, today, today).total, 8);
  const past = dayPlan({ ...full, groceries: [{ ...milk, lastBought: '2026-11-01' }] }, '2026-11-01', today);
  assert.equal(past.groceries.length, 1);
  assert.equal(past.showPractice, false); // nothing logged that day
});

test('needs you: late steps first, then up next within the hour, then the rest in order', () => {
  const needs = needsYou(full, today, 10 * 60 + 30); // 10:30
  assert.deepEqual(
    needs.map((n) => n.key),
    ['late-b', 'next-c', 'todo-i1', 'words', 'gym', 'groceries', 'inbox'],
  );
  assert.equal(needs[0].meta, 'Was at 09:00 · still open');
  assert.equal(needs[1].meta, 'Up next at 10:45 · in 15 min');
  assert.equal(needs[3].title, '1 word to review');
  assert.equal(needs[4].meta, '1 of 3 sets');
});

test('needs you: a step more than an hour away is not up next yet, one under way is', () => {
  assert.ok(!needsYou(full, today, 7 * 60 + 30).some((n) => n.key.startsWith('next-')));
  const now = needsYou(full, today, 10 * 60 + 50);
  const step = now.find((n) => n.key === 'next-c');
  assert.equal(step?.meta, 'Happening now · 5 min left');
});

test('the bell counts reminders that came up and timed steps that passed, each routine once', () => {
  const due = dueNow(full, today, 21 * 60 + 5);
  assert.deepEqual(
    due.map((d) => [d.routine, d.line]),
    [
      ['b', 'Was at 09:00, still open'],
      ['c', 'Was at 10:45, still open'],
      ['d', 'Reminder at 21:00'],
    ],
  );
  assert.deepEqual(dueNow(full, today, 6 * 60), []);
});

test('week series: the last seven days of routines, sets and minutes', () => {
  const week = weekSeries(full, today);
  assert.equal(week.length, 7);
  assert.equal(week[0].date, '2026-10-27');
  assert.equal(week[6].date, today);
  assert.deepEqual(week[6], { date: today, planned: 5, done: 1, sets: 1, minutes: 5 });
  assert.equal(week[5].sets, 0);
});

test('nextUp words the step as Today does', () => {
  const routines = [routine({ id: 'w', name: 'Walk', start: '09:00', duration: 30 })];
  const plan = dayPlan({ ...empty, routines }, today, today);
  assert.equal(nextUp(plan, today, 8 * 60)?.line, 'Up next · 09:00 · in 1 h');
  assert.equal(nextUp(plan, today, 9 * 60 + 10)?.line, 'Happening now · 20 min left');
  assert.equal(nextUp(plan, today, 10 * 60), undefined);
});
