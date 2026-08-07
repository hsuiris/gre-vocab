import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { words } from '../data/words';
import { getRelation } from '../data/relations';
import { speakWord } from '../lib/speech';
import { colors, centered } from '../theme';

const meanings = new Map(words.map((w) => [w.word.toLowerCase(), w.meaning]));

function Chip({ word, tone }: { word: string; tone: 'syn' | 'ant' }) {
  const meaning = meanings.get(word.toLowerCase());
  return (
    <View style={[styles.chip, tone === 'ant' ? styles.chipAnt : styles.chipSyn]}>
      <Text style={[styles.chipWord, tone === 'ant' && styles.chipWordAnt]}>{word}</Text>
      {/* A chip only carries a gloss when the related word is on the study
          list too — WordNet reaches well beyond the 3192 words here. */}
      {meaning && <Text style={styles.chipMeaning}>{meaning}</Text>}
    </View>
  );
}

export function RelationsScreen() {
  const [query, setQuery] = useState('');
  const [antonymsOnly, setAntonymsOnly] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = [];
    for (const entry of words) {
      const rel = getRelation(entry.word);
      if (!rel.syn.length && !rel.ant.length) continue;
      if (antonymsOnly && !rel.ant.length) continue;
      if (q && !entry.word.toLowerCase().includes(q) && !entry.meaning.includes(query.trim())) continue;
      result.push({ entry, rel });
    }
    return result;
  }, [query, antonymsOnly]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋單字或中文意思"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Pressable
          style={[styles.filter, antonymsOnly && styles.filterActive]}
          onPress={() => setAntonymsOnly((v) => !v)}
        >
          <Text style={[styles.filterText, antonymsOnly && styles.filterTextActive]}>只看有反義詞</Text>
        </Pressable>
        <Text style={styles.count}>{rows.length} 個字</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={({ entry }) => entry.word}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>沒有符合的單字。</Text>}
        renderItem={({ item: { entry, rel } }) => (
          <View style={styles.card}>
            <Pressable style={styles.head} onPress={() => speakWord(entry.word)}>
              <Text style={styles.word}>{entry.word}</Text>
              <Text style={styles.pos}>{entry.pos}</Text>
            </Pressable>
            <Text style={styles.meaning}>{entry.meaning}</Text>

            <Text style={styles.groupLabel}>近義詞</Text>
            {rel.syn.length ? (
              <View style={styles.chips}>
                {rel.syn.map((w) => (
                  <Chip key={`syn-${w}`} word={w} tone="syn" />
                ))}
              </View>
            ) : (
              <Text style={styles.none}>尚無近義詞</Text>
            )}

            <Text style={styles.groupLabel}>反義詞</Text>
            {rel.ant.length ? (
              <View style={styles.chips}>
                {rel.ant.map((w) => (
                  <Chip key={`ant-${w}`} word={w} tone="ant" />
                ))}
              </View>
            ) : (
              <Text style={styles.none}>尚無反義詞</Text>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  toolbar: { padding: 16, gap: 10 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 18,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  filter: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterText: { color: colors.muted, fontWeight: '900' },
  filterTextActive: { color: colors.surface },
  count: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  list: { ...centered, paddingHorizontal: 16, paddingBottom: 36, gap: 12 },
  empty: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  word: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  pos: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  meaning: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 4 },
  groupLabel: { color: colors.ink, fontWeight: '900', marginTop: 14, marginBottom: 8 },
  none: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipSyn: { backgroundColor: colors.blueSoft },
  chipAnt: { backgroundColor: colors.redSoft },
  chipWord: { color: colors.blue, fontWeight: '900', fontSize: 15 },
  chipWordAnt: { color: colors.red },
  chipMeaning: { color: colors.muted, fontWeight: '700', fontSize: 12, marginTop: 2 },
});
