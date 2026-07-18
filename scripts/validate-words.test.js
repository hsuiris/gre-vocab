// scripts/validate-words.test.js
const test = require('node:test');
const assert = require('node:assert');
const { validateWords } = require('./validate-words');

test('valid entry passes with no errors', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: '減輕、緩和', example: 'The storm began to abate.', roots: 'a- (加強) + bate (打擊)' },
  ]);
  assert.strictEqual(errors.length, 0);
});

test('catches missing/empty field', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: '', example: 'x abate y', roots: 'r' },
  ]);
  assert.ok(errors.some((e) => e.includes('meaning')));
});

test('catches invalid word format', () => {
  const errors = validateWords([
    { word: 'Abate!', pos: 'v.', meaning: 'm', example: 'abate here', roots: 'r' },
  ]);
  assert.ok(errors.some((e) => e.includes('invalid word format')));
});

test('catches duplicate word across entries', () => {
  const entries = [
    { word: 'abate', pos: 'v.', meaning: 'm', example: 'abate here', roots: 'r' },
    { word: 'abate', pos: 'v.', meaning: 'm2', example: 'abate again', roots: 'r2' },
  ];
  const errors = validateWords(entries);
  assert.ok(errors.some((e) => e.includes('duplicate')));
});

test('catches example that does not use the word (even inflected)', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: 'm', example: 'The storm calmed down.', roots: 'r' },
  ]);
  assert.ok(errors.some((e) => e.includes('does not contain')));
});

test('accepts example using an inflected form of the word', () => {
  const errors = validateWords([
    { word: 'abate', pos: 'v.', meaning: 'm', example: 'The noise was abating slowly.', roots: 'r' },
  ]);
  assert.strictEqual(errors.length, 0);
});
