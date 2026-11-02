import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Routine } from '../src/lib/routines.ts';
import { dayStreak, partOf, whenDone } from '../src/lib/stats.ts';

const today = '2026-11-01';

function routine(partial: Partial<Routine>): Routine {
  return { id: 'r', name: 'Stretch', repeat: { kind: 'everyNDays', n: 1 }, time: 'evening', doneDates: [], ...partial };
}

test('day streak counts full days back from today', () => {
  const a = routine({ id: 'a', doneDates: ['2026-10-30', '2026-10-31'] });
  const b = routine({ id: 'b', name: 'Read', doneDates: ['2026-10-30', '2026-10-31'] });
  assert.equal(dayStreak([a, b], today), 2); // today not finished yet, streak still alive
  assert.equal(
    dayStreak(
      [
        { ...a, doneDates: [...a.doneDates, today] },
        { ...b, doneDates: [...b.doneDates, today] },
      ],
      today,
    ),
    3,
  );
});

test('a half-done day breaks the streak, a skipped one does not', () => {
  const a = routine({ id: 'a', doneDates: ['2026-10-29', '2026-10-31'] });
  const b = routine({ id: 'b', name: 'Read', doneDates: ['2026-10-29', '2026-10-30', '2026-10-31'] });
  assert.equal(dayStreak([a, b], today), 1);
  assert.equal(dayStreak([{ ...a, skipDates: ['2026-10-30'] }, b], today), 3);
});

test('rest days and one-off tasks are ignored', () => {
  const weekend = routine({ id: 'w', repeat: { kind: 'weekdays', days: [6, 0] }, doneDates: ['2026-10-25', '2026-10-31'] }); // Sun, Sat
  const once = routine({ id: 'o', repeat: { kind: 'once' } });
  assert.equal(dayStreak([weekend, once], today), 2);
  assert.equal(dayStreak([], today), 0);
});

test('when things get done sorts occasions by weekday and part of the day', () => {
  assert.equal(partOf({ start: '07:30', time: 'evening' }), 'morning');
  assert.equal(partOf({ start: '12:00', time: 'morning' }), 'afternoon');
  assert.equal(partOf({ start: '17:00', time: 'morning' }), 'evening');
  assert.equal(partOf({ time: 'anytime' }), 'anytime');
  // 2026-11-01 is a Sunday; over the last 7 days a daily morning stretch was done on Saturday and Sunday.
  const r = routine({ start: '08:00', doneDates: ['2026-10-31', '2026-11-01'] });
  const w = whenDone([r], today, 7);
  assert.deepEqual(w.morning[5], { planned: 1, done: 1 });
  assert.deepEqual(w.morning[6], { planned: 1, done: 1 });
  assert.deepEqual(w.morning[0], { planned: 1, done: 0 });
  assert.equal(
    w.evening.reduce((n, c) => n + c.planned, 0),
    0,
  );
});

test('when things get done leaves out skipped days and days off the schedule', () => {
  const r = routine({ repeat: { kind: 'weekdays', days: [1] }, skipDates: ['2026-10-26'], time: 'afternoon' });
  const w = whenDone([r], today, 14);
  // Two Mondays in the last 14 days (19 and 26 October); the 26th was skipped.
  assert.deepEqual(w.afternoon[0], { planned: 1, done: 0 });
  assert.equal(
    w.afternoon.slice(1).reduce((n, c) => n + c.planned, 0),
    0,
  );
});
