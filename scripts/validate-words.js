// scripts/validate-words.js
const fs = require('fs');

const REQUIRED_FIELDS = ['word', 'pos', 'meaning', 'example', 'roots'];
const WORD_PATTERN = /^[a-z][a-z-]*$/;

function containsWordStem(example, word) {
  const stem = word.slice(0, Math.max(4, word.length - 3)).toLowerCase();
  return example.toLowerCase().includes(stem);
}

function validateWords(entries) {
  const errors = [];
  const seen = new Set();

  entries.forEach((entry, i) => {
    for (const field of REQUIRED_FIELDS) {
      if (!entry[field] || typeof entry[field] !== 'string' || !entry[field].trim()) {
        errors.push(`[${i}] missing or empty field "${field}"`);
      }
    }

    if (entry.word && !WORD_PATTERN.test(entry.word)) {
      errors.push(`[${i}] invalid word format: "${entry.word}"`);
    }

    if (entry.word) {
      if (seen.has(entry.word)) {
        errors.push(`[${i}] duplicate word: "${entry.word}"`);
      }
      seen.add(entry.word);
    }

    if (entry.word && entry.example && !containsWordStem(entry.example, entry.word)) {
      errors.push(`[${i}] example does not contain the word "${entry.word}"`);
    }
  });

  return errors;
}

function main() {
  const filePath = process.argv[2];
  const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const errors = validateWords(entries);
  if (errors.length) {
    console.error(`${errors.length} error(s) in ${filePath}:`);
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  console.log(`${filePath}: ${entries.length} entries OK`);
}

if (require.main === module) {
  main();
}

module.exports = { validateWords, containsWordStem };
