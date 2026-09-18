import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words, WordEntry } from '../data/words';
import { addDays, INTERVAL_DAYS } from '../lib/leitner';
import { getAllProgress, removeWordProgress, saveWordProgress } from '../lib/storage';
import { todayStr } from '../lib/date';
import { GlassFill } from '../components/Glass';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'BoxWords'>;

export function BoxWordsScreen({ route }: Props) {
  const styles = useStyles(makeStyles);
  const box = route.params.box;
  const [items, setItems] = useState<WordEntry[]>([]);

  const load = useCallback(async () => {
    const progress = await getAllProgress();
    setItems(words.filter((w) => progress[w.word]?.box === box));
  }, [box]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function moveTo(nextBox: number, word: string) {
    const today = todayStr();
    await saveWordProgress(word, { box: nextBox, nextReviewDate: addDays(today, INTERVAL_DAYS[nextBox - 1]) });
    load();
  }

  function deleteProgress(word: string) {
    Alert.alert('刪除進度', `把 ${word} 從盒子 ${box} 移除？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          await removeWordProgress(word);
          load();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <GlassFill />
          <Text style={styles.emptyTitle}>盒子 {box} 目前沒有單字</Text>
          <Text style={styles.emptyMeta}>答題後累積進度，這裡就會出現可管理的單字。</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.word}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.wordText}>
                  <Text style={styles.word}>{item.word}</Text>
                  <Text style={styles.meaning}>{item.meaning}</Text>
                </View>
                <Pressable style={styles.deleteButton} onPress={() => deleteProgress(item.word)}>
                  <Text style={styles.deleteText}>刪除</Text>
                </Pressable>
              </View>
              <View style={styles.boxes}>
                {[1, 2, 3, 4, 5].map((nextBox) => (
                  <Pressable
                    key={nextBox}
                    style={[styles.boxButton, nextBox === box && styles.boxButtonActive]}
                    onPress={() => moveTo(nextBox, item.word)}
                  >
                    <Text style={[styles.boxButtonText, nextBox === box && styles.boxButtonTextActive]}>
                      {nextBox}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { ...centered, flex: 1, padding: 20 },
  list: { gap: 12, paddingBottom: 28 },
  emptyCard: { ...t.pane(24), ...t.glassShadow, padding: 24 },
  emptyTitle: { color: t.colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyMeta: { color: t.colors.muted, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: t.glass.solid, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: t.glass.edge },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordText: { flex: 1, paddingRight: 12 },
  word: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  meaning: { color: t.colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 4 },
  deleteButton: { backgroundColor: t.colors.red, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  deleteText: { color: t.colors.redInk, fontWeight: '900' },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  boxButton: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    backgroundColor: t.glass.fillThin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxButtonActive: { backgroundColor: t.colors.blue },
  boxButtonText: { color: t.colors.muted, fontWeight: '900' },
  boxButtonTextActive: { color: t.colors.blueInk },
});
