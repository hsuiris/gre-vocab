// scripts/parse-wordlist.test.js
const test = require('node:test');
const assert = require('node:assert');
const { parseCandidates } = require('./parse-wordlist');

test('extracts headword and raw line', () => {
  const input = 'abate 减少 bate 减少 rebate 打折\n';
  const result = parseCandidates(input);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].word, 'abate');
  assert.strictEqual(result[0].rawLine, 'abate 减少 bate 减少 rebate 打折');
});

test('skips junk lines (headers, emails, page numbers)', () => {
  const input = 'Wordlist 1\nhandout-author@example.com\n123\nIntroduction and Suggestions\n';
  const result = parseCandidates(input);
  assert.strictEqual(result.length, 0);
});

test('dedupes repeated headwords, keeps first occurrence raw line', () => {
  const input = 'abide 忍受，遵守（助记）离开爱的要忍耐\nabide sth 于事，坚持（重複出現的行）\n';
  const result = parseCandidates(input);
  const abideEntries = result.filter((r) => r.word === 'abide');
  assert.strictEqual(abideEntries.length, 1);
  assert.strictEqual(abideEntries[0].rawLine, 'abide 忍受，遵守（助记）离开爱的要忍耐');
});

test('a line starting with a root fragment (trailing hyphen) yields no candidate', () => {
  // parser only looks at the first token per line；"ac-" 是字根片語不是完整字，
  // 該行被跳過，不會往後找同行其他字（後續字仍會在自己的行首被抓到）
  const input = 'ac- 尖 acid 尖酸的 acute 尖的，敏锐的\n';
  const result = parseCandidates(input);
  assert.strictEqual(result.length, 0);
});
