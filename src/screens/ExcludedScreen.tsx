import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { getExcludedWords, restoreWord } from '../lib/storage';
import { Mascot } from '../components/Mascot';
import { GlassFill } from '../components/Glass';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

export function ExcludedScreen() {
  const styles = useStyles(makeStyles);
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
      <Text style={styles.eyebrow}>標成太簡單的字</Text>
      <Text style={styles.title}>已熟悉字庫</Text>
      {excluded.length === 0 ? (
        <View style={styles.emptyCard}>
          <GlassFill />
          <Mascot size={112} message="一個字都沒丟掉" />
          <Text style={styles.emptyTitle}>現在很乾淨</Text>
          <Text style={styles.empty}>目前還沒有標成太簡單的字</Text>
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

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { ...centered, flex: 1, padding: 20 },
  eyebrow: { color: t.colors.blueInk, fontSize: 14, fontWeight: '900' },
  title: { color: t.colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4, marginBottom: 16 },
  emptyCard: { ...t.pane(24), ...t.glassShadow, padding: 24, alignItems: 'center' },
  emptyTitle: { color: t.colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  empty: { color: t.colors.muted, marginTop: 8, textAlign: 'center', fontWeight: '700' },
  list: { gap: 10, paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.glass.solid,
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.glass.edge,
  },
  rowText: { flex: 1, marginRight: 12 },
  word: { color: t.colors.ink, fontSize: 17, fontWeight: '900' },
  meaning: { color: t.colors.muted, marginTop: 4, fontWeight: '700' },
  restoreButton: { backgroundColor: t.colors.blue, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16 },
  restoreText: { color: t.colors.blueInk, fontWeight: '900' },
});
