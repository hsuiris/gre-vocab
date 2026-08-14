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

import { SessionSidePanel } from '../src/components/SessionSidePanel';
import { AllWordsScreen } from '../src/screens/AllWordsScreen';
import { NotesScreen } from '../src/screens/NotesScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { PracticeScreen } from '../src/screens/PracticeScreen';
import { RelationsScreen } from '../src/screens/RelationsScreen';
import { concepts } from '../src/data/concepts';
import {
  getNotes,
  saveNote,
  getHeatmap,
  getExcludedWords,
  excludeWord,
  getAllProgress,
  getWrongWords,
  incrementHeatmapToday,
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

// The row wraps the corner button, so matching on the ✕ glyph would find the
// row first. The label is on the button and nowhere else.
function cross(tree: renderer.ReactTestRenderer, word: string): ReactTestInstance {
  const found = tree.root.findAll(
    (node) => node.props.accessibilityLabel === `把 ${word} 丟進回收桶` && typeof node.props.onPress === 'function'
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

  it('bins a word from the cross in its corner', async () => {
    const tree = await mount(<AllWordsScreen />);
    expect(readable(tree.root)).toContain(words[0].word);

    await act(async () => cross(tree, words[0].word).props.onPress());

    expect(await getExcludedWords()).toContain(words[0].word);
    expect(readable(tree.root)).not.toContain(words[0].word);
  });

  it('bins without starting the word playing', async () => {
    const tree = await mount(<AllWordsScreen />);

    await act(async () => cross(tree, words[0].word).props.onPress());

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
        const text = readable(p).trim();
        return glosses.has(text) && text !== words[0].meaning;
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
  // Asserting a word is *gone* needs one that is not a fragment of another word
  // on the list, or "abhor" keeps testing positive inside "abhorrent".
  const standalone = concept.words.find(
    ({ w }) => !words.some((other) => other.word !== w && other.word.includes(w))
  )!.w;

  const open = (tree: renderer.ReactTestRenderer) =>
    act(async () => pressableWith(tree, concept.zh).props.onPress());

  it('previews a concept with its strongest word before it is opened', async () => {
    const tree = await mount(<RelationsScreen />);
    const shown = readable(tree.root);

    expect(shown).toContain(concept.zh);
    expect(shown).toContain(concept.words[0].w);
  });

  it('reads a word aloud once its concept is opened', async () => {
    const tree = await mount(<RelationsScreen />);
    // Shut, the words are plain chips. Only an open card makes them tappable.
    await open(tree);

    await act(async () => pressableWith(tree, standalone).props.onPress());

    expect(mockSpeak).toHaveBeenCalledWith(standalone, expect.objectContaining({ language: 'en-US' }));
  });

  it('leaves a binned word out of the concept it belonged to', async () => {
    await excludeWord(standalone);
    const tree = await mount(<RelationsScreen />);
    await open(tree);

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

  it('shows how many words today already covered', async () => {
    await incrementHeatmapToday(todayStr());
    await incrementHeatmapToday(todayStr());
    await incrementHeatmapToday(todayStr());

    const tree = await mount(home());

    expect(readable(tree.root)).toContain('今天背了 3 個字');
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
