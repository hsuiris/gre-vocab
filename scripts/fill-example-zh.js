const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'assets', 'words.json');
const words = JSON.parse(fs.readFileSync(file, 'utf8'));

async function translate(text) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`translate failed: ${res.status}`);
    const json = await res.json();
    return json[0].map((part) => part[0]).join('');
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const pending = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !word.exampleZh && word.example);
  let next = 0;
  let changed = 0;
  let failed = 0;

  async function worker() {
    while (next < pending.length) {
      const item = pending[next++];
      try {
        words[item.index].exampleZh = await translate(item.word.example);
        changed++;
        if (changed % 100 === 0) console.log(`translated ${changed}/${pending.length}`);
      } catch (error) {
        failed++;
        console.warn(`skip ${item.word.word}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 8 }, worker));
  fs.writeFileSync(file, `${JSON.stringify(words, null, 2)}\n`);
  console.log(`done: ${changed} added, ${failed} failed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
