import { createAudioPlayer } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

// macOS ships joke voices — Albert, Bahh, Boing, Bubbles, Zarvox — all tagged
// en-US, and they sort to the very top of the voice list. "First en-US voice"
// therefore hands you a croaking cartoon instead of a reader.
const NOVELTY = new Set([
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'deranged',
  'fred',
  'good news',
  'hysterical',
  'jester',
  'junior',
  'kathy',
  'organ',
  'princess',
  'ralph',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
]);

// The everyday readers, best first. Samantha and Alex are the macOS defaults;
// the rest cover Chrome, Edge and non-US English systems.
const PREFERRED = [
  'samantha',
  'alex',
  'google us english',
  'microsoft aria',
  'microsoft zira',
  'microsoft david',
  'daniel',
  'karen',
  'moira',
  'tessa',
  'fiona',
];

// Systems advertise their neural voices in the name: Edge exposes Azure's
// "(Natural)" set, macOS/iOS expose downloadable "(Enhanced)"/"(Premium)"
// voices and Siri. Those engines model sentence intonation; the compact
// defaults below just concatenate recorded syllables, which is what makes a
// long sentence sound flat. Always take a neural voice when one is installed.
const QUALITY_TIERS = ['natural', 'neural', 'premium', 'enhanced', 'siri'];

export function pickVoice(voices: { identifier: string; name?: string; language?: string }[]) {
  const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en'));
  const usable = english.filter((v) => !NOVELTY.has((v.name ?? '').trim().toLowerCase()));
  const byTier = QUALITY_TIERS.map((tier) =>
    usable.find((v) => (v.name ?? '').toLowerCase().includes(tier))
  ).find(Boolean);
  const byName = PREFERRED.map((wanted) =>
    usable.find((v) => (v.name ?? '').trim().toLowerCase().startsWith(wanted))
  ).find(Boolean);
  return (byTier ?? byName ?? usable[0])?.identifier;
}

// The meanings and the translated examples are Traditional Chinese, so a
// mainland zh-CN voice reads them with the wrong accent and the wrong words.
// Take zh-TW when the device has one, any Chinese otherwise.
export function pickZhVoice(voices: { identifier: string; name?: string; language?: string }[]) {
  const chinese = voices.filter((v) => v.language?.toLowerCase().startsWith('zh'));
  const taiwan = chinese.filter((v) => v.language?.toLowerCase().includes('tw'));
  const usable = taiwan.length > 0 ? taiwan : chinese;
  const byTier = QUALITY_TIERS.map((tier) =>
    usable.find((v) => (v.name ?? '').toLowerCase().includes(tier))
  ).find(Boolean);
  return (byTier ?? usable[0])?.identifier;
}

// On web, `language: 'en-US'` is only a hint — Safari ignores it and reads with
// whatever the system default is, which on a Chinese-locale device mangles
// every English word. Pinning a real voice is what makes the pronunciation
// right.
type Voice = { identifier: string; name?: string; language?: string };

let englishVoice: string | undefined;
let chineseVoice: string | undefined;
let knownVoices: Voice[] = [];

// Asking once is not enough. A mobile browser answers the first call with an
// empty list and fills it in a moment later, so a single lookup at startup
// leaves a phone with no English voice at all — which is exactly how English
// words end up read by a Chinese system voice.
async function refreshVoices(): Promise<Voice[]> {
  const voices = await Speech.getAvailableVoicesAsync().catch(() => [] as Voice[]);
  if (voices.length > 0) {
    knownVoices = voices;
    englishVoice = pickVoice(voices);
    chineseVoice = pickZhVoice(voices);
  }
  return knownVoices;
}

void refreshVoices();

if (Platform.OS === 'web') {
  const synth = (globalThis as { speechSynthesis?: EventTarget }).speechSynthesis;
  // The event browsers fire once the list is ready.
  synth?.addEventListener?.('voiceschanged', () => void refreshVoices());

  // Belt and braces: some browsers populate the list without ever firing the
  // event. Poll briefly at startup so the first tap already has a voice, then
  // stop — this must not become a permanent timer.
  void (async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      if ((await refreshVoices()).length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  })();
}

// The engine only speaks now when a recording is missing, so there is nothing
// for anyone to choose: the reading people actually hear is Ava either way.
// This picks the least-bad voice on the device for that fallback.
function activeVoice(zh: boolean): string | undefined {
  // Speaking has to start inside the tap that asked for it — iOS blocks speech
  // that begins later — so this cannot await. Kick off a lookup instead, and
  // the next tap has a voice.
  if (!englishVoice || !chineseVoice) void refreshVoices();
  return zh ? chineseVoice : englishVoice;
}

// A single word wants full speed; a sentence read at full speed runs its
// clauses together, which is most of what reads as "robotic". Backing off lets
// the engine land the commas.
// ponytail: a space is enough to tell the two apart. Revisit if multi-word
// headwords ("ad hoc") ever get their own button.
function paceFor(text: string, rate: number, zh = false): number {
  // Chinese writes no spaces, so "has a space" never fires on it. A meaning is
  // a few characters; a translated sentence is long — that is the same split.
  const long = zh ? text.trim().length > 8 : text.trim().includes(' ');
  return long ? rate * 0.9 : rate;
}

// Every headword and every example sentence was rendered once with a neural
// voice and ships with the app, so a phone with only compact system voices
// still reads them properly. Web serves them out of public/audio as URLs;
// native bundles the same folders through the generated ./recordings map.
// Both are keyed by the headword — the example for "abandon" is "ex/abandon" —
// so nothing has to carry a sentence's text around to find its recording.
const IS_WEB = Platform.OS === 'web';

// The recordings were named after the headword, so anything that isn't a plain
// headword has no recording and belongs to the engine. The voice preview in
// settings is a sentence, and that is exactly what should happen to it.
function headword(word: string): string | null {
  const key = word.trim().toLowerCase();
  return /^[a-z][a-z-]*$/.test(key) ? key : null;
}

function exampleKey(word: string): string | null {
  const key = headword(word);
  return key && `ex/${key}`;
}

// The Chinese was recorded from the same word list, into its own folder, so
// the meaning for "abandon" is "zh/abandon" and its translated example is
// "zh/ex/abandon".
function meaningKey(word: string): string | null {
  const key = headword(word);
  return key && `zh/${key}`;
}

function exampleZhKey(word: string): string | null {
  const key = headword(word);
  return key && `zh/ex/${key}`;
}

// The meanings put their sense notes in brackets — "降低(尊嚴、地位)" — and an
// engine reading those out as "括號" is worse than no note at all. A pause says
// the same thing. scripts/tts-build.js strips them the same way, so the
// recording and the fallback say the same words.
export function sayable(text: string): string {
  return text
    .replace(/[（(]/g, '、')
    .replace(/[）)]/g, '')
    .trim();
}

// Required lazily, not imported: the map pulls in thousands of asset modules,
// and nothing should pay for that until the first word is actually spoken.
let bundled: Record<string, number> | undefined;
function bundledRecording(key: string): number | undefined {
  if (!bundled) {
    bundled = (require('./recordings') as { recordings: Record<string, number> }).recordings;
  }
  return bundled[key];
}

// Bumped by every stop and every new sequence. A pending `onDone` from the
// previous sequence checks its own token and gives up, so pressing next twice
// quickly can't leave two chains reading over each other.
let sequenceToken = 0;

// Whatever is making noise right now, in whichever of the two forms. Kept so a
// stop can silence it without either branch knowing about the other.
let playing: { stop: () => void } | undefined;

export function stopSpeaking(): void {
  sequenceToken += 1;
  Speech.stop();
  playing?.stop();
  playing = undefined;
}

// Starts the recording named by `key` and calls `onMiss` if there isn't one, or
// it won't play — a missing file has to fall through to the engine rather than
// leave the tap silent. On web `play()` also rejects when the browser refuses
// autoplay, which is the same recovery.
function startRecording(
  key: string | null,
  rate: number,
  onDone: () => void,
  onMiss: () => void
): void {
  if (!key) return onMiss();

  if (IS_WEB) {
    if (typeof Audio === 'undefined') return onMiss();
    const audio = new Audio(`/audio/${key}.mp3`);
    audio.playbackRate = rate;
    playing = { stop: () => audio.pause() };
    audio.onended = onDone;
    audio.onerror = onMiss;
    void audio.play().catch(onMiss);
    return;
  }

  const source = bundledRecording(key);
  if (source === undefined) return onMiss();
  const player = createAudioPlayer(source);
  player.playbackRate = rate;
  // createAudioPlayer is the imperative API, so nothing releases the player for
  // us: every way out of here has to remove() it or the app leaks one per tap.
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    player.remove();
  };
  playing = { stop: release };
  player.addListener('playbackStatusUpdate', (status) => {
    if (!status.didJustFinish) return;
    release();
    onDone();
  });
  try {
    player.play();
  } catch {
    release();
    onMiss();
  }
}

// One part of a reading: the recording when there is one, the engine otherwise.
type Part = { key: string | null; text: string; zh?: boolean };

function speakOne(part: Part, token: number, rate: number, onDone: () => void): void {
  const zh = part.zh === true;
  const engine = () => {
    if (token !== sequenceToken) return;
    Speech.speak(part.text, {
      language: zh ? 'zh-TW' : 'en-US',
      voice: activeVoice(zh),
      rate: paceFor(part.text, rate, zh),
      onDone,
    });
  };
  startRecording(
    part.key,
    rate,
    () => {
      if (token === sequenceToken) onDone();
    },
    engine
  );
}

function start(parts: Part[], opts: { rate?: number; onDone?: () => void }): void {
  stopSpeaking();
  const token = sequenceToken;
  const speakFrom = (at: number) => {
    if (token !== sequenceToken) return; // stopped, or a newer sequence took over
    if (at >= parts.length) {
      opts.onDone?.();
      return;
    }
    speakOne(parts[at], token, opts.rate ?? 1, () => speakFrom(at + 1));
  };
  speakFrom(0);
}

// Reads the word and then its example, calling `onDone` only after the second
// one finishes. Chaining on each part finishing rather than a timer means the
// gap is a real pause, not a guess.
// Anything blank is left out, so the caller turns a part off by passing '' or
// nothing at all — that is what "only the word" is made of.
export function speakSequence(
  word: string,
  example: string,
  opts: { rate?: number; onDone?: () => void; meaning?: string; exampleZh?: string } = {}
): void {
  const parts: Part[] = [{ key: headword(word), text: word }];
  if (opts.meaning?.trim())
    parts.push({ key: meaningKey(word), text: sayable(opts.meaning), zh: true });
  if (example.trim()) parts.push({ key: exampleKey(word), text: example });
  if (example.trim() && opts.exampleZh?.trim())
    parts.push({ key: exampleZhKey(word), text: opts.exampleZh, zh: true });
  start(parts, opts);
}

export function speakWord(word: string): void {
  // Web queues utterances instead of replacing them, so a second tap would
  // play the previous word first. Cancel whatever is pending — including a
  // running sequence, which is why this goes through stopSpeaking.
  start([{ key: headword(word), text: word }], {});
}

// The sentence's own text is still needed: it is what the engine reads on a
// device the recording never reached.
export function speakExample(word: string, text: string): void {
  start([{ key: exampleKey(word), text }], {});
}
