import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceChapter, completeChapter, freshProgress, matchOrder, readProgress, rhythmWindow, validMix } from '../src/state.ts';

test('locked doors cannot advance; seven friends are visited once in a complete run', () => {
  let p = freshProgress();
  assert.equal(advanceChapter(p), p);
  for (let chapter = 0; chapter < 8; chapter++) {
    assert.equal(p.chapter, chapter);
    p.talked = true; p.clueRead = true; p.collected = ['test'];
    p = completeChapter(p); p = completeChapter(p);
    assert.equal(p.visited.length, chapter);
    const saved = readProgress(JSON.stringify(p)); assert.deepEqual(saved, p);
    const next = advanceChapter(p);
    if (chapter < 7) { assert.equal(next.done, false); assert.equal(next.talked, false); assert.equal(next.clueRead, false); assert.deepEqual(next.collected, []); }
    else assert.equal(next, p);
    p = next;
  }
  assert.deepEqual(p.visited, [1, 2, 3, 4, 5, 6, 7]);
});
test('corrupt saves fail safely and valid studio progress survives refresh', () => {
  for (const raw of [null, '', '{}', '{oops', 'null', JSON.stringify({ ...freshProgress(), chapter: 99 }), JSON.stringify({ ...freshProgress(), seconds: -1 }), JSON.stringify({ ...freshProgress(), collected: [4] })]) assert.equal(readProgress(raw), null);
  const p = { ...freshProgress(), chapter: 7, recorded: true, talked: true, seconds: 120 };
  assert.deepEqual(readProgress(JSON.stringify(p)), p);
});
test('puzzles reject partial and incorrect orders', () => {
  assert.equal(matchOrder(['吐司', '蜂蜜'], ['吐司', '蜂蜜', '香蕉']), false);
  assert.equal(matchOrder([0, 2, 1], [2, 0, 1]), false);
  assert.equal(matchOrder([2, 0, 1], [2, 0, 1]), true);
});
test('mix tolerance boundaries and rhythm assistance work', () => {
  assert.equal(validMix([57, 48, 55], [65, 40, 55]), true);
  assert.equal(validMix([56, 40, 55], [65, 40, 55]), false);
  assert.equal(validMix([NaN, 40, 55], [65, 40, 55]), false);
  assert.equal(validMix([65, 40], [65, 40, 55]), false);
  assert.ok(rhythmWindow(2) > rhythmWindow(0)); assert.equal(rhythmWindow(100), .38);
});
