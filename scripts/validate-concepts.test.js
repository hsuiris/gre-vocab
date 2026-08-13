// scripts/validate-concepts.test.js
const test = require('node:test');
const assert = require('node:assert');
const { validateConcepts } = require('./validate-concepts');

const KNOWN = new Set(['abhor', 'detest', 'loathe', 'dislike', 'adore', 'cherish', 'relish']);

const dislike = {
  id: 'dislike',
  zh: '討厭',
  opposite: 'like',
  words: [
    { w: 'abhor', lv: 5 },
    { w: 'detest', lv: 4 },
    { w: 'dislike', lv: 2 },
  ],
};
const like = {
  id: 'like',
  zh: '喜歡',
  opposite: 'dislike',
  words: [
    { w: 'adore', lv: 5 },
    { w: 'cherish', lv: 4 },
    { w: 'relish', lv: 3 },
  ],
};

test('a matched pair of concepts passes', () => {
  assert.strictEqual(validateConcepts([dislike, like], KNOWN).length, 0);
});

test('catches a word that is not on the study list', () => {
  const bad = { ...dislike, words: [...dislike.words.slice(0, 2), { w: 'hatemonger', lv: 1 }] };
  const errors = validateConcepts([bad, like], KNOWN);
  assert.ok(errors.some((e) => e.includes('not in words.json')));
});

test('catches a level outside 1-5', () => {
  const bad = { ...dislike, words: [{ w: 'abhor', lv: 9 }, ...dislike.words.slice(1)] };
  assert.ok(validateConcepts([bad, like], KNOWN).some((e) => e.includes('must be an integer')));
});

test('catches a one-way opposite', () => {
  const lonely = { ...like, opposite: null };
  assert.ok(validateConcepts([dislike, lonely], KNOWN).some((e) => e.includes('one-way')));
});

test('catches an opposite pointing at a concept that does not exist', () => {
  assert.ok(validateConcepts([dislike], KNOWN).some((e) => e.includes('missing opposite')));
});

test('catches a concept with too few words', () => {
  const thin = { ...dislike, words: dislike.words.slice(0, 2) };
  assert.ok(validateConcepts([thin, like], KNOWN).some((e) => e.includes('needs 3')));
});

test('catches words not sorted strongest first', () => {
  const jumbled = { ...dislike, words: [{ w: 'dislike', lv: 2 }, { w: 'abhor', lv: 5 }, { w: 'detest', lv: 4 }] };
  assert.ok(validateConcepts([jumbled, like], KNOWN).some((e) => e.includes('not sorted')));
});

test('catches a word claimed by three concepts', () => {
  const also = (id, zh) => ({ id, zh, opposite: null, words: [{ w: 'abhor', lv: 3 }, { w: 'loathe', lv: 2 }, { w: 'detest', lv: 1 }] });
  const errors = validateConcepts([dislike, like, also('anger', '生氣'), also('fear', '害怕')], KNOWN);
  assert.ok(errors.some((e) => e.includes('appears in 3 concepts')));
});
