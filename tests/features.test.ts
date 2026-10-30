import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeBackup, parseBackup } from '../src/lib/backup.ts';
import { setEntry } from '../src/lib/journal.ts';
import { isRecord, personalRecords, workoutHistory } from '../src/lib/records.ts';
import { type Routine, isScheduled, reminderTriggers, streak, tapRoutine, toggleSkip } from '../src/lib/routines.ts';
import { groceryListText } from '../src/lib/schedule.ts';
import { weekStats } from '../src/lib/stats.ts';

const daily = (extra: Partial<Routine> = {}): Routine => ({
  id: 'r', name: 'Water', repeat: { kind: 'everyNDays', n: 1 }, time: 'anytime', doneDates: [], ...extra,
});

test('counter routines are done when the count reaches the target, and a further tap resets', () => {
  let r = daily({ target: 3 });
  r = tapRoutine(r, '2026-10-30');
  r = tapRoutine(r, '2026-10-30');
  assert.equal(r.counts!['2026-10-30'], 2);
  assert.deepEqual(r.doneDates, []);
  r = tapRoutine(r, '2026-10-30');
  assert.deepEqual(r.doneDates, ['2026-10-30']);
  r = tapRoutine(r, '2026-10-30');
  assert.deepEqual(r.doneDates, []);
  assert.equal(r.counts!['2026-10-30'], undefined);
});

test('skipping a day keeps the streak going', () => {
  let r = daily({ doneDates: ['2026-10-27', '2026-10-28', '2026-10-30'] });
  assert.equal(streak(r, '2026-10-30'), 1);
  r = toggleSkip(r, '2026-10-29');
  assert.equal(streak(r, '2026-10-30'), 3);
  const weekly = toggleSkip({ ...r, repeat: { kind: 'weekdays', days: [1, 3] }, doneDates: ['2026-10-19', '2026-10-21', '2026-10-28'] }, '2026-10-26');
  assert.equal(streak(weekly, '2026-10-28'), 3);
});

test('a skip moves an every-N-days routine on like doing it would', () => {
  const r = toggleSkip({ ...daily(), repeat: { kind: 'everyNDays', n: 3 } }, '2026-10-30');
  assert.equal(isScheduled(r, '2026-10-30'), true);
  assert.equal(isScheduled(r, '2026-10-31'), false);
  assert.equal(isScheduled(r, '2026-11-02'), true);
});

test('reminders become one daily trigger, or one weekly trigger per weekday (Sunday = 1)', () => {
  assert.deepEqual(reminderTriggers(daily({ reminder: { hour: 8, minute: 30 } })), [{ hour: 8, minute: 30 }]);
  assert.deepEqual(
    reminderTriggers(daily({ repeat: { kind: 'weekdays', days: [0, 6] }, reminder: { hour: 7, minute: 0 } })),
    [{ weekday: 1, hour: 7, minute: 0 }, { weekday: 7, hour: 7, minute: 0 }],
  );
  assert.deepEqual(reminderTriggers(daily()), []);
});

test('journal entries clear themselves when emptied', () => {
  let j = setEntry({}, '2026-10-30', { mood: 4, note: 'Good gym day' });
  assert.deepEqual(j['2026-10-30'], { mood: 4, note: 'Good gym day' });
  j = setEntry(j, '2026-10-30', { note: '  ' });
  assert.deepEqual(j['2026-10-30'], { mood: 4 });
  j = setEntry(j, '2026-10-30', { mood: undefined });
  assert.equal('2026-10-30' in j, false);
});

const log = (date: string, weight: number, reps = 5, name = 'Squat') => ({
  date, sessionId: 's', exerciseId: 'e', exerciseName: name, set: 0, reps, weight,
});

test('a heavier lift than every earlier day is a record; the very first one is not', () => {
  const logs = [log('2026-10-20', 60), log('2026-10-23', 62.5), log('2026-10-27', 62.5)];
  assert.equal(isRecord(logs, 'Squat', '2026-10-20'), false);
  assert.equal(isRecord(logs, 'squat ', '2026-10-23'), true);
  assert.equal(isRecord(logs, 'Squat', '2026-10-27'), false);
  assert.deepEqual(personalRecords(logs)[0], { name: 'Squat', weight: 62.5, reps: 5, date: '2026-10-23' });
  const history = workoutHistory({ sessions: [{ id: 's', name: 'Legs', days: [], exercises: [] }], logs });
  assert.deepEqual(history[1], { date: '2026-10-23', sessionName: 'Legs', sets: 1, volume: 312.5, records: 1 });
});

test('week stats count routines, gym and Chinese over the last 7 days', () => {
  const s = weekStats(
    [daily({ doneDates: ['2026-10-29', '2026-10-30'] })],
    { sessions: [], logs: [log('2026-10-28', 50, 10), log('2026-10-20', 50)] },
    { target: 15, words: [], logs: [{ date: '2026-10-30', minutes: 20, reviewed: 3 }] },
    '2026-10-30',
  );
  assert.equal(s.routinesPlanned, 7);
  assert.equal(s.routinesDone, 2);
  assert.equal(s.gymDays, 1);
  assert.equal(s.gymVolume, 500);
  assert.equal(s.chineseMinutes, 20);
  assert.deepEqual(s.bestStreaks, [{ name: 'Water', streak: 2 }]);
});

test('backups round-trip and reject other text', () => {
  const data = { groceries: [], gym: { sessions: [], logs: [] }, chinese: { target: 15, words: [], logs: [] }, routines: [daily()], journal: {}, inbox: [] };
  assert.deepEqual(parseBackup(makeBackup(data)), data);
  assert.throws(() => parseBackup('hello'), /doesn't look like/);
  assert.throws(() => parseBackup('{"app":"routine"}'), /missing/);
});

test('the shared grocery list is grouped by aisle', () => {
  const item = (name: string, aisle?: string, quantity?: string) => ({ id: name, name, aisle, quantity, repeat: { kind: 'once' as const }, createdAt: '2026-10-30' });
  assert.equal(
    groceryListText([item('Milk', 'Dairy', '1 L'), item('Bread'), item('Eggs', 'Dairy')]),
    'Shopping list\n\nDairy\n☐ Eggs\n☐ Milk (1 L)\n\nOther\n☐ Bread',
  );
});
