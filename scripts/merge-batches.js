// scripts/merge-batches.js
const fs = require('fs');
const path = require('path');
const { validateWords } = require('./validate-words');

function mergeBatches(batchDir) {
  const files = fs.readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort();
  const merged = [];
  for (const file of files) {
    const batch = JSON.parse(fs.readFileSync(path.join(batchDir, file), 'utf8'));
    merged.push(...batch);
  }
  return merged;
}

function main() {
  const batchDir = process.argv[2] || 'data/words';
  const outputPath = process.argv[3] || 'assets/words.json';
  const merged = mergeBatches(batchDir);
  const errors = validateWords(merged);
  if (errors.length) {
    console.error(`${errors.length} error(s) found across merged batches:`);
    errors.forEach((e) => console.error(' -', e));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2));
  console.log(`Merged ${merged.length} words -> ${outputPath}`);
}

if (require.main === module) {
  main();
}

module.exports = { mergeBatches };
