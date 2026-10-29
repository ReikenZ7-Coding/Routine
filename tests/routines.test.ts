import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Routine, isScheduled, streak, toggleDone } from '../src/lib/routines.ts';

const today = '2026-10-29'; // Thursday

function routine(partial: Partial<Routine>): Routine {
  return { id: 'r', name: 'Stretch', repeat: { kind: 'everyNDays', n: 1 }, time: 'evening', doneDates: [], ...partial };
}

test('daily routine streak counts back from today', () => {
  let r = routine({ doneDates: ['2026-10-27', '2026-10-28'] });
  assert.equal(streak(r, today), 2); // today not done yet, streak still alive
  r = toggleDone(r, today);
  assert.equal(streak(r, today), 3);
  assert.equal(streak(routine({ doneDates: ['2026-10-26'] }), today), 0);
});

test('weekday routine only counts its own days', () => {
  const r = routine({ repeat: { kind: 'weekdays', days: [1, 4] }, doneDates: ['2026-10-22', '2026-10-26'] }); // Thu, Mon
  assert.equal(isScheduled(r, today), true);
  assert.equal(isScheduled(r, '2026-10-30'), false);
  assert.equal(streak(r, today), 2);
});

test('every 3 days comes back three days after it was done', () => {
  const r = routine({ repeat: { kind: 'everyNDays', n: 3 }, doneDates: ['2026-10-27'] });
  assert.equal(isScheduled(r, today), false);
  assert.equal(isScheduled(r, '2026-10-30'), true);
});

test('one-off routine disappears once done', () => {
  const r = toggleDone(routine({ repeat: { kind: 'once' } }), today);
  assert.equal(isScheduled(r, today), true);
  assert.equal(isScheduled(r, '2026-10-30'), false);
});
