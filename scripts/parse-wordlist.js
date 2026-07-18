// scripts/parse-wordlist.js
const fs = require('fs');

const SKIP_PATTERNS = [
  /@/,
  /^wordlist\b/i,
  /^\d+$/,
  /handout-author/i,
  /^introduction and suggestions/i,
  /^gre\s*词汇/i,
];

function parseCandidates(text) {
  const lines = text.split('\n');
  const seen = new Map();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP_PATTERNS.some((p) => p.test(line))) continue;

    const match = line.match(/^([a-zA-Z][a-zA-Z-]{1,25})\s+(.+)/);
    if (!match) continue;

    const word = match[1].toLowerCase();
    if (word.length < 3 || word.endsWith('-')) continue;

    if (!seen.has(word)) {
      seen.set(word, line);
    }
  }
  return Array.from(seen.entries()).map(([word, rawLine]) => ({ word, rawLine }));
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  const text = fs.readFileSync(inputPath, 'utf8');
  const candidates = parseCandidates(text);
  fs.writeFileSync(outputPath, JSON.stringify(candidates, null, 2));
  console.log(`Extracted ${candidates.length} candidates -> ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { parseCandidates };
