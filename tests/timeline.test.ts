import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inboxOpen, itemsFor, toggleItem } from '../src/lib/inbox.ts';
import { type Routine, iconFor } from '../src/lib/routines.ts';
import { formatSpan, parseClock, timedRoutines, upNext } from '../src/lib/timeline.ts';

const r = (id: string, start?: string, duration?: number, extra: Partial<Routine> = {}): Routine => ({
  id, name: id, repeat: { kind: 'everyNDays', n: 1 }, time: 'anytime', doneDates: [], start, duration, ...extra,
});

test('routines with a start time go on the timeline in order, the rest are anytime', () => {
  const { timed, anytime } = timedRoutines([r('coffee', '10:15', 15), r('water'), r('rise', '08:30', 15)]);
  assert.deepEqual(timed.map((e) => e.id), ['rise', 'coffee']);
  assert.deepEqual(anytime.map((x) => x.id), ['water']);
  assert.equal(formatSpan(510, 525), '08:30 – 08:45 (15 min)');
  assert.equal(parseClock('7.05'), 425);
  assert.equal(parseClock('25:00'), undefined);
});

test('up next is the routine happening now, else the next one not done', () => {
  const { timed } = timedRoutines([r('yoga', '09:00', 60), r('shower', '10:00', 15, { doneDates: ['2026-10-30'] }), r('bike', '10:30', 30)]);
  assert.deepEqual(upNext(timed, '2026-10-30', 9 * 60 + 41)?.minutes, 19);
  const later = upNext(timed, '2026-10-30', 10 * 60 + 5)!;
  assert.equal(later.entry.id, 'bike');
  assert.equal(later.state, 'next');
  assert.equal(upNext(timed, '2026-10-30', 23 * 60), undefined);
});

test('inbox items wait until planned, and come back if a planned day passes undone', () => {
  const items = [
    { id: 'a', title: 'Call Mum', createdAt: '' },
    { id: 'b', title: 'Book vacation', date: '2026-10-30', createdAt: '' },
    { id: 'c', title: 'Old', date: '2026-10-28', createdAt: '' },
  ];
  assert.deepEqual(inboxOpen(items, '2026-10-30').map((i) => i.id), ['a', 'c']);
  const done = toggleItem(items[0], '2026-10-30');
  assert.deepEqual(itemsFor([done, items[1]], '2026-10-30').map((i) => i.id), ['a', 'b']);
});

test('icons are guessed from the name when none is picked', () => {
  assert.equal(iconFor({ name: 'Yoga workout' }), 'body');
  assert.equal(iconFor({ name: 'Have a coffee' }), 'cafe');
  assert.equal(iconFor({ name: 'Anything', icon: 'heart' }), 'heart');
});
