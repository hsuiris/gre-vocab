import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { words, WordEntry } from '../data/words';
import { getAllProgress, saveWordProgress, incrementHeatmapToday } from '../lib/storage';
import { initialProgress, isDue, reviewWord } from '../lib/leitner';
import { todayStr } from '../lib/date';
import { FlashCard } from '../components/FlashCard';

export function PracticeScreen({ route }: any) {
  const direction: 'en-zh' | 'zh-en' = route.params?.direction ?? 'en-zh';
  const [queue, setQueue] = useState<WordEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const progress = await getAllProgress();
      const today = todayStr();
      const due = words.filter((w) => {
        const p = progress[w.word];
        return !p || isDue(p, today);
      });
      setQueue(due);
      setIndex(0);
      setLoaded(true);
    })();
  }, []);

  async function handleResult(knewIt: boolean) {
    const entry = queue[index];
    const today = todayStr();
    const progress = await getAllProgress();
    const current = progress[entry.word] ?? initialProgress(today);
    const updated = reviewWord(current, knewIt, today);
    await saveWordProgress(entry.word, updated);
    await incrementHeatmapToday(today);
    setIndex((i) => i + 1);
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
      <FlashCard entry={queue[index]} direction={direction} onResult={handleResult} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progress: { textAlign: 'center', color: '#888', marginBottom: 8 },
  done: { fontSize: 18, fontWeight: '600' },
});
