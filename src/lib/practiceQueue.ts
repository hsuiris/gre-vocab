import { WordEntry } from '../data/words';
import { WordProgress, isDue } from './leitner';

export type PracticeOrder = 'alphabetical' | 'shuffle';

export type PracticeSettings = {
  order?: PracticeOrder;
  letters?: string[];
  wrongWords?: string[];
  limit?: number;
};

export function buildPracticeQueue(
  allWords: WordEntry[],
  progress: Record<string, WordProgress>,
  excludedWords: string[],
  today: string,
  settings: PracticeSettings = {},
  random = Math.random
): WordEntry[] {
  const excluded = new Set(excludedWords);
  const letters = new Set((settings.letters ?? []).map((l) => l.toLowerCase()));
  const wrong = settings.wrongWords ? new Set(settings.wrongWords) : null;
  const queue = allWords
    .filter((w) => {
      if (excluded.has(w.word)) return false;
      if (wrong && !wrong.has(w.word)) return false;
      if (letters.size > 0 && !letters.has(w.word[0]?.toLowerCase())) return false;
      if (wrong) return true;
      const p = progress[w.word];
      return !p || isDue(p, today);
    })
    .sort((a, b) => a.word.localeCompare(b.word));

  // Shuffle before the cap, so "跳著背 20 個" draws 20 from the whole range
  // rather than the first 20 in the alphabet.
  if (settings.order === 'shuffle') {
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  }
  return settings.limit ? queue.slice(0, settings.limit) : queue;
}
