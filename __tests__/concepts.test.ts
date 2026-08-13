import { words } from '../src/data/words';
import { concepts, conceptsOf, bandOf } from '../src/data/concepts';

describe('concepts', () => {
  const onList = new Set(words.map((w) => w.word.toLowerCase()));

  it('returns nothing for a word that was never placed', () => {
    expect(conceptsOf('zzzz-not-a-word')).toEqual([]);
  });

  it('finds a word from either case', () => {
    const sample = concepts[0].words[0].w;
    expect(conceptsOf(sample.toUpperCase()).map((c) => c.id)).toContain(concepts[0].id);
  });

  it('only lists words that are on the study list', () => {
    // The screen shows a Chinese gloss beside every word, and the gloss comes
    // from words.json. Anything else renders as a bare English word.
    for (const concept of concepts) {
      for (const { w } of concept.words) {
        expect(onList.has(w.toLowerCase())).toBe(true);
      }
    }
  });

  it('pairs every opposite in both directions', () => {
    const byId = new Map(concepts.map((c) => [c.id, c]));
    for (const concept of concepts) {
      if (!concept.opposite) continue;
      expect(byId.get(concept.opposite)?.opposite).toBe(concept.id);
    }
  });

  it('sorts each concept strongest first', () => {
    for (const concept of concepts) {
      const levels = concept.words.map((x) => x.lv);
      expect(levels).toEqual([...levels].sort((a, b) => b - a));
    }
  });

  it('never puts a word in more than two concepts', () => {
    for (const { word } of words) {
      expect(conceptsOf(word).length).toBeLessThanOrEqual(2);
    }
  });

  it('splits five levels into three bands', () => {
    expect([1, 2, 3, 4, 5].map(bandOf)).toEqual(['weak', 'weak', 'mid', 'strong', 'strong']);
  });

  it('covers a useful slice of the list', () => {
    const covered = words.filter(({ word }) => conceptsOf(word).length).length;
    expect(covered / words.length).toBeGreaterThan(0.5);
  });
});
