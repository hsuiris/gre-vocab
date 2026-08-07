"""Generate assets/relations.json (synonyms + antonyms) from WordNet.

One-off script. Run it again only when assets/words.json changes.

    python3 -m venv .venv && .venv/bin/pip install nltk
    .venv/bin/python -m nltk.downloader wordnet
    .venv/bin/python scripts/buildRelations.py

Output shape: { "abandon": { "syn": ["forsake", ...], "ant": ["keep", ...] }, ... }
Words with no relations are omitted, so the app must handle a miss.

Precision over coverage. Raw WordNet synsets lump every sense of a word
together -- it will happily tell you "abject" means "low" -- so a synonym is
kept only when it survives two filters: the candidate is itself on the GRE
list, and the two Chinese glosses overlap. That drops coverage from 86% to
~27% and removes essentially all of the wrong pairs.
"""

import json
import os

from nltk.corpus import wordnet as wn

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORDS = os.path.join(ROOT, "assets", "words.json")
OUT = os.path.join(ROOT, "assets", "relations.json")

POS_MAP = {"n": wn.NOUN, "v": wn.VERB, "adj": wn.ADJ, "adv": wn.ADV}
MAX_SYN = 6
MAX_ANT = 4
# Filler that appears in almost every gloss and would match anything.
FILLER = set("的地使人物事、；，（）()")


def wordnet_pos(pos_field):
    """'v./n.' -> [wn.VERB, wn.NOUN]. Unknown tags mean "search every pos"."""
    tags = [p.strip().rstrip(".") for p in pos_field.split("/")]
    mapped = [POS_MAP[t] for t in tags if t in POS_MAP]
    return mapped or [wn.NOUN, wn.VERB, wn.ADJ, wn.ADV]


def bigrams(meaning):
    chars = "".join(c for c in meaning if c not in FILLER and not c.isascii())
    return {chars[i : i + 2] for i in range(len(chars) - 1)}


def candidates(word, pos_field):
    """Every WordNet lemma sharing a synset with `word`, plus its antonyms."""
    syn, ant = [], []
    for pos in wordnet_pos(pos_field):
        for synset in wn.synsets(word, pos=pos):
            for lemma in synset.lemmas():
                name = lemma.name().replace("_", " ")
                if name.lower() != word.lower():
                    syn.append(name)
                for opposite in lemma.antonyms():
                    # Antonyms come from explicit lemma links, which are far more
                    # reliable than synset membership, so they skip the gloss
                    # filter -- they are just rare (~15% of the list has one).
                    ant.append(opposite.name().replace("_", " "))
                    for sibling in opposite.synset().lemmas():
                        ant.append(sibling.name().replace("_", " "))
    # ponytail: no antonym-of-a-synonym hop. It lifts coverage 15% -> 45% and
    # produces "ephemeral is the opposite of failing" -- wrong data teaches
    # wrong words. The app shows 「尚無反義詞」 instead.
    return syn, ant


def dedupe(names, limit):
    seen, ordered = set(), []
    for name in names:
        key = name.lower()
        if key not in seen:
            seen.add(key)
            ordered.append(name)
    ordered.sort(key=lambda n: " " in n)  # single words read better on a chip
    return ordered[:limit]


def main():
    with open(WORDS, encoding="utf-8") as f:
        words = json.load(f)
    gloss = {w["word"].lower(): w["meaning"] for w in words}
    gloss_bigrams = {k: bigrams(v) for k, v in gloss.items()}

    relations = {}
    for entry in words:
        raw_syn, raw_ant = candidates(entry["word"], entry["pos"])
        mine = bigrams(entry["meaning"])
        syn = [
            name
            for name in raw_syn
            if name.lower() in gloss and gloss_bigrams[name.lower()] & mine
        ]
        syn, ant = dedupe(syn, MAX_SYN), dedupe(raw_ant, MAX_ANT)
        if syn or ant:
            relations[entry["word"]] = {"syn": syn, "ant": ant}

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(relations, f, ensure_ascii=False, separators=(",", ":"))

    have_syn = sum(1 for r in relations.values() if r["syn"])
    have_ant = sum(1 for r in relations.values() if r["ant"])
    total = len(words)
    print(f"words: {total}")
    print(f"with synonyms: {have_syn} ({have_syn / total:.0%})")
    print(f"with antonyms: {have_ant} ({have_ant / total:.0%})")
    print(f"wrote {OUT} ({os.path.getsize(OUT) / 1024:.0f} kB)")


if __name__ == "__main__":
    main()
