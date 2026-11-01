import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Routine } from '../src/lib/routines.ts';
import { dayStreak } from '../src/lib/stats.ts';

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
