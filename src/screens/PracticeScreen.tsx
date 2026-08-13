import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words, WordEntry } from '../data/words';
import {
  getAllProgress,
  saveWordProgress,
  incrementHeatmapToday,
  getExcludedWords,
  excludeWord,
  getSettings,
  defaultSettings,
  getWrongWords,
  addWrongWord,
  removeWrongWord,
  saveNote,
} from '../lib/storage';
import type { AppSettings } from '../lib/storage';
import { initialProgress, reviewWord } from '../lib/leitner';
import { todayStr } from '../lib/date';
import { buildChoices } from '../lib/quiz';
import { buildPracticeQueue } from '../lib/practiceQueue';
import { MultipleChoiceCard } from '../components/MultipleChoiceCard';
import { SessionSidePanel, MarkedWord } from '../components/SessionSidePanel';
import { Mascot, Mood } from '../components/Mascot';
import { colors, shadow, slab, slabEdge, slabPressed } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Practice'>;

// Below this the screen is a phone held upright: there is no room for a real
// second column, so the panel becomes a slide-over instead.
const WIDE_AT = 700;

// Picked per answer so the same line never lands twice in a row.
const CHEERS = ['答對了！', '好棒！', '就是這個！', '記住了耶', '很有感覺喔'];
const CONSOLES = ['沒關係，記起來就好', '這個字比較難', '下次一定行', '再看一次例句', '錯過的更容易記住'];

function pick(lines: string[], seed: number): string {
  return lines[seed % lines.length];
}

export function PracticeScreen({ route }: Props) {
  const direction: 'en-zh' | 'zh-en' = route.params?.direction ?? 'en-zh';
  const mode = route.params?.mode ?? 'choice';
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_AT;
  // Breathing room down both sides so the panels never touch the screen edge.
  const gutter = wide ? 36 : 16;
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [marked, setMarked] = useState<MarkedWord[]>([]);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mood, setMood] = useState<Mood>('idle');
  const processingRef = useRef(false);
  const barFill = useRef(new Animated.Value(0)).current;
  // Words already scored this session, so stepping back and forth cannot
  // record the same answer twice.
  const scoredRef = useRef(new Set<string>());
  // Fixed at mount so re-saving edits the same note instead of piling up a new
  // one every tap.
  const noteIdRef = useRef(`${todayStr()}-${Date.now()}`);

  const modeLabel =
    mode === 'cloze' ? '句子填空' : mode === 'typing' ? '手寫單字' : direction === 'en-zh' ? '英選中' : '中選英';

  const choices = useMemo(
    () => (loaded && index < queue.length && mode !== 'typing' ? buildChoices(queue[index], mode === 'cloze' ? 'zh-en' : direction, words) : []),
    [loaded, index, queue, direction, mode]
  );
  // Each option carries its whole dictionary entry, so a revealed card can play
  // the word, show its part of speech and print the example sentence.
  const choiceEntries = useMemo(() => {
    const pairs: Record<string, WordEntry> = {};
    for (const choice of choices) {
      const found = words.find((w) => w.word === choice || w.meaning === choice);
      if (found) pairs[choice] = found;
    }
    return pairs;
  }, [choices]);

  useEffect(() => {
    (async () => {
      const [progress, excluded, nextSettings] = await Promise.all([getAllProgress(), getExcludedWords(), getSettings()]);
      const today = todayStr();
      const due = buildPracticeQueue(words, progress, excluded, today, {
        order: route.params?.order,
        letters: route.params?.letters,
        wrongWords: route.params?.wrongOnly ? await getWrongWords() : undefined,
      });
      setQueue(due);
      setSettings(nextSettings);
      setIndex(0);
      setLoaded(true);
    })();
  }, [route.params?.letters, route.params?.order, route.params?.wrongOnly]);

  // The bar slides to the new percentage instead of snapping, which is most of
  // what makes finishing a card feel like progress rather than a state change.
  useEffect(() => {
    Animated.timing(barFill, {
      toValue: queue.length === 0 ? 0 : Math.min(index, queue.length) / queue.length,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating width, which the native driver can't do
    }).start();
  }, [index, queue.length, barFill]);

  // A word shows up once. A miss outranks a self-reported "unsure", so a wrong
  // answer can upgrade an existing star but never the other way round.
  function mark(entry: WordEntry, reason: MarkedWord['reason']) {
    setMarked((current) => {
      const at = current.findIndex((m) => m.entry.word === entry.word);
      if (at < 0) return [...current, { entry, reason }];
      if (reason === 'wrong' && current[at].reason === 'unsure') {
        const next = [...current];
        next[at] = { entry, reason };
        return next;
      }
      return current;
    });
  }

  async function handleResult(knewIt: boolean) {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const entry = queue[index];
      // Stepping back and answering again must not score the same card twice —
      // it would advance the Leitner box a second time and double the day's
      // heatmap count.
      if (!scoredRef.current.has(entry.word)) {
        scoredRef.current.add(entry.word);
        const today = todayStr();
        const progress = await getAllProgress();
        const current = progress[entry.word] ?? initialProgress(today);
        const updated = reviewWord(current, knewIt, today);
        await saveWordProgress(entry.word, updated);
        await (knewIt ? removeWrongWord(entry.word) : addWrongWord(entry.word));
        if (!knewIt) mark(entry, 'wrong');
        await incrementHeatmapToday(today);
      }
      goTo(index + 1);
    } finally {
      processingRef.current = false;
    }
  }

  // Answering is not the only way to move: the arrows pinned to the screen
  // edges step through the queue without making the reader scroll to the
  // bottom of a long revealed card to find "next".
  function goTo(next: number) {
    if (next < 0 || next > queue.length) return;
    setMood('idle'); // a fresh card starts with a calm mascot
    setIndex(next);
  }

  async function handleExclude() {
    // Shares processingRef with handleResult: only one action can advance
    // the card at a time, whether it's answering or excluding.
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await excludeWord(queue[index].word);
      goTo(index + 1);
    } finally {
      processingRef.current = false;
    }
  }

  async function handleSaveNote() {
    const text = note.trim();
    if (!text) return;
    await saveNote({
      id: noteIdRef.current,
      date: todayStr(),
      mode: modeLabel,
      total: queue.length,
      wrongCount: marked.filter((m) => m.reason === 'wrong').length,
      text,
    });
    setNoteSaved(true);
  }

  const panel = (onClose?: () => void) => (
    <SessionSidePanel
      marked={marked}
      note={note}
      onChangeNote={(text) => {
        setNote(text);
        setNoteSaved(false);
      }}
      onSaveNote={handleSaveNote}
      saved={noteSaved}
      onClose={onClose}
    />
  );

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>載入中...</Text>
      </View>
    );
  }

  const done = index >= queue.length;
  const current = done ? null : queue[index];
  const currentUnsure = current ? marked.some((m) => m.entry.word === current.word) : false;
  const barWidth = barFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const wrongCount = marked.filter((m) => m.reason === 'wrong').length;
  const mascotLine =
    mood === 'happy' ? pick(CHEERS, index) : mood === 'sad' ? pick(CONSOLES, index) : '慢慢來，我陪你';

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
        <View style={styles.topRow}>
          <Text style={styles.progress}>
            {Math.min(index + 1, queue.length)} / {queue.length}
          </Text>
          {!wide && (
            <Pressable style={styles.panelButton} onPress={() => setPanelOpen(true)}>
              <Text style={styles.panelButtonText}>錯題 · 筆記</Text>
              {marked.length > 0 && <Text style={styles.panelBadge}>{marked.length}</Text>}
            </Pressable>
          )}
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </View>

      <View style={[wide ? styles.bodyWide : styles.body, { paddingHorizontal: gutter }]}>
        <ScrollView
          style={styles.quizPanel}
          contentContainerStyle={styles.quizContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {done ? (
            <View style={styles.doneCard}>
              <Mascot mood="happy" size={150} message="今天的份做完了！" />
              <Text style={styles.doneTitle}>辛苦了</Text>
              <Text style={styles.doneMeta}>
                {queue.length} 題 · 錯 {wrongCount} 題
              </Text>
              {!wide && (
                <Pressable
                  style={({ pressed }) => [styles.donePanelButton, pressed && slabPressed]}
                  onPress={() => setPanelOpen(true)}
                >
                  <Text style={styles.donePanelButtonText}>看錯題 · 寫筆記</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <MultipleChoiceCard
              key={`${mode}-${current!.word}`}
              entry={current!}
              direction={direction}
              mode={mode}
              choices={choices}
              choiceEntries={choiceEntries}
              settings={settings}
              onResult={handleResult}
              onAnswered={(correct) => setMood(correct ? 'happy' : 'sad')}
              onExclude={handleExclude}
              onMarkUnsure={() => mark(current!, 'unsure')}
              unsure={currentUnsure}
              mascot={<Mascot mood={mood} message={mascotLine} size={104} />}
            />
          )}
        </ScrollView>

        {wide && <View style={styles.sideColumn}>{panel()}</View>}
      </View>

      {/* Pinned to the edges rather than placed after the options: a revealed
          card is long, and hunting for "next" at the bottom of it every time is
          the whole complaint. */}
      {index > 0 && (
        <Pressable
          style={({ pressed }) => [styles.stepArrow, styles.stepLeft, pressed && styles.stepArrowDown]}
          onPress={() => goTo(index - 1)}
          hitSlop={10}
          accessibilityLabel="上一題"
        >
          <Text style={styles.stepArrowText}>‹</Text>
        </Pressable>
      )}
      {!done && (
        <Pressable
          style={({ pressed }) => [styles.stepArrow, styles.stepRight, pressed && styles.stepArrowDown]}
          onPress={() => goTo(index + 1)}
          hitSlop={10}
          accessibilityLabel="下一題"
        >
          <Text style={styles.stepArrowText}>›</Text>
        </Pressable>
      )}

      {!wide && (
        <Modal
          visible={panelOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPanelOpen(false)}
        >
          <View style={styles.modalRow}>
            <Pressable style={styles.scrim} onPress={() => setPanelOpen(false)} />
            <View style={styles.modalPanel}>{panel(() => setPanelOpen(false))}</View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.page, padding: 24 },
  centerText: { color: colors.muted, fontWeight: '700' },
  topBar: { paddingTop: 14, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { color: colors.muted, fontWeight: '900', fontSize: 15 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.blueInk },
  panelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  panelButtonText: { color: colors.ink, fontWeight: '900', fontSize: 13 },
  panelBadge: {
    color: colors.redInk,
    backgroundColor: colors.red,
    fontSize: 11,
    fontWeight: '900',
    minWidth: 20,
    textAlign: 'center',
    borderRadius: 10,
    paddingVertical: 2,
  },
  body: { flex: 1, paddingVertical: 14 },
  // Roughly 55/45. The answer area stays the largest block, but the panel is
  // wide enough to read a full example sentence without wrapping to four lines.
  bodyWide: { flex: 1, flexDirection: 'row', paddingVertical: 14, paddingBottom: 22, gap: 22 },
  quizPanel: {
    flex: 1.2,
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
  },
  quizContent: { paddingVertical: 8, paddingBottom: 32, alignItems: 'center' },
  // No maxWidth: a clamped flex child leaves dead space beside it instead of
  // handing the slack back to the answer column.
  sideColumn: { flex: 1 },
  stepArrow: {
    position: 'absolute',
    top: '46%',
    width: 40,
    height: 56,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  stepArrowDown: { backgroundColor: colors.blue },
  stepLeft: { left: 4 },
  stepRight: { right: 4 },
  stepArrowText: { color: colors.blueInk, fontSize: 30, lineHeight: 34, fontWeight: '400' },
  modalRow: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(18,33,50,0.35)' },
  scrim: { flex: 1 },
  modalPanel: { width: '88%', maxWidth: 420, padding: 12 },
  doneCard: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  doneTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  doneMeta: { color: colors.muted, fontSize: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  donePanelButton: {
    ...slab(slabEdge.blue),
    marginTop: 20,
    backgroundColor: colors.blue,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  donePanelButtonText: { color: colors.blueInk, fontWeight: '900', fontSize: 16 },
});
