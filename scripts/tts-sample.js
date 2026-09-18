// Listens before it commits: renders a handful of the words system TTS is known
// to fumble, once per candidate voice, so the mp3s can be compared by ear
// before anyone pays to render all 3192.
//
// Usage: SILICONFLOW_API_KEY=sk-... node scripts/tts-sample.js
const fs = require('fs');
const path = require('path');

const KEY = process.env.SILICONFLOW_API_KEY;
const BASE = process.env.SILICONFLOW_BASE || 'https://api.siliconflow.com/v1';

// The traps: stress in the wrong place (epitome, desultory), silent letters
// (indict, subtle), and loanwords the compact voices spell out (facade, melee).
// If a voice gets these right it will get the easy 3000 right too.
const WORDS = [
  'epitome', 'desultory', 'hyperbole', 'awry', 'quixotic', 'chicanery',
  'indict', 'subtle', 'facade', 'melee', 'denouement', 'bourgeois',
];

// One sentence too: a word can sound fine alone and still run its clauses
// together in prose, which is the other half of "robotic".
const SENTENCES = [
  'Fearing the ship would sink, the crew was ordered to abandon it immediately.',
];

const VOICES = [
  { model: 'FunAudioLLM/CosyVoice2-0.5B', voice: 'FunAudioLLM/CosyVoice2-0.5B:anna' },
  { model: 'fishaudio/fish-speech-1.5', voice: 'fishaudio/fish-speech-1.5:anna' },
];

async function render(text, { model, voice }) {
  const res = await fetch(`${BASE}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, voice, input: text, response_format: 'mp3', speed: 1 }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  // A failed call can still arrive as 200 with a JSON error body. Saving that
  // as .mp3 gives a file that looks fine in Finder and plays silence, so check
  // the bytes are actually audio before claiming success.
  const isMp3 = audio.length > 1000 && (audio.subarray(0, 3).toString() === 'ID3' || audio[0] === 0xff);
  if (!isMp3) throw new Error(`not audio: ${audio.subarray(0, 120).toString()}`);
  return audio;
}

async function main() {
  if (!KEY) {
    console.error('缺少 API key。請跑： SILICONFLOW_API_KEY=你的key node scripts/tts-sample.js');
    process.exit(1);
  }
  const items = [...WORDS, ...SENTENCES];
  for (const { model, voice } of VOICES) {
    const dir = path.join(__dirname, '..', 'tts-sample', model.split('/')[1]);
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, text] of items.entries()) {
      const name = `${String(i + 1).padStart(2, '0')}-${text.split(' ')[0].replace(/[^a-z]/gi, '')}.mp3`;
      try {
        fs.writeFileSync(path.join(dir, name), await render(text, { model, voice }));
        console.log(`ok  ${model.split('/')[1]}/${name}`);
      } catch (error) {
        console.warn(`失敗 ${model.split('/')[1]}/${name}: ${error.message}`);
      }
    }
  }
  console.log('\n聽這裡： open tts-sample');
}

main();
