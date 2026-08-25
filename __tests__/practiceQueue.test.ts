import { WordEntry } from '../src/data/words';
import { buildPracticeQueue } from '../src/lib/practiceQueue';

const pool: WordEntry[] = [
  { word: 'rancor', pos: 'n.', meaning: '怨恨', example: '', roots: '' },
  { word: 'gregarious', pos: 'adj.', meaning: '合群的', example: '', roots: '' },
  { word: 'abate', pos: 'v.', meaning: '減輕', example: '', roots: '' },
  { word: 'garrulous', pos: 'adj.', meaning: '多話的', example: '', roots: '' },
];

test('filters due words by selected starting letters', () => {
  const queue = buildPracticeQueue(pool, {}, [], '2026-07-19', { letters: ['r', 'g'] });
  expect(queue.map((w) => w.word)).toEqual(['garrulous', 'gregarious', 'rancor']);
});

test('skips excluded and not-yet-due words', () => {
  const queue = buildPracticeQueue(
    pool,
    { rancor: { box: 2, nextReviewDate: '2026-07-20' } },
    ['gregarious'],
    '2026-07-19',
    { letters: ['g', 'r'] }
  );
  expect(queue.map((w) => w.word)).toEqual(['garrulous']);
});

test('can shuffle with injected randomness', () => {
  const queue = buildPracticeQueue(pool, {}, [], '2026-07-19', { order: 'shuffle' }, () => 0);
  expect(queue.map((w) => w.word)).toEqual(['garrulous', 'gregarious', 'rancor', 'abate']);
});

test('wrong-only queue ignores due dates but keeps letter filters', () => {
  const queue = buildPracticeQueue(
    pool,
    { rancor: { box: 2, nextReviewDate: '2026-07-20' } },
    [],
    '2026-07-19',
    { letters: ['r'], wrongWords: ['rancor', 'gregarious'] }
  );
  expect(queue.map((w) => w.word)).toEqual(['rancor']);
});

test('limit caps the queue, and shuffles before cutting', () => {
  const capped = buildPracticeQueue(pool, {}, [], '2026-07-19', { limit: 2 });
  expect(capped.map((w) => w.word)).toEqual(['abate', 'garrulous']);

  const shuffled = buildPracticeQueue(pool, {}, [], '2026-07-19', { order: 'shuffle', limit: 2 }, () => 0);
  expect(shuffled.map((w) => w.word)).toEqual(['garrulous', 'gregarious']);
});
