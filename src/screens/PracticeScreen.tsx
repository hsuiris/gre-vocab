import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words, WordEntry } from '../data/words';
import {
  getAllProgress,
  saveWordProgress,
  incrementHeatmapToday,
  getExcludedWords,
  excludeWord,
} from '../lib/storage';
import { initialProgress, isDue, reviewWord } from '../lib/leitner';
import { todayStr } from '../lib/date';
import { buildChoices } from '../lib/quiz';
import { MultipleChoiceCard } from '../components/MultipleChoiceCard';

type Props = NativeStackScreenProps<RootStackParamList, 'Practice'>;

export function PracticeScreen({ route }: Props) {
  const direction: 'en-zh' | 'zh-en' = route.params?.direction ?? 'en-zh';
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const processingRef = useRef(false);

  const choices = useMemo(
    () => (loaded && index < queue.length ? buildChoices(queue[index], direction, words) : []),
    [loaded, index, queue, direction]
  );

  useEffect(() => {
    (async () => {
      const [progress, excluded] = await Promise.all([getAllProgress(), getExcludedWords()]);
      const excludedSet = new Set(excluded);
      const today = todayStr();
      const due = words.filter((w) => {
        if (excludedSet.has(w.word)) return false;
        const p = progress[w.word];
        return !p || isDue(p, today);
      });
      setQueue(due);
      setIndex(0);
      setLoaded(true);
    })();
  }, []);

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
        <Text>載入中…</Text>
      </View>
    );
  }

  if (index >= queue.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.done}>今天的複習都完成了！</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{index + 1} / {queue.length}</Text>
      <MultipleChoiceCard
        key={queue[index].word}
        entry={queue[index]}
        direction={direction}
        choices={choices}
        onResult={handleResult}
        onExclude={handleExclude}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progress: { textAlign: 'center', color: '#888', marginBottom: 8 },
  done: { fontSize: 18, fontWeight: '600' },
});
