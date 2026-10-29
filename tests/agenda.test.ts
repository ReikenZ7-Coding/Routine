import { test } from 'node:test';
import assert from 'node:assert/strict';
import { marksFor, monthGrid, weekOf } from '../src/lib/agenda.ts';
import { EMPTY_CHINESE } from '../src/lib/chinese.ts';
import { EMPTY_GYM } from '../src/lib/gym.ts';

const today = '2026-10-29'; // Thursday

test('weeks start on Monday', () => {
  assert.deepEqual(weekOf(today), [
    '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01',
  ]);
});

test('month grid covers every day of the month once', () => {
  const grid = monthGrid(today);
  const days = grid.flat().filter(Boolean);
  assert.equal(days.length, 31);
  assert.equal(days[0], '2026-10-01');
  assert.equal(grid[0].indexOf('2026-10-01'), 3); // Oct 1 2026 is a Thursday
});

test('marks a gym day and a weekly routine on the right dates', () => {
  const state = {
    groceries: [],
    chinese: EMPTY_CHINESE,
    gym: { ...EMPTY_GYM, sessions: [{ id: 's', name: 'Push', days: [1], exercises: [] }] },
    routines: [{ id: 'r', name: 'Clean', repeat: { kind: 'weekdays' as const, days: [6] }, time: 'morning' as const, doneDates: [] }],
  };
  assert.equal(marksFor(state, '2026-11-02', today).gym, true); // Monday
  assert.equal(marksFor(state, '2026-10-31', today).routines, true); // Saturday
  assert.equal(marksFor(state, '2026-10-30', today).routines, false);
});

test('past days only show what was actually done', () => {
  const state = {
    groceries: [],
    chinese: EMPTY_CHINESE,
    gym: EMPTY_GYM,
    routines: [{ id: 'r', name: 'Stretch', repeat: { kind: 'everyNDays' as const, n: 1 }, time: 'evening' as const, doneDates: ['2026-10-27'] }],
  };
  assert.equal(marksFor(state, '2026-10-27', today).routines, true);
  assert.equal(marksFor(state, '2026-10-28', today).routines, false);
  assert.equal(marksFor(state, '2026-10-30', today).routines, true);
});
