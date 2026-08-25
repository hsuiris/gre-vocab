// words.json stores parts of speech as "v." or "n./adj."; spell them out so the
// grammar hint reads as Chinese rather than dictionary shorthand.
const POS_ZH: Record<string, string> = {
  'n.': '名詞',
  'v.': '動詞',
  'adj.': '形容詞',
  'adv.': '副詞',
  'conj.': '連接詞',
};

export function posLabel(pos: string): string {
  return pos
    .split('/')
    .map((p) => POS_ZH[p.trim()] ?? p.trim())
    .join('／');
}
