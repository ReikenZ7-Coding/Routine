import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOODS, moodOf, setEntry } from '../src/lib/journal.ts';

test('moods run worst to best, each with a label and a mouth curve, and no emoji', () => {
  assert.deepEqual(
    MOODS.map((m) => m.value),
    [1, 2, 3, 4, 5],
  );
  for (const m of MOODS) {
    assert.equal(typeof m.label, 'string');
    assert.ok(m.curve >= -6 && m.curve <= 6);
    assert.equal(Object.keys(m).sort().join(','), 'curve,label,value');
  }
  assert.ok(MOODS[0].curve < MOODS[2].curve && MOODS[2].curve < MOODS[4].curve);
});

test('saved moods keep reading back, including older text values', () => {
  assert.equal(moodOf(4), 4);
  assert.equal(moodOf('2'), 2);
  assert.equal(moodOf(undefined), undefined);
  assert.equal(moodOf(0), undefined);
  assert.equal(moodOf(9), undefined);
  assert.equal(moodOf('😊'), undefined);
  const j = setEntry({}, '2026-11-01', { mood: 5 });
  assert.equal(moodOf(j['2026-11-01'].mood), 5);
});
