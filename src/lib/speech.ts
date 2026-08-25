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

// On web, `language: 'en-US'` is only a hint — Safari ignores it and reads with
// whatever the system default is, which on a Chinese-locale device mangles
// every English word. Pinning a real voice is what makes the pronunciation
// right.
type Voice = { identifier: string; name?: string; language?: string };

let englishVoice: string | undefined;
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

// Auto-detection can only guess from voice names, and browsers disagree about
// what they expose — Chrome hides some macOS downloads that Safari lists. An
// explicit choice always wins, so a wrong guess is one tap away from fixed.
let chosenVoice: string | undefined;

export function setPreferredVoice(id: string | null | undefined): void {
  chosenVoice = id ?? undefined;
}

export function activeVoice(): string | undefined {
  const voice = chosenVoice ?? englishVoice;
  // Speaking has to start inside the tap that asked for it — iOS blocks speech
  // that begins later — so this cannot await. Kick off a lookup instead, and
  // the next tap has a voice.
  if (!voice) void refreshVoices();
  return voice;
}

export function autoVoice(): string | undefined {
  return englishVoice;
}

// Three is a choice; fifteen is a catalogue nobody listens through.
const MAX_VOICES = 3;

// Every system reports a dozen or more English voices and most of them are the
// compact ones — recorded syllables glued together, which is the flat robotic
// reading. Rank what is installed by the same signals pickVoice() trusts and
// keep only the best few, so the picker is a shortlist worth trying rather than
// everything the operating system happens to ship.
export function curateVoices(voices: Voice[]): { id: string; name: string }[] {
  const english = voices.filter((v) => v.language?.toLowerCase().startsWith('en'));
  const usable = english.filter((v) => !NOVELTY.has((v.name ?? '').trim().toLowerCase()));

  const ranked = usable
    .map((v) => {
      const name = (v.name ?? v.identifier).trim();
      const lower = name.toLowerCase();
      const tier = QUALITY_TIERS.findIndex((t) => lower.includes(t));
      const known = PREFERRED.findIndex((p) => lower.startsWith(p));
      // Neither a neural voice nor a reader anyone recommends: that is a
      // compact voice, and compact is the sound being complained about.
      if (tier < 0 && known < 0) return null;
      return { id: v.identifier, name, score: (tier < 0 ? 99 : tier) * 100 + (known < 0 ? 99 : known) };
    })
    .filter(Boolean) as { id: string; name: string; score: number }[];

  ranked.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

  // One row per reader, not one per quality variant: "Samantha" and
  // "Samantha (Enhanced)" are the same person twice, and the better one sorts
  // first, so the plain variant is the one dropped.
  const seen = new Set<string>();
  const best: { id: string; name: string }[] = [];
  for (const { id, name } of ranked) {
    const reader = name.toLowerCase().replace(/\s*\(.*\)\s*$/, '');
    if (seen.has(reader)) continue;
    seen.add(reader);
    best.push({ id, name });
    if (best.length === MAX_VOICES) break;
  }

  // A system with nothing recognisable still needs something to offer, or the
  // picker looks broken rather than picky.
  if (best.length === 0) {
    return usable.slice(0, MAX_VOICES).map((v) => ({ id: v.identifier, name: v.name ?? v.identifier }));
  }
  return best;
}

export async function listEnglishVoices(): Promise<{ id: string; name: string }[]> {
  let voices = await refreshVoices();
  // Opening settings on a phone can still beat the browser to the list, and an
  // empty picker looks like the feature is missing rather than still loading.
  for (let attempt = 0; attempt < 6 && voices.length === 0; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    voices = await refreshVoices();
  }
  return curateVoices(voices);
}

// A single word wants full speed; a sentence read at full speed runs its
// clauses together, which is most of what reads as "robotic". Backing off lets
// the engine land the commas.
// ponytail: a space is enough to tell the two apart. Revisit if multi-word
// headwords ("ad hoc") ever get their own button.
function paceFor(text: string, rate: number): number {
  return text.trim().includes(' ') ? rate * 0.9 : rate;
}

// Bumped by every stop and every new sequence. A pending `onDone` from the
// previous sequence checks its own token and gives up, so pressing next twice
// quickly can't leave two chains reading over each other.
let sequenceToken = 0;

export function stopSpeaking(): void {
  sequenceToken += 1;
  Speech.stop();
}

// Reads `parts` back to back — the player uses [word, example] — and calls
// `onDone` only after the last one finishes. Chaining on `onDone` rather than a
// timer means the gap is the engine's own sentence pause, not a guess.
export function speakSequence(parts: string[], opts: { rate?: number; onDone?: () => void } = {}): void {
  stopSpeaking();
  const token = sequenceToken;
  const queue = parts.filter((part) => part.trim().length > 0);
  const speakFrom = (at: number) => {
    if (token !== sequenceToken) return; // stopped, or a newer sequence took over
    if (at >= queue.length) {
      opts.onDone?.();
      return;
    }
    Speech.speak(queue[at], {
      language: 'en-US',
      voice: activeVoice(),
      rate: paceFor(queue[at], opts.rate ?? 1),
      onDone: () => speakFrom(at + 1),
    });
  };
  speakFrom(0);
}

export function speakWord(text: string): void {
  // Web queues utterances instead of replacing them, so a second tap would
  // play the previous word first. Cancel whatever is pending — including a
  // running speakSequence, which is why this goes through stopSpeaking.
  stopSpeaking();
  Speech.speak(text, { language: 'en-US', voice: activeVoice(), rate: paceFor(text, 1) });
}
