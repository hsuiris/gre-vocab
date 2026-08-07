import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { getExcludedWords, restoreWord } from '../lib/storage';
import { Mascot } from '../components/Mascot';
import { colors, centered } from '../theme';

export function ExcludedScreen() {
  const [excluded, setExcluded] = useState<WordEntry[]>([]);

  const load = useCallback(async () => {
    const excludedWords = await getExcludedWords();
    const excludedSet = new Set(excludedWords);
    setExcluded(words.filter((w) => excludedSet.has(w.word)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleRestore(word: string) {
    await restoreWord(word);
    load();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>太簡單的字</Text>
      <Text style={styles.title}>回收桶</Text>
      {excluded.length === 0 ? (
        <View style={styles.emptyCard}>
          <Mascot size={112} message="一個字都沒丟掉" />
          <Text style={styles.emptyTitle}>現在很乾淨</Text>
          <Text style={styles.empty}>目前沒有標記太簡單的字</Text>
        </View>
      ) : (
        <FlatList
          data={excluded}
          keyExtractor={(item) => item.word}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.word}>{item.word}</Text>
                <Text style={styles.meaning}>{item.meaning}</Text>
              </View>
              <Pressable style={styles.restoreButton} onPress={() => handleRestore(item.word)}>
                <Text style={styles.restoreText}>恢復</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...centered, flex: 1, backgroundColor: colors.page, padding: 20 },
  eyebrow: { color: colors.blueInk, fontSize: 14, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4, marginBottom: 16 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  empty: { color: colors.muted, marginTop: 8, textAlign: 'center', fontWeight: '700' },
  list: { gap: 10, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowText: { flex: 1, marginRight: 12 },
  word: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  meaning: { color: colors.muted, marginTop: 4, fontWeight: '700' },
  restoreButton: { backgroundColor: colors.blue, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16 },
  restoreText: { color: colors.blueInk, fontWeight: '900' },
});
