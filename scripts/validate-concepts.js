// scripts/validate-concepts.js
const fs = require('fs');

const ID_PATTERN = /^[a-z][a-z-]*$/;
const MIN_WORDS = 3;
const MAX_CONCEPTS_PER_WORD = 2;

function validateConcepts(concepts, knownWords) {
  const errors = [];
  const byId = new Map();
  const conceptsPerWord = new Map();

  concepts.forEach((c, i) => {
    if (!c.id || !ID_PATTERN.test(c.id)) errors.push(`[${i}] invalid id: "${c.id}"`);
    if (!c.zh || !c.zh.trim()) errors.push(`[${i}] missing zh for "${c.id}"`);
    if (byId.has(c.id)) errors.push(`[${i}] duplicate id: "${c.id}"`);
    byId.set(c.id, c);

    if (!Array.isArray(c.words) || c.words.length < MIN_WORDS) {
      errors.push(`[${i}] "${c.id}" has ${c.words?.length ?? 0} words, needs ${MIN_WORDS}`);
      return;
    }

    const seen = new Set();
    c.words.forEach(({ w, lv }) => {
      if (!knownWords.has(String(w).toLowerCase())) {
        errors.push(`[${i}] "${c.id}" lists "${w}", which is not in words.json`);
      }
      if (!Number.isInteger(lv) || lv < 1 || lv > 5) {
        errors.push(`[${i}] "${c.id}" gives "${w}" level ${lv}, must be an integer 1-5`);
      }
      if (seen.has(w)) errors.push(`[${i}] "${c.id}" lists "${w}" twice`);
      seen.add(w);
      conceptsPerWord.set(w, (conceptsPerWord.get(w) ?? 0) + 1);
    });

    // A card sorted by strength reads as a ladder, so an unsorted group is a
    // data bug rather than something the screen should paper over.
    const levels = c.words.map((x) => x.lv);
    if (levels.some((lv, n) => n > 0 && lv > levels[n - 1])) {
      errors.push(`[${i}] "${c.id}" words are not sorted by level, strongest first`);
    }
  });

  // Opposites are checked after every id is known, so a forward reference to a
  // concept later in the file is not mistaken for a missing one.
  for (const c of concepts) {
    if (c.opposite == null) continue;
    const other = byId.get(c.opposite);
    if (!other) {
      errors.push(`"${c.id}" points at missing opposite "${c.opposite}"`);
    } else if (other.opposite !== c.id) {
      errors.push(`"${c.id}" ⇄ "${c.opposite}" is one-way; "${c.opposite}" points at "${other.opposite}"`);
    }
  }

  for (const [word, count] of conceptsPerWord) {
    if (count > MAX_CONCEPTS_PER_WORD) {
      errors.push(`"${word}" appears in ${count} concepts, max is ${MAX_CONCEPTS_PER_WORD}`);
    }
  }

  return errors;
}

function main() {
  const [conceptPath, wordPath] = process.argv.slice(2);
  const concepts = JSON.parse(fs.readFileSync(conceptPath, 'utf8'));
  const words = JSON.parse(fs.readFileSync(wordPath, 'utf8'));
  const known = new Set(words.map((w) => w.word.toLowerCase()));

  const errors = validateConcepts(concepts, known);
  if (errors.length) {
    console.error(`${errors.length} error(s) in ${conceptPath}:`);
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  const covered = new Set(concepts.flatMap((c) => c.words.map((x) => x.w)));
  console.log(`${conceptPath}: ${concepts.length} concepts OK, ${covered.size} of ${known.size} words covered`);
}

if (require.main === module) {
  main();
}

module.exports = { validateConcepts };
