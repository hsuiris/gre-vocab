import React from 'react';
import renderer, { act, ReactTestInstance } from 'react-test-renderer';
import { Text, Pressable, TextInput } from 'react-native';

const mockSpeak = jest.fn();
jest.mock('expo-speech', () => ({
  speak: (...args: unknown[]) => mockSpeak(...args),
  stop: jest.fn(),
  getAvailableVoicesAsync: () => Promise.resolve([]),
}));

// The real hook needs a navigator above it; running the effect once on mount is
// all these screens actually depend on.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) =>
    require('react').useEffect(callback, [callback]),
}));

// The real mascot runs an endless breathing animation. These tests are about
// what the screens say, not how the character moves, and a live Animated.loop
// keeps firing timers long after the assertions finish.
jest.mock('../src/components/Mascot', () => ({
  Mascot: ({ message }: { message?: string }) =>
    message ? require('react').createElement(require('react-native').Text, null, message) : null,
}));

import { MultipleChoiceCard } from '../src/components/MultipleChoiceCard';
import { SessionSidePanel } from '../src/components/SessionSidePanel';
import { AllWordsScreen } from '../src/screens/AllWordsScreen';
import { NotesScreen } from '../src/screens/NotesScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PracticeScreen } from '../src/screens/PracticeScreen';
import { QuizSetupScreen } from '../src/screens/QuizSetupScreen';
import { WrongWordsScreen } from '../src/screens/WrongWordsScreen';
import { RelationsScreen } from '../src/screens/RelationsScreen';
import { ConceptScreen } from '../src/screens/ConceptScreen';
import { concepts, bandOf } from '../src/data/concepts';
import {
  getNotes,
  saveNote,
  getHeatmap,
  getExcludedWords,
  excludeWord,
  getAllProgress,
  getWrongWords,
  addWrongWord,
  getLastQuiz,
  saveLastQuiz,
  incrementHeatmapToday,
  getSettings,
  defaultSettings,
} from '../src/lib/storage';
import { todayStr } from '../src/lib/date';
import { words } from '../src/data/words';

const AsyncStorage = require('@react-native-async-storage/async-storage');

const mounted: renderer.ReactTestRenderer[] = [];

beforeEach(async () => {
  mockSpeak.mockClear();
  await AsyncStorage.clear();
});

// Leaving trees mounted leaks every effect they started into the next test.
afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
});

// react-test-renderer hands out null refs, and VirtualizedList calls scrollTo on
// whatever it gets. Stub the scroll surface so tapping a row can be tested.
const scrollMock = () => ({ scrollTo: jest.fn(), scrollToOffset: jest.fn(), getScrollableNode: jest.fn() });

// Everything the user can actually read under `node`, flattened into one
// string — enough to assert on without pinning down the markup.
function readable(node: ReactTestInstance): string {
  return node
    .findAllByType(Text)
    .flatMap((text) => {
      const children = Array.isArray(text.props.children) ? text.props.children : [text.props.children];
      return children
        .filter((c: unknown) => typeof c === 'string' || typeof c === 'number')
        .map(String)
        .join(''); // one <Text> reads as one run, interpolations and all
    })
    .join(' ');
}

// Not findAllByType(Pressable): RN wraps it in memo/forwardRef, so type matching
// misses every one of them. Anything with an onPress is a button here.
function pressableWith(tree: renderer.ReactTestRenderer, label: string): ReactTestInstance {
  const found = tree.root
    .findAll((node) => typeof node.props.onPress === 'function')
    .find((p) => readable(p).includes(label));
  if (!found) throw new Error(`no pressable containing "${label}"`);
  return found;
}

async function mount(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(element, { createNodeMock: scrollMock });
    // VirtualizedList schedules its first fill on a timer; let it land inside
    // act, or React warns about the update afterwards.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  mounted.push(tree);
  return tree;
}

const entry = (word: string) => words.find((w) => w.word === word)!;

// The confirm sheet's backdrop wraps its buttons and is pressable itself, so
// matching on text would find the backdrop first. Labels are unique.
function byLabel(tree: renderer.ReactTestRenderer, label: string): ReactTestInstance {
  const found = tree.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  );
  if (!found.length) throw new Error(`no pressable labelled "${label}"`);
  return found[0];
}

// The row wraps the corner button, so matching on the ✕ glyph would find the
// row first. The label is on the button and nowhere else.
function cross(tree: renderer.ReactTestRenderer, word: string): ReactTestInstance {
  const found = tree.root.findAll(
    (node) => node.props.accessibilityLabel === `把 ${word} 移到已熟悉字庫` && typeof node.props.onPress === 'function'
  );
  if (!found.length) throw new Error(`no remove button for "${word}"`);
  return found[0];
}

describe('SessionSidePanel', () => {
  it('lists a wrong answer with its meaning and example', async () => {
    const tree = await mount(
      <SessionSidePanel
        marked={[{ entry: entry('abate'), reason: 'wrong' }]}
        note=""
        onChangeNote={() => {}}
        onSaveNote={() => {}}
        saved={false}
      />
    );
    const shown = readable(tree.root);
    expect(shown).toContain('abate');
    expect(shown).toContain(entry('abate').meaning);
    expect(shown).toContain(entry('abate').example);
  });

  it('keeps the save button off until something is typed', async () => {
    const onSaveNote = jest.fn();
    const tree = await mount(
      <SessionSidePanel marked={[]} note="   " onChangeNote={() => {}} onSaveNote={onSaveNote} saved={false} />
    );
    expect(pressableWith(tree, '存到筆記庫').props.disabled).toBe(true);
    expect(readable(tree.root)).toContain('答錯或標記「不熟」的字會收在這裡');
  });
});

describe('AllWordsScreen', () => {
  it('shows the meaning and the example sentence on every row', async () => {
    const tree = await mount(<AllWordsScreen />);
    const row = readable(pressableWith(tree, words[0].word));
    expect(row).toContain(words[0].meaning);
    expect(row).toContain(words[0].example);
  });

  it('asks before it bins, and bins once confirmed', async () => {
    const tree = await mount(<AllWordsScreen />);
    expect(readable(tree.root)).toContain(words[0].word);

    await act(async () => cross(tree, words[0].word).props.onPress());

    // The cross only opens the question; nothing is binned yet.
    expect(readable(tree.root)).toContain('確定要刪除這個單字，移到已熟悉的單字表中嗎？');
    expect(await getExcludedWords()).not.toContain(words[0].word);

    await act(async () => byLabel(tree, '確定').props.onPress());

    expect(await getExcludedWords()).toContain(words[0].word);
    expect(readable(tree.root)).not.toContain(words[0].word);
  });

  it('keeps the word when the question is cancelled', async () => {
    const tree = await mount(<AllWordsScreen />);

    await act(async () => cross(tree, words[0].word).props.onPress());
    await act(async () => byLabel(tree, '取消').props.onPress());

    expect(await getExcludedWords()).not.toContain(words[0].word);
    expect(readable(tree.root)).toContain(words[0].word);
  });

  it('stops asking once "不要再詢問" is ticked', async () => {
    const tree = await mount(<AllWordsScreen />);

    await act(async () => cross(tree, words[0].word).props.onPress());
    await act(async () => byLabel(tree, '不要再詢問').props.onPress());
    await act(async () => byLabel(tree, '確定').props.onPress());
    expect((await getSettings()).confirmBeforeBin).toBe(false);

    // The next cross bins straight away.
    await act(async () => cross(tree, words[1].word).props.onPress());
    expect(await getExcludedWords()).toContain(words[1].word);
  });

  it('bins without starting the word playing', async () => {
    const tree = await mount(<AllWordsScreen />);

    await act(async () => cross(tree, words[0].word).props.onPress());
    await act(async () => byLabel(tree, '確定').props.onPress());

    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('plays the word and then its example when a row is tapped', async () => {
    const tree = await mount(<AllWordsScreen />);
    const row = pressableWith(tree, words[0].word);

    await act(async () => row.props.onPress());

    expect(mockSpeak.mock.calls[0][0]).toBe(words[0].word);
    // The example only starts once the engine reports the word is finished.
    (mockSpeak.mock.calls[0][1] as { onDone: () => void }).onDone();
    expect(mockSpeak.mock.calls[1][0]).toBe(words[0].example);
  });
});

describe('PracticeScreen', () => {
  // jest's default window is 750pt wide, so this exercises the two-column path.
  const practice = () =>
    React.createElement(PracticeScreen, {
      route: { params: { direction: 'en-zh', mode: 'choice' } },
    } as unknown as React.ComponentProps<typeof PracticeScreen>);

  it('shows the progress count and an empty panel on the first question', async () => {
    const tree = await mount(practice());
    const shown = readable(tree.root);
    expect(shown).toContain('1 / ');
    expect(shown).toContain('錯題庫');
    expect(shown).toContain('答錯或標記「不熟」的字會收在這裡');
  });

  it('files a starred word into the panel with its meaning and example', async () => {
    const tree = await mount(practice());
    await act(async () => pressableWith(tree, '不熟').props.onPress());

    const shown = readable(tree.root);
    expect(shown).toContain(words[0].meaning);
    expect(shown).toContain(words[0].example);
  });

  it('the 太簡單 cross asks first, and says where the word is going', async () => {
    const tree = await mount(practice());

    await act(async () => byLabel(tree, '這個字太簡單').props.onPress());
    const shown = readable(tree.root);
    expect(shown).toContain('確定要刪除，或移到太簡單的字庫中嗎？');
    expect(shown).toContain('已熟悉字庫');
    expect(await getExcludedWords()).toHaveLength(0);

    await act(async () => byLabel(tree, '確定').props.onPress());
    expect(await getExcludedWords()).toHaveLength(1);
  });

  it('the edge arrows move through the queue without scoring anything', async () => {
    const tree = await mount(practice());
    expect(readable(tree.root)).toContain('1 / ');

    await act(async () => pressableWith(tree, '›').props.onPress());
    expect(readable(tree.root)).toContain('2 / ');

    await act(async () => pressableWith(tree, '‹').props.onPress());
    expect(readable(tree.root)).toContain('1 / ');

    // Skipping past a word is not the same as reviewing it.
    expect(await getHeatmap()).toEqual({});
  });

  // The arrow is the only "next" visible without scrolling past a revealed
  // card, so it is what actually gets pressed after answering. Treating that as
  // a skip loses the answer: no Leitner box, no wrong pile, no heatmap.
  it('scores an answered card when the edge arrow is what moves it on', async () => {
    const tree = await mount(practice());

    await act(async () => pressableWith(tree, words[0].meaning).props.onPress());
    await act(async () => pressableWith(tree, '›').props.onPress());

    expect(await getAllProgress()).toHaveProperty(words[0].word);
    expect(await getHeatmap()).toEqual({ [todayStr()]: 1 });
  });

  it('files a wrong answer into the review pile when the arrow moves it on', async () => {
    const tree = await mount(practice());
    const glosses = new Set(words.map((w) => w.meaning));
    const distractor = tree.root
      .findAll((node) => typeof node.props.onPress === 'function')
      .find((p) => {
        // The lettered key sits in front of the option now, so the gloss is the
        // tail of the row rather than the whole of it.
        const gloss = readable(p).trim().replace(/^[A-D\u2713\u2717]\s+/, '');
        return glosses.has(gloss) && gloss !== words[0].meaning;
      })!;

    await act(async () => distractor.props.onPress());
    await act(async () => pressableWith(tree, '›').props.onPress());

    expect(await getWrongWords()).toContain(words[0].word);
  });

  // Stepping back is only safe if re-answering is a no-op. Otherwise a word's
  // Leitner box advances twice and the day's count is inflated by wandering.
  it('answering the same word again after stepping back does not score it twice', async () => {
    const tree = await mount(practice());
    const answer = words[0].meaning;

    await act(async () => pressableWith(tree, answer).props.onPress());
    await act(async () => pressableWith(tree, '下一題').props.onPress());
    expect(await getHeatmap()).toEqual({ [todayStr()]: 1 });

    await act(async () => pressableWith(tree, '‹').props.onPress());
    await act(async () => pressableWith(tree, answer).props.onPress());
    await act(async () => pressableWith(tree, '下一題').props.onPress());

    expect(await getHeatmap()).toEqual({ [todayStr()]: 1 });
  });

  // The explanation used to live at the very bottom, behind a toggle. It is
  // what the reader came for, so it now replaces the question the moment an
  // answer lands.
  it('replaces the question with the word and its explanation the moment an answer lands', async () => {
    const tree = await mount(practice());
    expect(readable(tree.root)).not.toContain(words[0].roots);

    await act(async () => pressableWith(tree, words[0].meaning).props.onPress());

    const shown = readable(tree.root);
    expect(shown).toContain(words[0].word);
    expect(shown).toContain(words[0].roots);
    expect(shown).toContain(words[0].exampleZh!);
    // No hunting for a "查看詳情" toggle any more.
    expect(shown).not.toContain('查看詳情');
  });

  it('saves the session note to the notes library', async () => {
    const tree = await mount(practice());
    await act(async () => {
      tree.root.findAllByType(TextInput)[0].props.onChangeText('ab- 開頭幾乎都是負面的');
    });
    await act(async () => pressableWith(tree, '存到筆記庫').props.onPress());

    const saved = await getNotes();
    expect(saved).toHaveLength(1);
    expect(saved[0].text).toBe('ab- 開頭幾乎都是負面的');
    expect(saved[0].mode).toBe('英選中');
    expect(readable(tree.root)).toContain('已存到筆記庫 ✓');
  });
});

describe('RelationsScreen', () => {
  const concept = concepts[0];
  const relations = (navigate = jest.fn()) =>
    React.createElement(RelationsScreen, {
      navigation: { navigate },
    } as unknown as React.ComponentProps<typeof RelationsScreen>);

  // The card is now a strength ladder: one word per band, not six loose chips.
  it('previews a concept as one word per strength, not a wall of them', async () => {
    const tree = await mount(relations());
    const shown = readable(tree.root);
    const strongest = concept.words.find((x) => bandOf(x.lv) === 'strong') ?? concept.words[0];

    expect(shown).toContain(concept.zh);
    expect(shown).toContain(strongest.w);
    // Three rungs at most, however many words the concept actually holds.
    const onCard = concept.words.filter(({ w }) => shown.includes(w)).length;
    expect(onCard).toBeLessThanOrEqual(3);
  });

  it('opens a concept on its own page rather than unfolding in the list', async () => {
    const navigate = jest.fn();
    const tree = await mount(relations(navigate));

    await act(async () => pressableWith(tree, concept.zh).props.onPress());

    expect(navigate).toHaveBeenCalledWith('Concept', { id: concept.id });
  });
});

describe('ConceptScreen', () => {
  const concept = concepts[0];
  // Asserting a word is *gone* needs one that is not a fragment of another word
  // on the list, or "abhor" keeps testing positive inside "abhorrent".
  const standalone = concept.words.find(
    ({ w }) => !words.some((other) => other.word !== w && other.word.includes(w))
  )!.w;

  const page = (navigate = jest.fn()) =>
    React.createElement(ConceptScreen, {
      navigation: { navigate, push: navigate },
      route: { params: { id: concept.id } },
    } as unknown as React.ComponentProps<typeof ConceptScreen>);

  it('writes every word up as a note, with its meaning spelt out', async () => {
    const tree = await mount(page());
    const shown = readable(tree.root);
    const entry = words.find((w) => w.word === standalone)!;

    expect(shown).toContain(concept.zh);
    expect(shown).toContain(standalone);
    expect(shown).toContain(entry.meaning);
  });

  it('reads a word aloud when its entry is tapped', async () => {
    const tree = await mount(page());

    await act(async () => pressableWith(tree, standalone).props.onPress());

    expect(mockSpeak).toHaveBeenCalledWith(standalone, expect.objectContaining({ language: 'en-US' }));
  });

  it('leaves a binned word out of the concept it belonged to', async () => {
    await excludeWord(standalone);
    const tree = await mount(page());

    expect(readable(tree.root)).not.toContain(standalone);
  });
});

describe('HomeScreen', () => {
  const home = () =>
    React.createElement(HomeScreen, {
      navigation: { navigate: jest.fn() },
    } as unknown as React.ComponentProps<typeof HomeScreen>);

  // readable() joins one <Text> per run, so the badge's three lines come back
  // as one phrase and the count cannot be confused with the 3192 on the page.
  it('counts nothing on a day with no practice yet', async () => {
    const tree = await mount(home());
    expect(readable(tree.root)).toContain('今天背了 0 個字');
  });

  // Range and order are the quiz's business, not the home screen's, so picking
  // one asks for them before any card appears.
  it('sends a picked quiz to the setup page instead of straight into the cards', async () => {
    const navigate = jest.fn();
    const tree = await mount(
      React.createElement(HomeScreen, {
        navigation: { navigate },
      } as unknown as React.ComponentProps<typeof HomeScreen>)
    );

    await act(async () => pressableWith(tree, '句子填空').props.onPress());

    expect(navigate).toHaveBeenCalledWith('QuizSetup', { quiz: expect.objectContaining({ mode: 'cloze' }) });
    // Nothing is saved until the session actually begins.
    expect(await getLastQuiz()).toBeNull();
  });

  it('opens the mistake pile straight onto its word list, with no range to pick', async () => {
    const navigate = jest.fn();
    const tree = await mount(
      React.createElement(HomeScreen, {
        navigation: { navigate },
      } as unknown as React.ComponentProps<typeof HomeScreen>)
    );

    await act(async () => pressableWith(tree, '複習錯題').props.onPress());

    expect(navigate).toHaveBeenCalledWith('WrongWords', { quiz: expect.objectContaining({ wrongOnly: true }) });
  });

  it('offers a one-tap way back into the quiz that was started last', async () => {
    const fresh = await mount(home());
    expect(readable(fresh.root)).not.toContain('接著上次');

    await saveLastQuiz({ direction: 'zh-en', mode: 'cloze', label: '句子填空', order: 'shuffle', letters: ['a'] });
    const navigate = jest.fn();
    const tree = await mount(
      React.createElement(HomeScreen, {
        navigation: { navigate },
      } as unknown as React.ComponentProps<typeof HomeScreen>)
    );

    expect(readable(tree.root)).toContain('接著上次');
    await act(async () => pressableWith(tree, '接著上次').props.onPress());

    // Straight to the cards, with the range it was started with.
    expect(navigate).toHaveBeenCalledWith(
      'Practice',
      expect.objectContaining({ order: 'shuffle', letters: ['a'] })
    );
  });

  it('shows how many words today already covered', async () => {
    await incrementHeatmapToday(todayStr());
    await incrementHeatmapToday(todayStr());
    await incrementHeatmapToday(todayStr());

    const tree = await mount(home());

    expect(readable(tree.root)).toContain('今天背了 3 個字');
  });
});

describe('WrongWordsScreen', () => {
  const quiz = { direction: 'zh-en', mode: 'choice', wrongOnly: true, label: '複習錯題' };
  const screen = (navigate = jest.fn()) =>
    React.createElement(WrongWordsScreen, {
      navigation: { navigate },
      route: { params: { quiz } },
    } as unknown as React.ComponentProps<typeof WrongWordsScreen>);

  // The pile is its own range, so this screen skips the setup page entirely:
  // read the list, then test yourself on exactly what is on it.
  it('lists what is still wrong and tests you on it without asking for a range', async () => {
    await addWrongWord(words[0].word);
    const navigate = jest.fn();
    const tree = await mount(screen(navigate));

    expect(readable(tree.root)).toContain(words[0].word);
    await act(async () => pressableWith(tree, '開始測驗').props.onPress());

    expect(navigate).toHaveBeenCalledWith('Practice', expect.objectContaining({ wrongOnly: true }));
    expect(await getLastQuiz()).toMatchObject({ label: '複習錯題' });
  });

  it('drops a word from the pile once you say you have learnt it', async () => {
    await addWrongWord(words[0].word);
    const tree = await mount(screen());

    await act(async () => pressableWith(tree, '已學會').props.onPress());

    expect(await getWrongWords()).toEqual([]);
    expect(readable(tree.root)).toContain('目前沒有錯題');
  });

  it('offers no test when there is nothing wrong to retake', async () => {
    const tree = await mount(screen());

    const shown = readable(tree.root);
    expect(shown).toContain('目前沒有錯題');
    expect(shown).not.toContain('開始測驗');
  });
});

describe('QuizSetupScreen', () => {
  const setup = (navigate = jest.fn()) =>
    React.createElement(QuizSetupScreen, {
      navigation: { navigate },
      route: { params: { quiz: { direction: 'en-zh', mode: 'choice', label: '英文選中文意思' } } },
    } as unknown as React.ComponentProps<typeof QuizSetupScreen>);

  it('says what the chosen quiz will ask before anything starts', async () => {
    const tree = await mount(setup());
    expect(readable(tree.root)).toContain('看英文單字，選出正確的中文意思');
  });

  it('carries the range and order into the session, and remembers both', async () => {
    const navigate = jest.fn();
    const tree = await mount(setup(navigate));

    await act(async () => pressableWith(tree, '跳著背').props.onPress());
    await act(async () => pressableWith(tree, 'B').props.onPress());
    await act(async () => pressableWith(tree, '開始練習').props.onPress());

    expect(navigate).toHaveBeenCalledWith(
      'Practice',
      expect.objectContaining({ order: 'shuffle', letters: ['b'] })
    );
    expect(await getLastQuiz()).toMatchObject({ label: '英文選中文意思', order: 'shuffle', letters: ['b'] });
  });
});

describe('NotesScreen', () => {
  it('shows a saved note with its session summary', async () => {
    await saveNote({
      id: '2026-08-07-1',
      date: '2026-08-07',
      mode: '英選中',
      total: 40,
      wrongCount: 6,
      text: 'ab- 開頭幾乎都是負面的',
    });
    const tree = await mount(<NotesScreen />);
    const shown = readable(tree.root);
    expect(shown).toContain('2026-08-07');
    expect(shown).toContain('ab- 開頭幾乎都是負面的');
    expect(shown).toContain('40 題 · 錯 6 題');
  });

  it('tells you where notes come from when there are none', async () => {
    const tree = await mount(<NotesScreen />);
    expect(readable(tree.root)).toContain('還沒有筆記');
  });
});

// The one branch in reveal(): answering speaks the English word, but only while
// the setting is on.
describe('answer-time pronunciation', () => {
  const card = (autoSpeakAfterAnswer: boolean) => {
    const target = entry('abate');
    return (
      <MultipleChoiceCard
        entry={target}
        direction="en-zh"
        mode="choice"
        choices={[target.meaning, '增加', '維持', '拒絕']}
        choiceEntries={{ [target.meaning]: target }}
        settings={{ ...defaultSettings, autoSpeakAfterAnswer }}
        onResult={() => {}}
        onAnswered={() => {}}
        onExclude={() => {}}
        onMarkUnsure={() => {}}
        unsure={false}
      />
    );
  };

  test('speaks the word when the setting is on', async () => {
    const tree = await mount(card(true));
    await act(async () => {
      pressableWith(tree, entry('abate').meaning).props.onPress();
    });
    expect(mockSpeak).toHaveBeenCalledWith('abate', expect.anything());
  });

  test('stays quiet when the setting is off', async () => {
    const tree = await mount(card(false));
    await act(async () => {
      pressableWith(tree, entry('abate').meaning).props.onPress();
    });
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});

// Hearing the English word is the answer in every mode except 英文選中文, so the
// question's speaker button has to disappear in the other three.
describe('pronounce button before answering', () => {
  const soundButtons = (tree: renderer.ReactTestRenderer) =>
    tree.root.findAll((n) => n.props.accessibilityLabel === '聽發音' && typeof n.props.onPress === 'function');

  const quizCard = (mode: 'choice' | 'cloze' | 'typing', direction: 'en-zh' | 'zh-en') => {
    const target = entry('abate');
    return (
      <MultipleChoiceCard
        entry={target}
        direction={direction}
        mode={mode}
        choices={[target.word, 'augment', 'sustain', 'refuse']}
        choiceEntries={{}}
        settings={defaultSettings}
        onResult={() => {}}
        onAnswered={() => {}}
        onExclude={() => {}}
        onMarkUnsure={() => {}}
        unsure={false}
      />
    );
  };

  test('英文選中文 keeps it — the word is already on the card', async () => {
    expect(soundButtons(await mount(quizCard('choice', 'en-zh')))).toHaveLength(1);
  });

  test('中文選英文 has none', async () => {
    expect(soundButtons(await mount(quizCard('choice', 'zh-en')))).toHaveLength(0);
  });

  test('拼字 has none', async () => {
    expect(soundButtons(await mount(quizCard('typing', 'zh-en')))).toHaveLength(0);
  });

  test('克漏字 has none', async () => {
    expect(soundButtons(await mount(quizCard('cloze', 'en-zh')))).toHaveLength(0);
  });
});
