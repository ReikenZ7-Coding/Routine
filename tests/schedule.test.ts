import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  type GroceryItem,
  addDays,
  describeRepeat,
  markBought,
  needsBuying,
  nextDue,
  unmarkBought,
} from '../src/lib/schedule.ts';

const today = '2026-10-29'; // a Thursday

function item(partial: Partial<GroceryItem>): GroceryItem {
  return { id: 'x', name: 'Chicken', repeat: { kind: 'everyNDays', n: 1 }, createdAt: today, ...partial };
}

test('daily staple is needed until bought today', () => {
  const chicken = item({ lastBought: addDays(today, -1) });
  assert.equal(needsBuying(chicken, today), true);
  const bought = markBought(chicken, today);
  assert.equal(needsBuying(bought, today), false);
  assert.equal(needsBuying(bought, addDays(today, 1)), true);
});

test('every 3 days waits three days after the last purchase', () => {
  const rice = item({ repeat: { kind: 'everyNDays', n: 3 }, lastBought: addDays(today, -2) });
  assert.equal(needsBuying(rice, today), false);
  assert.equal(nextDue(rice, today), addDays(today, 1));
  assert.equal(needsBuying(rice, addDays(today, 1)), true);
});

test('weekday items show only on their days', () => {
  const milk = item({ repeat: { kind: 'weekdays', days: [1, 4] } }); // Mon, Thu
  assert.equal(needsBuying(milk, today), true);
  assert.equal(needsBuying(milk, addDays(today, 1)), false);
  assert.equal(nextDue(milk, today), addDays(today, 4)); // next Monday
});

test('one-off disappears once bought, and undo brings it back', () => {
  const cake = item({ repeat: { kind: 'once' } });
  assert.equal(needsBuying(cake, today), true);
  const bought = markBought(cake, today);
  assert.equal(needsBuying(bought, addDays(today, 1)), false);
  const undone = unmarkBought(bought, today);
  assert.equal(needsBuying(undone, today), true);
  assert.equal(undone.lastBought, undefined);
});

test('undo restores the previous purchase date', () => {
  const eggs = item({ lastBought: '2026-10-20' });
  const undone = unmarkBought(markBought(eggs, today), today);
  assert.equal(undone.lastBought, '2026-10-20');
});

test('repeat descriptions read naturally', () => {
  assert.equal(describeRepeat({ kind: 'everyNDays', n: 1 }), 'Every day');
  assert.equal(describeRepeat({ kind: 'everyNDays', n: 7 }), 'Every week');
  assert.equal(describeRepeat({ kind: 'weekdays', days: [4, 1] }), 'Mon, Thu');
  assert.equal(describeRepeat({ kind: 'once' }), 'One-off');
});
