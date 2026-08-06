import raw from '../../assets/words.json';

export type WordEntry = {
  word: string;
  pos: string;
  meaning: string;
  example: string;
  exampleZh?: string;
  roots: string;
};

export const words: WordEntry[] = raw as WordEntry[];
