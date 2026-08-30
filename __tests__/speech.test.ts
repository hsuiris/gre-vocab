// Names must start with `mock` — jest.mock factories may not close over
// anything else. The factory reads them lazily, so the consts below are ready
// by the time a test requires the module under test.
const mockSpeak = jest.fn();
const mockStop = jest.fn();
const mockGetVoices = jest.fn();

// The native build plays the recordings out of the bundle, so both the player
// and the generated map are replaced with versions the tests can inspect.
const mockCreatePlayer = jest.fn();

jest.mock('expo-audio', () => ({
  createAudioPlayer: (source: number) => mockCreatePlayer(source),
}));

jest.mock('../src/lib/recordings', () => ({
  recordings: { epitome: 42, 'ex/epitome': 43, 'zh/epitome': 44, 'zh/ex/epitome': 45 },
}));

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
const pickZhVoice = (voices: ReturnType<typeof voice>[]) => loadSpeech([]).pickZhVoice(voices);

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

describe('pickZhVoice', () => {
  it('takes the Taiwan voice over a mainland one', () => {
    expect(pickZhVoice([voice('Tingting', 'zh-CN'), voice('Meijia', 'zh-TW')])).toBe('Meijia-id');
  });

  it('settles for any Chinese voice when no Taiwan one is installed', () => {
    expect(pickZhVoice([voice('Samantha', 'en-US'), voice('Tingting', 'zh-CN')])).toBe('Tingting-id');
  });

  it('returns nothing when the device has no Chinese voice at all', () => {
    expect(pickZhVoice(MACOS_VOICES.filter((v) => v.language.startsWith('en')))).toBeUndefined();
  });
});

describe('speakWord', () => {
  it('speaks with the chosen voice', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith(
      'abject',
      expect.objectContaining({ language: 'en-US', voice: 'Samantha-id', rate: 1 })
    );
  });

  it('still speaks when no English voice exists at all', async () => {
    const { speakWord } = await ready([voice('美嘉', 'zh-TW')]);
    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith(
      'abject',
      expect.objectContaining({ language: 'en-US', voice: undefined, rate: 1 })
    );
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
    const { speakWord } = await ready([]);

    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith('abject', expect.objectContaining({ voice: undefined }));

    // A tap that finds no voice asks the browser again on the way out, so the
    // list that arrived late is in place for the tap after it.
    mockGetVoices.mockResolvedValue(MACOS_VOICES);
    speakWord('abject');
    await Promise.resolve();
    await Promise.resolve();

    mockSpeak.mockClear();
    speakWord('abject');
    expect(mockSpeak).toHaveBeenCalledWith('abject', expect.objectContaining({ voice: 'Samantha-id' }));
  });
});

describe('speakSequence', () => {
  it('reads each part in order and reports done only after the last', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence('abate', 'The storm finally abated.', { onDone });

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
    speakSequence('abate', 'The storm finally abated.', { rate: 1.25 });

    expect(mockSpeak.mock.calls[0][1]).toEqual(expect.objectContaining({ rate: 1.25 }));
    finishUtterance(0);
    expect((mockSpeak.mock.calls[1][1] as { rate: number }).rate).toBeCloseTo(1.125);
  });

  it('stops for good — a late onDone from the cancelled utterance cannot resume it', async () => {
    const { speakSequence, stopSpeaking } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence('abate', 'The storm finally abated.', { onDone });
    stopSpeaking();
    finishUtterance(0); // iOS fires the callback of the utterance it just cut off

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('reads the meaning and the translation in Chinese, in reading order', async () => {
    // 'abate' has no recording in the mock, so every part falls to the engine —
    // which is where the language and the voice can be read off.
    const { speakSequence } = await ready(MACOS_VOICES); // the list ends with 美嘉, zh-TW
    speakSequence('abate', 'The storm finally abated.', {
      meaning: '減輕、緩和',
      exampleZh: '隨著夜幕降臨，暴風雨開始減弱。',
    });

    expect(mockSpeak.mock.calls[0][0]).toBe('abate');
    finishUtterance(0);
    expect(mockSpeak.mock.calls[1][0]).toBe('減輕、緩和');
    expect(mockSpeak.mock.calls[1][1]).toEqual(
      expect.objectContaining({ language: 'zh-TW', voice: '美嘉-id' })
    );
    finishUtterance(1);
    expect(mockSpeak.mock.calls[2][0]).toBe('The storm finally abated.');
    finishUtterance(2);
    expect(mockSpeak.mock.calls[3][0]).toBe('隨著夜幕降臨，暴風雨開始減弱。');
    // Chinese writes no spaces, so a sentence only eases off if length says so.
    expect((mockSpeak.mock.calls[3][1] as { rate: number }).rate).toBeCloseTo(0.9);
  });

  it('drops the translation when the example itself is switched off', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence('abate', '', { exampleZh: '隨著夜幕降臨，暴風雨開始減弱。', onDone });
    finishUtterance(0);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips blank parts so a word with no example still advances the player', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence('abate', '   ', { onDone });
    finishUtterance(0);

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// The headwords ship as recordings so every device hears the same reading. The
// bug this guards: a sentence, or a word whose file never made it, must still
// come out of the engine rather than leave the tap silent.
describe('the shipped recordings', () => {
  const played: { src: string; rate: number }[] = [];
  let fail = false;
  let lastAudio: { onended?: () => void; onerror?: () => void };

  class FakeAudio {
    onended?: () => void;
    onerror?: () => void;
    playbackRate = 1;
    constructor(public src: string) {
      lastAudio = this;
    }
    pause() {}
    play() {
      if (fail) return Promise.reject(new Error('404'));
      played.push({ src: this.src, rate: this.playbackRate });
      return Promise.resolve();
    }
  }

  // The recordings are only served by the web build, so the module has to be
  // loaded as web. resetModules() hands speech.ts a fresh react-native, which
  // is why Platform is pinned after the reset rather than once at the top.
  async function readyOnWeb() {
    jest.resetModules();
    mockSpeak.mockClear();
    mockStop.mockClear();
    mockGetVoices.mockResolvedValue(MACOS_VOICES);
    played.length = 0;
    fail = false;
    (globalThis as { Audio?: unknown }).Audio = FakeAudio;
    (require('react-native').Platform as { OS: string }).OS = 'web';
    const mod = require('../src/lib/speech') as typeof import('../src/lib/speech');
    await Promise.resolve();
    await Promise.resolve();
    return mod;
  }

  afterAll(() => {
    delete (globalThis as { Audio?: unknown }).Audio;
  });

  it('plays the recording for a headword instead of the engine', async () => {
    const { speakWord } = await readyOnWeb();
    speakWord('epitome');
    expect(played).toEqual([{ src: '/audio/epitome.mp3', rate: 1 }]);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('leaves example sentences to the engine — only headwords were recorded', async () => {
    const { speakWord } = await readyOnWeb();
    speakWord('The deluge washed out the bridge.');
    expect(played).toEqual([]);
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('falls back to the engine when the file will not play', async () => {
    const { speakWord } = await readyOnWeb();
    fail = true;
    speakWord('epitome');
    await Promise.resolve();
    await Promise.resolve();
    expect(played).toEqual([]);
    expect(mockSpeak).toHaveBeenCalledWith('epitome', expect.objectContaining({ rate: 1 }));
  });

  it('plays the example recording, not the engine, when the word is tapped', async () => {
    const { speakExample } = await readyOnWeb();
    speakExample('epitome', 'That is the epitome of style.');
    expect(played).toEqual([{ src: '/audio/ex/epitome.mp3', rate: 1 }]);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('reads the word and then its example, both from recordings', async () => {
    const { speakSequence } = await readyOnWeb();
    const onDone = jest.fn();
    speakSequence('epitome', 'That is the epitome of style.', { onDone });
    expect(played).toEqual([{ src: '/audio/epitome.mp3', rate: 1 }]);

    lastAudio.onended?.();
    expect(played[1]).toEqual({ src: '/audio/ex/epitome.mp3', rate: 1 });
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    lastAudio.onended?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // The sentence's own text has to come along, because it is what the engine
  // reads when the recording is missing. On web that shows up as the file
  // failing to load, since a browser only finds out by asking for it.
  it('falls back to reading the example aloud when its file will not load', async () => {
    const { speakExample } = await readyOnWeb();
    fail = true;
    speakExample('abate', 'The storm finally abated.');
    await Promise.resolve();
    await Promise.resolve();
    expect(played).toEqual([]);
    expect(mockSpeak).toHaveBeenCalledWith(
      'The storm finally abated.',
      expect.objectContaining({ rate: 0.9 })
    );
  });
});

// Same promise as the web build, different plumbing: on a phone the recordings
// come out of the app bundle rather than a URL.
describe('the recordings on a phone', () => {
  function fakePlayer() {
    const player = {
      playbackRate: 1,
      finish: undefined as undefined | (() => void),
      played: false,
      removed: false,
      addListener(_event: string, listener: (status: { didJustFinish: boolean }) => void) {
        player.finish = () => listener({ didJustFinish: true });
      },
      play() {
        player.played = true;
      },
      remove() {
        player.removed = true;
      },
    };
    return player;
  }

  let player: ReturnType<typeof fakePlayer>;

  beforeEach(() => {
    player = fakePlayer();
    mockCreatePlayer.mockReset();
    mockCreatePlayer.mockImplementation(() => player);
  });

  it('plays the bundled recording for a headword instead of the engine', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('epitome');
    expect(mockCreatePlayer).toHaveBeenCalledWith(42);
    expect(player.played).toBe(true);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('falls back to the engine for a word with no recording', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('abject');
    expect(mockCreatePlayer).not.toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledWith('abject', expect.objectContaining({ rate: 1 }));
  });

  // createAudioPlayer is imperative: nothing frees the player unless we do, so
  // an unreleased one per tap is a leak that only shows up after long use.
  it('releases the player when the recording ends', async () => {
    const { speakWord } = await ready(MACOS_VOICES);
    speakWord('epitome');
    player.finish?.();
    expect(player.removed).toBe(true);
  });

  it('releases the player when speech is stopped part-way', async () => {
    const { speakWord, stopSpeaking } = await ready(MACOS_VOICES);
    speakWord('epitome');
    stopSpeaking();
    expect(player.removed).toBe(true);
  });

  it('plays the recorded Chinese rather than whatever voice the phone ships', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence('epitome', 'That is the epitome of style.', {
      meaning: '典型、縮影',
      exampleZh: '那就是風格的典型。',
      onDone,
    });

    expect(mockCreatePlayer).toHaveBeenNthCalledWith(1, 42); // the word
    player.finish?.();
    expect(mockCreatePlayer).toHaveBeenNthCalledWith(2, 44); // its meaning, in Chinese
    player.finish?.();
    expect(mockCreatePlayer).toHaveBeenNthCalledWith(3, 43); // the example
    player.finish?.();
    expect(mockCreatePlayer).toHaveBeenNthCalledWith(4, 45); // the translation
    player.finish?.();

    expect(mockSpeak).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reads the word and then its example, both from the bundle', async () => {
    const { speakSequence } = await ready(MACOS_VOICES);
    const onDone = jest.fn();
    speakSequence('epitome', 'That is the epitome of style.', { onDone });
    expect(mockCreatePlayer).toHaveBeenCalledWith(42);

    player.finish?.();
    expect(mockCreatePlayer).toHaveBeenLastCalledWith(43);
    expect(mockSpeak).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    player.finish?.();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
