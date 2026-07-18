import { WordEntry } from '../data/words';

// Builds 4 shuffled multiple-choice options (1 correct + 3 distractors) for a
// word entry. The distractors come from other entries in `pool` so wrong
// options are always plausible real dictionary values, never made up.
export function buildChoices(
  entry: WordEntry,
  direction: 'en-zh' | 'zh-en',
  pool: WordEntry[]
): string[] {
  const answerOf = (w: WordEntry) => (direction === 'en-zh' ? w.meaning : w.word);
  const correct = answerOf(entry);

  const candidates = pool.filter((w) => w.word !== entry.word);
  const shuffledCandidates = [...candidates].sort(() => Math.random() - 0.5);

  const distractors: string[] = [];
  for (const w of shuffledCandidates) {
    const value = answerOf(w);
    if (value !== correct && !distractors.includes(value)) {
      distractors.push(value);
    }
    if (distractors.length === 3) break;
  }

  return [correct, ...distractors].sort(() => Math.random() - 0.5);
}
