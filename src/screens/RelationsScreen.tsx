import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words } from '../data/words';
import { getRelation } from '../data/relations';
import { speakWord } from '../lib/speech';
import { AlphabetIndex, letterStarts } from '../components/AlphabetIndex';
import { SwipeToRemove } from '../components/SwipeToRemove';
import { excludeWord, getExcludedWords } from '../lib/storage';
import { colors, centered } from '../theme';

const meanings = new Map(words.map((w) => [w.word.toLowerCase(), w.meaning]));
const ESTIMATED_CARD = 220; // only a starting guess for a jump into unmeasured cards

function Chip({ word, tone }: { word: string; tone: 'syn' | 'ant' }) {
  const meaning = meanings.get(word.toLowerCase());
  return (
    // Every related word reads aloud too. Hearing "abate" next to "subside" is
    // most of what makes the pair stick, and a silent chip looks broken beside
    // a headword that speaks.
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        tone === 'ant' ? styles.chipAnt : styles.chipSyn,
        pressed && styles.chipPressed,
      ]}
      onPress={() => speakWord(word)}
    >
      <Text style={[styles.chipWord, tone === 'ant' && styles.chipWordAnt]}>{word}</Text>
      {/* A chip only carries a gloss when the related word is on the study
          list too — WordNet reaches well beyond the 3192 words here. */}
      {meaning && <Text style={styles.chipMeaning}>{meaning}</Text>}
    </Pressable>
  );
}

// The label sits at one end of its row and the count at the other, so each
// group announces its own size instead of leaving the line half empty.
function Group({ label, tone, related }: { label: string; tone: 'syn' | 'ant'; related: string[] }) {
  return (
    <>
      <View style={styles.groupHead}>
        <Text style={styles.groupLabel}>{label}</Text>
        <Text style={styles.groupCount}>{related.length}</Text>
      </View>
      {related.length ? (
        <View style={styles.chips}>
          {related.map((w) => (
            <Chip key={`${tone}-${w}`} word={w} tone={tone} />
          ))}
        </View>
      ) : (
        <Text style={styles.none}>尚無{label}</Text>
      )}
    </>
  );
}

export function RelationsScreen() {
  const [query, setQuery] = useState('');
  const [antonymsOnly, setAntonymsOnly] = useState(false);
  const listRef = useRef<FlatList<{ entry: (typeof words)[number]; rel: ReturnType<typeof getRelation> }>>(null);
  const rowCount = useRef(0);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Reloaded on focus so a word restored from the recycle bin comes back here.
  useFocusEffect(
    useCallback(() => {
      getExcludedWords().then((list) => setExcluded(new Set(list)));
    }, [])
  );

  const scrollTo = useCallback((at: number) => {
    if (at < rowCount.current) listRef.current?.scrollToIndex({ index: at, viewPosition: 0 });
  }, []);

  async function handleRemove(word: string) {
    await excludeWord(word);
    setExcluded((current) => new Set(current).add(word));
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = [];
    for (const entry of words) {
      if (excluded.has(entry.word)) continue;
      const rel = getRelation(entry.word);
      if (!rel.syn.length && !rel.ant.length) continue;
      if (antonymsOnly && !rel.ant.length) continue;
      if (q && !entry.word.toLowerCase().includes(q) && !entry.meaning.includes(query.trim())) continue;
      result.push({ entry, rel });
    }
    return result;
  }, [query, antonymsOnly, excluded]);
  rowCount.current = rows.length;

  const starts = useMemo(() => letterStarts(rows, (r) => r.entry.word), [rows]);

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
        {/* Filter and count share one row at opposite ends, rather than
            stacking against the left edge with the right half left empty. */}
        <View style={styles.toolbarRow}>
          <Pressable
            style={[styles.filter, antonymsOnly && styles.filterActive]}
            onPress={() => setAntonymsOnly((v) => !v)}
          >
            <Text style={[styles.filterText, antonymsOnly && styles.filterTextActive]}>只看有反義詞</Text>
          </Pressable>
          <Text style={styles.count}>{rows.length} 個字</Text>
        </View>
      </View>

      <View style={styles.listWrap}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={({ entry }) => entry.word}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>沒有符合的單字。</Text>}
        // Cards vary in height with how many related words they carry, so the
        // list cannot calculate where a far letter is until it has laid it out.
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({
            offset: (averageItemLength || ESTIMATED_CARD) * index,
            animated: false,
          });
          setTimeout(() => scrollTo(index), 80);
        }}
        renderItem={({ item: { entry, rel } }) => (
          <SwipeToRemove label="丟進回收桶 →" onRemove={() => handleRemove(entry.word)}>
          <View style={styles.card}>
            <Pressable style={styles.head} onPress={() => speakWord(entry.word)}>
              <Text style={styles.word}>{entry.word}</Text>
              <Text style={styles.pos}>{entry.pos}</Text>
            </Pressable>
            <Text style={styles.meaning}>{entry.meaning}</Text>

            <Group label="近義詞" tone="syn" related={rel.syn} />
            <Group label="反義詞" tone="ant" related={rel.ant} />
          </View>
          </SwipeToRemove>
        )}
      />
        <AlphabetIndex starts={starts} onJump={scrollTo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  // Same width and alignment as the list below it, so the two do not disagree
  // about where the page edge is.
  toolbar: { ...centered, padding: 16, gap: 10 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
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
  filterTextActive: { color: colors.blueInk },
  count: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  listWrap: { flex: 1, flexDirection: 'row' },
  list: { ...centered, paddingHorizontal: 16, paddingBottom: 36, gap: 12 },
  empty: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  // Word at one end, part of speech at the other, so the card head fills its
  // width instead of bunching everything against the left.
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  word: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  pos: {
    color: colors.blueInk,
    backgroundColor: colors.blue,
    fontSize: 12,
    fontWeight: '900',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  meaning: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 4 },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  groupLabel: { color: colors.ink, fontWeight: '900' },
  groupCount: { color: colors.muted, fontWeight: '900', fontSize: 13 },
  none: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipPressed: { opacity: 0.6 },
  chipSyn: { backgroundColor: colors.blue },
  chipAnt: { backgroundColor: colors.red },
  chipWord: { color: colors.blueInk, fontWeight: '900', fontSize: 15 },
  chipWordAnt: { color: colors.redInk },
  chipMeaning: { color: colors.muted, fontWeight: '700', fontSize: 12, marginTop: 2 },
});
