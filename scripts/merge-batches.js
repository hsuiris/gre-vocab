// scripts/merge-batches.js
const fs = require('fs');
const path = require('path');
const { validateWords } = require('./validate-words');

function mergeBatches(batchDir) {
  // Guard: check if batch directory exists
  if (!fs.existsSync(batchDir)) {
    console.error(`Batch directory not found: ${batchDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(batchDir).filter((f) => f.endsWith('.json')).sort();
  const merged = [];
  for (const file of files) {
    const filePath = path.join(batchDir, file);
    let batch;
    try {
      batch = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Failed to parse ${file}: ${err.message}`);
      process.exit(1);
    }
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
