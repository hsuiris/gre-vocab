import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
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
} from '../lib/storage';
import type { AppSettings } from '../lib/storage';
import { initialProgress, reviewWord } from '../lib/leitner';
import { todayStr } from '../lib/date';
import { buildChoices } from '../lib/quiz';
import { buildPracticeQueue } from '../lib/practiceQueue';
import { MultipleChoiceCard } from '../components/MultipleChoiceCard';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Practice'>;

export function PracticeScreen({ route }: Props) {
  const direction: 'en-zh' | 'zh-en' = route.params?.direction ?? 'en-zh';
  const mode = route.params?.mode ?? 'choice';
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const processingRef = useRef(false);

  const choices = useMemo(
    () => (loaded && index < queue.length && mode !== 'typing' ? buildChoices(queue[index], mode === 'cloze' ? 'zh-en' : direction, words) : []),
    [loaded, index, queue, direction, mode]
  );
  const choiceAnswers = useMemo(() => {
    const pairs: Record<string, string> = {};
    for (const choice of choices) {
      const found = words.find((w) => w.word === choice || w.meaning === choice);
      if (found) pairs[choice] = found.word === choice ? found.meaning : found.word;
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

  if (!loaded) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>載入中...</Text>
      </View>
    );
  }

  if (index >= queue.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.doneMark}>✓</Text>
        <Text style={styles.done}>今天的複習都完成了！</Text>
        <Text style={styles.doneMeta}>明天再回來，讓記憶慢慢長穩。</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.progressPill}>
        <Text style={styles.progress}>{index + 1} / {queue.length}</Text>
      </View>
      <MultipleChoiceCard
        key={`${mode}-${queue[index].word}`}
        entry={queue[index]}
        direction={direction}
        mode={mode}
        choices={choices}
        choiceAnswers={choiceAnswers}
        settings={settings}
        onResult={handleResult}
        onExclude={handleExclude}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page, paddingTop: 18 },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.page, padding: 24 },
  centerText: { color: colors.muted, fontWeight: '700' },
  progressPill: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  progress: { color: colors.muted, fontWeight: '900' },
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
  done: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  doneMeta: { color: colors.muted, fontSize: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
