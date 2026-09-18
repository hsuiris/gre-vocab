import raw from '../../assets/concepts.json';

export type ConceptWord = { w: string; lv: number };
export type Concept = { id: string; zh: string; opposite: string | null; words: ConceptWord[] };

// Built offline by batching every gloss in assets/words.json through Claude:
// one pass to agree on the bucket names, a second to place each word and score
// how strong it is. scripts/validate-concepts.js pins the shape.
export const concepts = raw as Concept[];

// A word sits in at most two concepts, so the reverse index stays small enough
// to build once at import rather than being searched for on every keystroke.
const byWord = new Map<string, Concept[]>();
for (const concept of concepts) {
  for (const { w } of concept.words) {
    const key = w.toLowerCase();
    const list = byWord.get(key);
    if (list) list.push(concept);
    else byWord.set(key, [concept]);
  }
}

const none: Concept[] = [];

export function conceptsOf(word: string): Concept[] {
  return byWord.get(word.toLowerCase()) ?? none;
}

// Levels are stored 1-5 because that is the granularity the model can actually
// judge, but three bands is what a card can show without turning into a table.
export type Band = 'strong' | 'mid' | 'weak';

export const BAND_LABEL: Record<Band, string> = {
  strong: '強',
  mid: '中',
  weak: '弱',
};

export function bandOf(lv: number): Band {
  if (lv >= 4) return 'strong';
  if (lv === 3) return 'mid';
  return 'weak';
}
