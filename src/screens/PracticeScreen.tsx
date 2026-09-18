import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  PanResponder,
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
  saveSettings,
  defaultSettings,
  getWrongWords,
  addWrongWord,
  removeWrongWord,
} from '../lib/storage';
import type { AppSettings } from '../lib/storage';
import { initialProgress, reviewWord } from '../lib/leitner';
import { todayStr } from '../lib/date';
import { buildChoices } from '../lib/quiz';
import { buildPracticeQueue } from '../lib/practiceQueue';
import { MultipleChoiceCard } from '../components/MultipleChoiceCard';
import { SessionSidePanel, MarkedWord } from '../components/SessionSidePanel';
import { Mascot } from '../components/Mascot';
import { ConfirmBin } from '../components/ConfirmBin';
import { GlassFill } from '../components/Glass';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Practice'>;

// Below this the screen is a phone held upright: there is no room for a real
// second column, so the panel becomes a slide-over instead.
const WIDE_AT = 700;

export function PracticeScreen({ route }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
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
  const [panelOpen, setPanelOpen] = useState(false);
  // Open while the "太簡單" cross is waiting on an answer.
  const [askExclude, setAskExclude] = useState(false);
  const processingRef = useRef(false);
  const barFill = useRef(new Animated.Value(0)).current;
  // Words already scored this session, so stepping back and forth cannot
  // record the same answer twice.
  const scoredRef = useRef(new Set<string>());
  // How the card on screen was answered, recorded the moment an option is
  // tapped. The edge arrows are the only "next" reachable without scrolling
  // past a revealed card, so leaving by one of them has to bank the answer
  // rather than treat an answered card as skipped.
  const pendingRef = useRef<{ word: string; correct: boolean } | null>(null);
  // The PanResponder below is built once, so it would otherwise capture the
  // first render's index forever. It reads the step out of here instead.
  const stepRef = useRef<(delta: number) => void>(() => {});

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
        limit: route.params?.limit,
        wrongWords: route.params?.wrongOnly ? await getWrongWords() : undefined,
      });
      setQueue(due);
      setSettings(nextSettings);
      setIndex(0);
      setLoaded(true);
    })();
  }, [route.params?.letters, route.params?.order, route.params?.wrongOnly, route.params?.limit]);

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

  async function score(entry: WordEntry, knewIt: boolean) {
    // Stepping back and answering again must not score the same card twice —
    // it would advance the Leitner box a second time and double the day's
    // heatmap count.
    if (scoredRef.current.has(entry.word)) return;
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

  // Every way off a card goes through here, so an answer is banked once and
  // exactly once no matter which control moved the queue. An untouched card
  // still records nothing: skipping past a word is not reviewing it.
  async function leaveCard(next: number) {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const pending = pendingRef.current;
      if (pending && queue[index]?.word === pending.word) {
        await score(queue[index], pending.correct);
      }
      goTo(next);
    } finally {
      processingRef.current = false;
    }
  }

  async function handleResult(knewIt: boolean) {
    const entry = queue[index];
    if (entry) pendingRef.current = { word: entry.word, correct: knewIt };
    await leaveCard(index + 1);
  }

  // Answering is not the only way to move: the arrows pinned to the screen
  // edges step through the queue without making the reader scroll to the
  // bottom of a long revealed card to find "next".
  function goTo(next: number) {
    if (next < 0 || next > queue.length) return;
    pendingRef.current = null; // the next card has not been answered yet
    setIndex(next);
  }

  // The cross asks before it bins, unless the reader turned the asking off.
  function handleExclude() {
    if (settings.confirmBeforeBin) setAskExclude(true);
    else runExclude();
  }

  async function confirmExclude(dontAskAgain: boolean) {
    setAskExclude(false);
    if (dontAskAgain) {
      const next = { ...settings, confirmBeforeBin: false };
      setSettings(next);
      await saveSettings(next);
    }
    await runExclude();
  }

  async function runExclude() {
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

  // Swiping is the same move as the edge arrows: a finger to the right walks
  // right through the queue. The threshold and the ratio are what let a
  // vertical scroll through a long revealed card still be a scroll.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 55) stepRef.current(1);
        else if (g.dx < -55) stepRef.current(-1);
      },
    })
  ).current;

  const panel = (onClose?: () => void) => <SessionSidePanel marked={marked} onClose={onClose} />;

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>載入中...</Text>
      </View>
    );
  }

  // Reassigned every render so a swipe always steps from the card on screen.
  // goTo() bounds-checks, so a swipe past either end is a no-op.
  stepRef.current = (delta: number) => {
    leaveCard(index + delta);
  };

  const done = index >= queue.length;
  const current = done ? null : queue[index];
  const currentUnsure = current ? marked.some((m) => m.entry.word === current.word) : false;
  const barWidth = barFill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const wrongCount = marked.filter((m) => m.reason === 'wrong').length;

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingHorizontal: gutter }]}>
        <View style={styles.topRow}>
          <Text style={styles.progress}>
            {Math.min(index + 1, queue.length)} / {queue.length}
          </Text>
          {!wide && (
            <Pressable style={styles.panelButton} onPress={() => setPanelOpen(true)}>
              <Text style={styles.panelButtonText}>錯題庫</Text>
              {marked.length > 0 && <Text style={styles.panelBadge}>{marked.length}</Text>}
            </Pressable>
          )}
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: barWidth }]} />
        </View>
      </View>

      <View style={[wide ? styles.bodyWide : styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.quizPanel} {...swipe.panHandlers}>
          <GlassFill intensity={24} fill={theme.glass.fillThin} />
          <ScrollView
            style={styles.quizScroll}
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
                    style={({ pressed }) => [styles.donePanelButton, pressed && theme.slabPressed]}
                    onPress={() => setPanelOpen(true)}
                  >
                    <Text style={styles.donePanelButtonText}>看錯題庫</Text>
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
                onAnswered={(correct) => {
                  pendingRef.current = { word: current!.word, correct };
                }}
                onExclude={handleExclude}
                onMarkUnsure={() => mark(current!, 'unsure')}
                unsure={currentUnsure}
              />
            )}
          </ScrollView>
        </View>

        {wide && <View style={styles.sideColumn}>{panel()}</View>}
      </View>

      {/* Pinned to the edges rather than placed after the options: a revealed
          card is long, and hunting for "next" at the bottom of it every time is
          the whole complaint. */}
      {index > 0 && (
        <Pressable
          style={({ pressed }) => [styles.stepArrow, styles.stepLeft, pressed && styles.stepArrowDown]}
          onPress={() => leaveCard(index - 1)}
          hitSlop={10}
          accessibilityLabel="上一題"
        >
          <Text style={styles.stepArrowText}>‹</Text>
        </Pressable>
      )}
      {!done && (
        <Pressable
          style={({ pressed }) => [styles.stepArrow, styles.stepRight, pressed && styles.stepArrowDown]}
          onPress={() => leaveCard(index + 1)}
          hitSlop={10}
          accessibilityLabel="下一題"
        >
          <Text style={styles.stepArrowText}>›</Text>
        </Pressable>
      )}

      {askExclude && (
        <ConfirmBin
          message="確定要刪除，或移到太簡單的字庫中嗎？"
          note="標成太簡單的單字會被收錄在設定頁的「已熟悉字庫」中，之後想複習隨時可以放回來。"
          onCancel={() => setAskExclude(false)}
          onConfirm={confirmExclude}
        />
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

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText: { color: t.colors.muted, fontWeight: '700' },
  topBar: { paddingTop: 14, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { color: t.colors.muted, fontWeight: '900', fontSize: 15 },
  track: { height: 8, borderRadius: 4, backgroundColor: t.glass.solid, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: t.colors.blueInk },
  panelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: t.glass.solid,
    borderWidth: 1,
    borderColor: t.glass.edge,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  panelButtonText: { color: t.colors.ink, fontWeight: '900', fontSize: 13 },
  panelBadge: {
    color: t.colors.redInk,
    backgroundColor: t.colors.red,
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
  quizPanel: { ...t.pane(28), ...t.glassShadow, flex: 1.2 },
  quizScroll: { flex: 1, backgroundColor: 'transparent' },
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
    backgroundColor: t.glass.solid,
    borderWidth: 1,
    borderColor: t.glass.edge,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.glassShadow,
  },
  stepArrowDown: { backgroundColor: t.colors.blue },
  stepLeft: { left: 4 },
  stepRight: { right: 4 },
  stepArrowText: { color: t.colors.blueInk, fontSize: 30, lineHeight: 34, fontWeight: '400' },
  modalRow: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(18,33,50,0.35)' },
  scrim: { flex: 1 },
  modalPanel: { width: '88%', maxWidth: 420, padding: 12 },
  doneCard: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24 },
  doneTitle: { color: t.colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  doneMeta: { color: t.colors.muted, fontSize: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  donePanelButton: {
    ...t.slab(t.slabEdge.blue),
    marginTop: 20,
    backgroundColor: t.colors.blue,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  donePanelButtonText: { color: t.colors.blueInk, fontWeight: '900', fontSize: 16 },
});
