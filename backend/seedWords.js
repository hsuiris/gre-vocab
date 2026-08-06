const words = require('../assets/words.json');
const { exec, q } = require('./db');
const { id, now } = require('./auth');

let sql = 'BEGIN;\n';
for (const item of words) {
  sql += `INSERT INTO words (id, word, pos, meaning, example, example_zh, roots, created_at, updated_at)
          VALUES (${q(id('word'))}, ${q(item.word)}, ${q(item.pos || '')}, ${q(item.meaning)}, ${q(item.example || '')}, ${q(item.exampleZh || '')}, ${q(item.roots || '')}, ${q(now())}, ${q(now())})
          ON CONFLICT(word) DO UPDATE SET
            pos = excluded.pos,
            meaning = excluded.meaning,
            example = excluded.example,
            example_zh = excluded.example_zh,
            roots = excluded.roots,
            updated_at = excluded.updated_at;\n`;
}
sql += 'COMMIT;';
exec(sql);
console.log(`seeded ${words.length} words`);
