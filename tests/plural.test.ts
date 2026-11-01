import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plural } from '../src/lib/plural.ts';

test('plural counts a noun in the right number', () => {
  assert.equal(plural(1, 'word'), '1 word');
  assert.equal(plural(2, 'word'), '2 words');
  assert.equal(plural(0, 'word'), '0 words');
  assert.equal(plural(1, 'exercise'), '1 exercise');
  assert.equal(plural(4, 'exercise'), '4 exercises');
  assert.equal(plural(3, 'box', 'boxes'), '3 boxes');
});
