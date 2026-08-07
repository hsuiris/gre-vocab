import { words } from '../src/data/words';
import { getRelation } from '../src/data/relations';

describe('getRelation', () => {
  it('returns empty lists for a word WordNet had nothing for', () => {
    expect(getRelation('zzzz-not-a-word')).toEqual({ syn: [], ant: [] });
  });

  it('never lists a word as its own synonym or antonym', () => {
    for (const { word } of words) {
      const { syn, ant } = getRelation(word);
      const self = word.toLowerCase();
      expect(syn.map((w) => w.toLowerCase())).not.toContain(self);
      expect(ant.map((w) => w.toLowerCase())).not.toContain(self);
    }
  });

  it('only offers synonyms that are themselves on the study list', () => {
    // The precision filter in scripts/buildRelations.py exists because raw
    // WordNet claims "abject" means "low". If this ever fails, that filter
    // was dropped and the data is back to being wrong.
    const onList = new Set(words.map((w) => w.word.toLowerCase()));
    for (const { word } of words) {
      for (const syn of getRelation(word).syn) {
        expect(onList.has(syn.toLowerCase())).toBe(true);
      }
    }
  });

  it('still covers a useful slice of the list', () => {
    const covered = words.filter(({ word }) => getRelation(word).syn.length).length;
    expect(covered / words.length).toBeGreaterThan(0.2);
  });
});
