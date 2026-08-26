// Renders every headword to mp3 with Edge's neural voice, once, so the app
// plays the same correct reading on every device instead of whatever voice the
// user's phone happens to ship.
//
// Usage: node scripts/tts-build.js
// Resumable: files already on disk are skipped, so a killed run just restarts.
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const VOICE = process.env.TTS_VOICE || 'en-US-AvaNeural';
const OUT = path.join(__dirname, '..', 'public', 'audio');
const words = require(path.join(__dirname, '..', 'assets', 'words.json'));

// Both are keyed by the headword, so the app can find a sentence without
// carrying its text around: examples live one folder down under the same name.
const jobs = [
  ...words.map(({ word }) => ({ text: word, file: path.join(OUT, `${word}.mp3`) })),
  ...words
    .filter(({ example }) => example && example.trim())
    .map(({ word, example }) => ({ text: example, file: path.join(OUT, 'ex', `${word}.mp3`) })),
];

function render(word, file) {
  return new Promise((resolve, reject) => {
    execFile(
      'edge-tts',
      ['--voice', VOICE, '--text', word, '--write-media', file],
      { timeout: 30000 },
      (error) => (error ? reject(error) : resolve())
    );
  });
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'ex'), { recursive: true });
  // A truncated file from a killed run would be skipped as "done" and play as
  // a click, so anything suspiciously small is treated as missing.
  const pending = jobs.filter(({ file }) => !fs.existsSync(file) || fs.statSync(file).size < 1000);
  console.log(`共 ${jobs.length} 段，要錄 ${pending.length} 段（其餘已存在）`);

  let next = 0;
  let done = 0;
  const failed = [];

  async function worker() {
    while (next < pending.length) {
      const { text, file } = pending[next++];
      try {
        await render(text, file);
        if (fs.statSync(file).size < 1000) throw new Error('檔案太小');
      } catch (first) {
        // One retry: the endpoint drops a connection now and then, and losing a
        // word to a blip would leave a silent card in the app.
        try {
          await render(text, file);
        } catch (error) {
          failed.push(text);
          try { fs.unlinkSync(file); } catch {}
        }
      }
      if (++done % 200 === 0) console.log(`  ${done}/${pending.length}`);
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`完成 ${done - failed.length}/${pending.length}，失敗 ${failed.length}`);
  if (failed.length) console.log('失敗的字:', failed.join(', '));
}

main();
