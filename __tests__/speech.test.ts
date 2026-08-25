// Names must start with `mock` — jest.mock factories may not close over
// anything else. The factory reads them lazily, so the consts below are ready
// by the time a test requires the module under test.
const mockSpeak = jest.fn();
const mockStop = jest.fn();
const mockGetVoices = jest.fn();

jest.mock('expo-speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  stop: () => mockStop(),
  getAvailableVoicesAsync: () => mockGetVoices(),
}));

const voice = (name: string, language: string) => ({ identifier: `${name}-id`, name, language });

// The real English voice list from a macOS machine, in the order the browser
// reports it. Note what comes first: Albert, a joke voice.
const MACOS_VOICES = [
  voice('Albert', 'en-US'),
  voice('Bad News', 'en-US'),
  voice('Bahh', 'en-US'),
  voice('Bells', 'en-US'),
  voice('Boing', 'en-US'),
  voice('Bubbles', 'en-US'),
  voice('Cellos', 'en-US'),
  voice('Daniel', 'en-GB'),
  voice('Wobble', 'en-US'),
  voice('Fred', 'en-US'),
  voice('Good News', 'en-US'),
  voice('Jester', 'en-US'),
  voice('Junior', 'en-US'),
  voice('Karen', 'en-AU'),
  voice('Kathy', 'en-US'),
  voice('Organ', 'en-US'),
  voice('Superstar', 'en-US'),
  voice('Ralph', 'en-US'),
  voice('Samantha', 'en-US'),
  voice('Trinoids', 'en-US'),
  voice('Whisper', 'en-US'),
  voice('Zarvox', 'en-US'),
  voice('美嘉', 'zh-TW'),
];

// require, not a top-level import: jest.resetModules() needs a fresh
// synchronous load so the module-level voice lookup re-runs each time.
function loadSpeech(voices: ReturnType<typeof voice>[]) {
  jest.resetModules();
  mockSpeak.mockClear();
  mockStop.mockClear();
  mockGetVoices.mockResolvedValue(voices);
  return require('../src/lib/speech') as typeof import('../src/lib/speech');
}

const pickVoice = (voices: ReturnType<typeof voice>[]) => loadSpeech([]).pickVoice(voices);

async function ready(voices: ReturnType<typeof voice>[]) {
  const mod = loadSpeech(voices);
  await Promise.resolve(); // let the module-level lookup settle
  await Promise.resolve();
  return mod;
}

// expo-speech signals the end of an utterance through onDone; the mock never
// does, so a test plays the engine and fires it by hand.
function finishUtterance(callIndex: number) {
  const options = mockSpeak.mock.calls[callIndex][1] as { onDone?: () => void };
  options.onDone?.();
}

describe('pickVoice', () => {
  it('picks Samantha, not the joke voices macOS lists first', () => {
    expect(pickVoice(MACOS_VOICES)).toBe('Samantha-id');
  });

  it('never picks a novelty voice even when it is the only en-US option', () => {
    expect(pickVoice([voice('Albert', 'en-US'), voice('Zarvox', 'en-US'), voice('Daniel', 'en-GB')])).toBe(
      'Daniel-id'
    );
  });

  it('ignores non-English voices', () => {
    expect(pickVoice([voice('美嘉', 'zh-TW'), voice('Kyoko', 'ja-JP')])).toBeUndefined();
  });

  it('takes any sensible English voice when no preferred name is present', () => {
    expect(pickVoice([voice('Bahh', 'en-US'), voice('Rocko', 'en-GB')])).toBe('Rocko-id');
  });

  it('prefers an installed neural voice over the compact default', () => {
    expect(pickVoice([...MACOS_VOICES, voice('Ava (Premium)', 'en-US')])).toBe('Ava (Premium)-id');
  });

  it('prefers an Edge Natural voice over Google US English', () => {
    expect(
      pickVoice([
        voice('Google US English', 'en-US'),
        voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US'),
      ])
    ).toBe('Microsoft Aria Online (Natural) - English (United States)-id');
  });

  it('never promotes a novelty voice even if its name matches a quality tier', () => {
    expect(pickVoice([voice('Whisper', 'en-US'), voice('Daniel', 'en-GB')])).toBe('Daniel-id');
  });

  it('handles a browser that reports no voices at all', () => {
    expect(pickVoice([])).toBeUndefined();
  });
});

describe('speakWord', () => {
  it('speaks with the chosen voice', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith('abject', { language: 'en-US', voice: 'Samantha-id', rate: 1 });
  });

  it('still speaks when no English voice exists at all', async () => {
    const { speakWord } = await ready([voice('美嘉', 'zh-TW')]);
    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith('abject', { language: 'en-US', voice: undefined, rate: 1 });
  });

  it('slows down for a sentence but not for a single word', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('The deluge washed out the bridge.');
    expect(mockSpeak).toHaveBeenCalledWith(
      'The deluge washed out the bridge.',
      expect.objectContaining({ rate: 0.9 })
    );
  });

  it('cancels the pending utterance so taps do not queue up', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('abject');
    expect(mockStop).toHaveBeenCalled();
  });
});

// The bug this guards: a mobile browser answers the first getVoices() with an
// empty list and fills it in a moment later. A single lookup at startup left
// the phone with no English voice, so English words were read by whatever the
// system language was.
describe('a voice list that arrives late', () => {
  it('is picked up, so a phone stops reading English with the system voice', async () => {
    const { speakWord, listEnglishVoices } = await ready([]);

    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith('abject', expect.objectContaining({ voice: undefined }));

    // The browser populates the list; the next lookup finds it.
    mockGetVoices.mockResolvedValue(MACOS_VOICES);
    await listEnglishVoices();

    mockSpeak.mockClear();
    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith('abject', expect.objectContaining({ voice: 'Samantha-id' }));
  });

  it('reports the voices once they exist, rather than an empty picker', async () => {
    const { listEnglishVoices } = await ready([]);
    mockGetVoices.mockResolvedValue(MACOS_VOICES);
    const names = (await listEnglishVoices()).map((v) => v.name);
    expect(names).toContain('Samantha');
  });
});

describe('speakSequence', () => {
  it('reads each part in order and reports done only after the last', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence(['abate', 'The storm finally abated.'], { onDone });

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak.mock.calls[0][0]).toBe('abate');

    finishUtterance(0);
    expect(mockSpeak.mock.calls[1][0]).toBe('The storm finally abated.');
    expect(onDone).not.toHaveBeenCalled();

    finishUtterance(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('scales by the chosen rate and still eases off for a sentence', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    speakSequence(['abate', 'The storm finally abated.'], { rate: 1.25 });

    expect(mockSpeak.mock.calls[0][1]).toEqual(expect.objectContaining({ rate: 1.25 }));
    finishUtterance(0);
    expect((mockSpeak.mock.calls[1][1] as { rate: number }).rate).toBeCloseTo(1.125);
  });

  it('stops for good — a late onDone from the cancelled utterance cannot resume it', async () => {
    const { speakSequence, stopSpeaking } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence(['abate', 'The storm finally abated.'], { onDone });
    stopSpeaking();
    finishUtterance(0); // iOS fires the callback of the utterance it just cut off

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('skips blank parts so a word with no example still advances the player', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence(['abate', '   '], { onDone });
    finishUtterance(0);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('curateVoices', () => {
  const curateVoices = (voices: { identifier: string; name: string; language: string }[]) =>
    loadSpeech([]).curateVoices(voices);
  const v = (name: string, language = 'en-US') => ({ identifier: name, name, language });

  it('keeps only the best few readers, not everything the system ships', () => {
    const picked = curateVoices([
      v('Zarvox'),
      v('Samantha'),
      v('Samantha (Enhanced)'),
      v('Nicky (Compact)'),
      v('Alex'),
      v('Microsoft Aria Online (Natural)'),
      v('婉婷', 'zh-TW'),
    ]);

    expect(picked).toHaveLength(3);
    // Neural first, then the readers worth recommending.
    expect(picked[0].name).toBe('Microsoft Aria Online (Natural)');
    // The same reader twice is one row, and it is the better variant that stays.
    expect(picked.map((p) => p.name)).toContain('Samantha (Enhanced)');
    expect(picked.map((p) => p.name)).not.toContain('Samantha');
    // Novelty, compact and non-English are all out.
    expect(picked.map((p) => p.name)).not.toContain('Zarvox');
    expect(picked.map((p) => p.name)).not.toContain('Nicky (Compact)');
    expect(picked.map((p) => p.name)).not.toContain('婉婷');
  });

  it('still offers something when nothing on the device is recognisable', () => {
    const picked = curateVoices([v('en-GB-Wavenet-Q'), v('Voice 2'), v('Voice 3'), v('Voice 4')]);
    expect(picked).toHaveLength(3);
  });
});
