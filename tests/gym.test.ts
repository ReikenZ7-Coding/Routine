import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type GymState,
  EMPTY_GYM,
  STARTER_PLANS,
  buildSessions,
  lastTime,
  nextSession,
  sessionFor,
  sessionProgress,
  setTodaysWeight,
  toggleSet,
  workingWeight,
} from '../src/lib/gym.ts';

let n = 0;
const id = () => `id${n++}`;
const ppl: GymState = { ...EMPTY_GYM, sessions: buildSessions(STARTER_PLANS[0].sessions, id) };
const thu = '2026-10-29';
const nextMon = '2026-11-02';

test('picks the session for the weekday and finds the next one on rest days', () => {
  assert.equal(sessionFor(ppl, thu)?.name, 'Push');
  const sunday = '2026-11-01';
  assert.equal(sessionFor(ppl, sunday), undefined);
  assert.deepEqual(nextSession(ppl, sunday)?.date, nextMon);
});

test('logging sets updates progress and can be undone', () => {
  const push = sessionFor(ppl, thu)!;
  const bench = push.exercises[0];
  let s = toggleSet(ppl, thu, push, bench, 0, 40);
  s = toggleSet(s, thu, push, bench, 1, 40);
  assert.deepEqual(sessionProgress(s, thu, push), { done: 2, total: 12 });
  s = toggleSet(s, thu, push, bench, 1, 40);
  assert.deepEqual(sessionProgress(s, thu, push), { done: 1, total: 12 });
});

test('remembers last time and starts from that weight', () => {
  const push = sessionFor(ppl, thu)!;
  const bench = push.exercises[0];
  let s = toggleSet(ppl, thu, push, bench, 0, 40);
  s = setTodaysWeight(s, thu, push.id, bench.id, 42.5);
  assert.deepEqual(lastTime(s, 'Bench press', nextMon), { date: thu, weight: 42.5, reps: 8 });
  assert.equal(workingWeight(s, nextMon, push, bench), 42.5);
  assert.equal(workingWeight(ppl, nextMon, push, bench), 40);
});
