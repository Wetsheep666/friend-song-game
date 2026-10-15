import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceChapter, completeChapter, freshProgress, matchOrder, readProgress, rhythmWindow, validMix, purchaseErrand, canDeliverErrand, ERRAND_ITEM } from '../src/state.ts';

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

test('park errand requires conversation, purchase and returning to the friend', () => {
  let p = { ...freshProgress(), chapter: 1 };
  assert.equal(purchaseErrand(p), p);
  assert.equal(canDeliverErrand(p), false);
  p.talked = true;
  assert.equal(canDeliverErrand(p), false);
  p = purchaseErrand(p);
  assert.deepEqual(p.collected, [ERRAND_ITEM]);
  assert.equal(p.done, false);
  assert.equal(advanceChapter(p), p);
  assert.equal(purchaseErrand(p), p);
  p = readProgress(JSON.stringify(p))!;
  assert.equal(canDeliverErrand(p), true);
  p = completeChapter(p);
  assert.equal(canDeliverErrand(p), false);
  assert.equal(purchaseErrand(p), p);
  assert.equal(advanceChapter(p).chapter, 2);
  assert.equal(purchaseErrand(freshProgress()).collected.length, 0);
});

test('old first-stop items cannot satisfy the new delivery', () => {
  const p = { ...freshProgress(), chapter: 1, talked: true, collected: ['headphones', 'ticket', 'usb'] };
  assert.equal(canDeliverErrand(p), false);
  assert.equal(canDeliverErrand(purchaseErrand(p)), true);
});
