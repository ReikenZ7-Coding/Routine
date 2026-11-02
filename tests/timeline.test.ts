import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inboxOpen, itemsFor, toggleItem } from '../src/lib/inbox.ts';
import { type Routine, iconFor } from '../src/lib/routines.ts';
import { formatSpan, laneOut, parseClock, timedRoutines, upNext } from '../src/lib/timeline.ts';

const r = (id: string, start?: string, duration?: number, extra: Partial<Routine> = {}): Routine => ({
  id,
  name: id,
  repeat: { kind: 'everyNDays', n: 1 },
  time: 'anytime',
  doneDates: [],
  start,
  duration,
  ...extra,
});

test('routines with a start time go on the timeline in order, the rest are anytime', () => {
  const { timed, anytime } = timedRoutines([r('coffee', '10:15', 15), r('water'), r('rise', '08:30', 15)]);
  assert.deepEqual(
    timed.map((e) => e.id),
    ['rise', 'coffee'],
  );
  assert.deepEqual(
    anytime.map((x) => x.id),
    ['water'],
  );
  assert.equal(formatSpan(510, 525), '08:30 – 08:45 (15 min)');
  assert.equal(parseClock('7.05'), 425);
  assert.equal(parseClock('25:00'), undefined);
});

test('up next is the routine happening now, else the next one not done', () => {
  const { timed } = timedRoutines([
    r('yoga', '09:00', 60),
    r('shower', '10:00', 15, { doneDates: ['2026-10-30'] }),
    r('bike', '10:30', 30),
  ]);
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
  assert.deepEqual(
    inboxOpen(items, '2026-10-30').map((i) => i.id),
    ['a', 'c'],
  );
  const done = toggleItem(items[0], '2026-10-30');
  assert.deepEqual(
    itemsFor([done, items[1]], '2026-10-30').map((i) => i.id),
    ['a', 'b'],
  );
});

test('icons are guessed from the name when none is picked', () => {
  assert.equal(iconFor({ name: 'Yoga workout' }), 'body');
  assert.equal(iconFor({ name: 'Have a coffee' }), 'cafe');
  assert.equal(iconFor({ name: 'Anything', icon: 'heart' }), 'heart');
});

test('laneOut puts overlapping blocks side by side and leaves the rest full width', () => {
  // 07:00-07:15 alone; 21:00-21:30 and 21:15-21:45 overlap; 21:30-22:00 reuses the first lane of that cluster.
  const lanes = laneOut([
    { start: 1260, end: 1290 },
    { start: 420, end: 435 },
    { start: 1275, end: 1305 },
    { start: 1290, end: 1320 },
  ]);
  assert.deepEqual(lanes, [
    { lane: 0, lanes: 2 },
    { lane: 0, lanes: 1 },
    { lane: 1, lanes: 2 },
    { lane: 0, lanes: 2 },
  ]);
});

test('laneOut gives blocks that only touch one lane each', () => {
  assert.deepEqual(
    laneOut([
      { start: 600, end: 630 },
      { start: 630, end: 660 },
    ]),
    [
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ],
  );
});
