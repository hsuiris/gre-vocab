import raw from '../../assets/relations.json';

export type Relation = { syn: string[]; ant: string[] };

// Built offline by scripts/buildRelations.py from WordNet, filtered hard for
// precision: ~27% of words have synonyms and ~15% have antonyms, so every
// caller must cope with a miss.
const relations = raw as Record<string, Relation>;
const none: Relation = { syn: [], ant: [] };

export function getRelation(word: string): Relation {
  return relations[word] ?? none;
}
