import { buildChoices } from '../src/lib/quiz';
import { WordEntry } from '../src/data/words';

const pool: WordEntry[] = [
  { word: 'abate', pos: 'v.', meaning: '減輕', example: 'The storm abated.', roots: 'a- + batter' },
  { word: 'brevity', pos: 'n.', meaning: '簡潔', example: 'Brevity is the soul of wit.', roots: 'brev = short' },
  { word: 'candor', pos: 'n.', meaning: '坦率', example: 'She spoke with candor.', roots: 'cand = white' },
  { word: 'deft', pos: 'adj.', meaning: '靈巧的', example: 'A deft touch.', roots: '' },
  { word: 'eloquent', pos: 'adj.', meaning: '雄辯的', example: 'An eloquent speaker.', roots: 'loqu = speak' },
  { word: 'furtive', pos: 'adj.', meaning: '偷偷摸摸的', example: 'A furtive glance.', roots: 'furt = theft' },
];

const entry = pool[0]; // abate / 減輕

test('returns exactly 4 strings', () => {
  const choices = buildChoices(entry, 'en-zh', pool);
  expect(choices).toHaveLength(4);
});

test('contains the correct answer for en-zh direction', () => {
  const choices = buildChoices(entry, 'en-zh', pool);
  expect(choices).toContain(entry.meaning);
});

test('contains the correct answer for zh-en direction', () => {
  const choices = buildChoices(entry, 'zh-en', pool);
  expect(choices).toContain(entry.word);
});

test('all 4 values are unique (no duplicates)', () => {
  for (let i = 0; i < 20; i++) {
    const choices = buildChoices(entry, 'en-zh', pool);
    expect(new Set(choices).size).toBe(4);
  }
});

test('works repeatedly for both directions with the same pool, invariants hold', () => {
  for (let i = 0; i < 20; i++) {
    const enZh = buildChoices(entry, 'en-zh', pool);
    expect(enZh).toHaveLength(4);
    expect(new Set(enZh).size).toBe(4);
    expect(enZh).toContain(entry.meaning);

    const zhEn = buildChoices(entry, 'zh-en', pool);
    expect(zhEn).toHaveLength(4);
    expect(new Set(zhEn).size).toBe(4);
    expect(zhEn).toContain(entry.word);
  }
});

test('distractors never include the entry itself as a distractor value duplicate', () => {
  // entry.meaning is '減輕'; ensure none of the other pool entries share this meaning,
  // and the returned choices' non-correct members all come from other entries' fields.
  const choices = buildChoices(entry, 'en-zh', pool);
  const otherMeanings = pool.slice(1).map((w) => w.meaning);
  const distractors = choices.filter((c) => c !== entry.meaning);
  expect(distractors.length).toBe(3);
  for (const d of distractors) {
    expect(otherMeanings).toContain(d);
  }
});
