import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, useWindowDimensions } from 'react-native';
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
import { colors, slab, slabEdge } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Practice'>;

// Below this the screen is a phone held upright: there is no room for a real
// second column, so the panel becomes a slide-over instead.
const WIDE_AT = 700;

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
  const processingRef = useRef(false);
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
      const today = todayStr();
      const progress = await getAllProgress();
      const current = progress[entry.word] ?? initialProgress(today);
      const updated = reviewWord(current, knewIt, today);
      await saveWordProgress(entry.word, updated);
      await (knewIt ? removeWrongWord(entry.word) : addWrongWord(entry.word));
      if (!knewIt) mark(entry, 'wrong');
      await incrementHeatmapToday(today);
      setIndex((i) => i + 1);
    } finally {
      processingRef.current = false;
    }
  }

  async function handleExclude() {
    // Shares processingRef with handleResult: only one action can advance
    // the card at a time, whether it's answering or excluding.
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      await excludeWord(queue[index].word);
      setIndex((i) => i + 1);
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
  const progressPct = queue.length === 0 ? 0 : Math.round((Math.min(index, queue.length) / queue.length) * 100);

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
          <View style={[styles.fill, { width: `${progressPct}%` }]} />
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
              <Text style={styles.doneMark}>✓</Text>
              <Text style={styles.doneTitle}>今天的複習都完成了！</Text>
              <Text style={styles.doneMeta}>
                {queue.length} 題 · 錯 {marked.filter((m) => m.reason === 'wrong').length} 題
              </Text>
              {!wide && (
                <Pressable style={styles.donePanelButton} onPress={() => setPanelOpen(true)}>
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
              onExclude={handleExclude}
              onMarkUnsure={() => mark(current!, 'unsure')}
              unsure={currentUnsure}
            />
          )}
        </ScrollView>

        {wide && <View style={styles.sideColumn}>{panel()}</View>}
      </View>

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
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.green },
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
    color: colors.surface,
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
  modalRow: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(18,33,50,0.35)' },
  scrim: { flex: 1 },
  modalPanel: { width: '88%', maxWidth: 420, padding: 12 },
  doneCard: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  doneMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.greenSoft,
    color: colors.green,
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 76,
    marginBottom: 18,
  },
  doneTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  doneMeta: { color: colors.muted, fontSize: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  donePanelButton: {
    ...slab(slabEdge.blue),
    marginTop: 20,
    backgroundColor: colors.blue,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 26,
  },
  donePanelButtonText: { color: colors.surface, fontWeight: '900', fontSize: 16 },
});
