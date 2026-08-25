import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { concepts, bandOf, BAND_LABEL, type Band, type Concept, type ConceptWord } from '../data/concepts';
import { getExcludedWords } from '../lib/storage';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Relations'>;

const meanings = new Map(words.map((w) => [w.word.toLowerCase(), w.meaning]));
const BANDS: Band[] = ['strong', 'mid', 'weak'];

const zhOf = (id: string | null) => concepts.find((c) => c.id === id)?.zh;

// One representative word per strength, so a shut card teaches the ladder
// instead of listing six English words with nothing to tell them apart.
function ladderOf(list: ConceptWord[]): { band: Band; w: string }[] {
  return BANDS.map((band) => {
    const first = list.find((x) => bandOf(x.lv) === band);
    return first ? { band, w: first.w } : null;
  }).filter(Boolean) as { band: Band; w: string }[];
}

function ConceptCard({
  concept,
  words: list,
  onOpen,
}: {
  concept: Concept;
  words: ConceptWord[];
  onOpen: () => void;
}) {
  const styles = useStyles(makeStyles);
  const oppositeZh = zhOf(concept.opposite);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onOpen}>
      <View style={styles.head}>
        <Text style={styles.zh}>{concept.zh}</Text>
        <Text style={styles.count}>{list.length} 字 ›</Text>
      </View>
      {oppositeZh && <Text style={styles.opposite}>⇄ 相反：{oppositeZh}</Text>}

      {/* The strength label is a single character in its own column, so the
          English lines up down the page and nothing is wrapped in a badge. */}
      <View style={styles.ladder}>
        {ladderOf(list).map(({ band, w }) => (
          <View key={band} style={styles.rung}>
            <Text style={styles.rungBand}>{BAND_LABEL[band]}</Text>
            <View style={styles.rungRule} />
            <Text style={styles.rungWord}>{w}</Text>
            <Text style={styles.rungMeaning} numberOfLines={1}>
              {meanings.get(w.toLowerCase())}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export function RelationsScreen({ navigation }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [oppositesOnly, setOppositesOnly] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Reloaded on focus so a word restored from the recycle bin comes back here.
  useFocusEffect(
    useCallback(() => {
      getExcludedWords().then((list) => setExcluded(new Set(list)));
    }, [])
  );

  const rows = useMemo(() => {
    const q = query.trim();
    const lower = q.toLowerCase();
    const result: { concept: Concept; words: ConceptWord[] }[] = [];
    for (const concept of concepts) {
      if (oppositesOnly && !concept.opposite) continue;
      const kept = concept.words.filter(({ w }) => !excluded.has(w));
      if (!kept.length) continue;
      if (
        q &&
        !concept.zh.includes(q) &&
        !kept.some(({ w }) => w.toLowerCase().includes(lower) || meanings.get(w.toLowerCase())?.includes(q))
      ) {
        continue;
      }
      result.push({ concept, words: kept });
    }
    return result;
  }, [query, oppositesOnly, excluded]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋概念或單字，例如「討厭」或 abhor"
          placeholderTextColor={theme.colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        {/* Filter and count share one row at opposite ends, rather than
            stacking against the left edge with the right half left empty. */}
        <View style={styles.toolbarRow}>
          <Pressable
            style={[styles.filter, oppositesOnly && styles.filterActive]}
            onPress={() => setOppositesOnly((v) => !v)}
          >
            <Text style={[styles.filterText, oppositesOnly && styles.filterTextActive]}>只看有相反概念</Text>
          </Pressable>
          <Text style={styles.total}>{rows.length} 個概念</Text>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={({ concept }) => concept.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>沒有符合的概念。</Text>}
        renderItem={({ item: { concept, words: list } }) => (
          <ConceptCard
            concept={concept}
            words={list}
            onOpen={() => navigation.navigate('Concept', { id: concept.id })}
          />
        )}
      />
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1 },
  // Same width and alignment as the list below it, so the two do not disagree
  // about where the page edge is.
  toolbar: { ...centered, padding: 16, gap: 10 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  input: {
    backgroundColor: t.glass.solid,
    borderWidth: 1,
    borderColor: t.glass.edge,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: t.colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  filter: {
    alignSelf: 'flex-start',
    backgroundColor: t.glass.solid,
    borderWidth: 1,
    borderColor: t.glass.edge,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  filterActive: { backgroundColor: t.colors.blue, borderColor: t.colors.blue },
  filterText: { color: t.colors.muted, fontWeight: '900' },
  filterTextActive: { color: t.colors.blueInk },
  total: { color: t.colors.muted, fontWeight: '700', fontSize: 13 },
  list: { ...centered, paddingHorizontal: 16, paddingBottom: 36, gap: 14 },
  empty: { color: t.colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 40 },
  card: { ...t.pane(26), ...t.glassShadow, backgroundColor: t.glass.solid, paddingHorizontal: 20, paddingVertical: 18 },
  cardPressed: { opacity: 0.72 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  zh: { color: t.colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: 0.5 },
  count: { color: t.colors.muted, fontWeight: '800', fontSize: 13 },
  opposite: { color: t.colors.muted, fontSize: 13, fontWeight: '700', marginTop: 6 },
  ladder: { marginTop: 14, gap: 9 },
  rung: { flexDirection: 'row', alignItems: 'baseline', gap: 11 },
  rungBand: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900', width: 15 },
  // A hairline standing in for the notebook's margin rule, so the eye has one
  // straight edge to run the English down.
  rungRule: { width: 1, alignSelf: 'stretch', backgroundColor: t.colors.line },
  rungWord: { color: t.colors.ink, fontSize: 16, fontWeight: '900', minWidth: 92 },
  rungMeaning: { color: t.colors.muted, fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
