import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words, WordEntry } from '../data/words';
import { addDays, INTERVAL_DAYS } from '../lib/leitner';
import { getAllProgress, removeWordProgress, saveWordProgress } from '../lib/storage';
import { todayStr } from '../lib/date';
import { colors, centered } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'BoxWords'>;

export function BoxWordsScreen({ route }: Props) {
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

const styles = StyleSheet.create({
  container: { ...centered, flex: 1, backgroundColor: colors.page, padding: 20 },
  list: { gap: 12, paddingBottom: 28 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyMeta: { color: colors.muted, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 8, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: colors.line },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordText: { flex: 1, paddingRight: 12 },
  word: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  meaning: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 4 },
  deleteButton: { backgroundColor: colors.redSoft, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  deleteText: { color: colors.red, fontWeight: '900' },
  boxes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  boxButton: {
    flex: 1,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxButtonActive: { backgroundColor: colors.green },
  boxButtonText: { color: colors.muted, fontWeight: '900' },
  boxButtonTextActive: { color: colors.surface },
});
