import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { getExcludedWords, restoreWord } from '../lib/storage';

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
      <Text style={styles.title}>回收桶</Text>
      {excluded.length === 0 ? (
        <Text style={styles.empty}>目前沒有標記太簡單的字</Text>
      ) : (
        <FlatList
          data={excluded}
          keyExtractor={(item) => item.word}
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
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  empty: { color: '#555', marginTop: 24, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowText: { flex: 1, marginRight: 12 },
  word: { fontSize: 16, fontWeight: '600' },
  meaning: { color: '#555', marginTop: 2 },
  restoreButton: { backgroundColor: '#3949ab', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  restoreText: { color: '#fff', fontWeight: '600' },
});
