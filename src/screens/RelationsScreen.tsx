import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words } from '../data/words';
import { concepts, bandOf, BAND_LABEL, type Band, type Concept, type ConceptWord } from '../data/concepts';
import { speakWord } from '../lib/speech';
import { getExcludedWords } from '../lib/storage';
import { colors, centered } from '../theme';

const meanings = new Map(words.map((w) => [w.word.toLowerCase(), w.meaning]));
const BANDS: Band[] = ['strong', 'mid', 'weak'];
const PREVIEW = 6;
const ESTIMATED_CARD = 150; // only a starting guess for a jump into unmeasured cards

const zhOf = (id: string | null) => concepts.find((c) => c.id === id)?.zh;

// Tapping a word reads it aloud. Hearing "abhor" and "dislike" back to back is
// most of what teaches the gap between them, which is the whole point of a
// screen that sorts by strength.
function WordRow({ w }: { w: string }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => speakWord(w)}>
      <Text style={styles.rowWord}>{w}</Text>
      <Text style={styles.rowMeaning} numberOfLines={1}>
        {meanings.get(w.toLowerCase())}
      </Text>
    </Pressable>
  );
}

function ConceptCard({
  concept,
  words: list,
  open,
  onToggle,
  onJump,
}: {
  concept: Concept;
  words: ConceptWord[];
  open: boolean;
  onToggle: () => void;
  onJump: (id: string) => void;
}) {
  const oppositeZh = zhOf(concept.opposite);
  return (
    <View style={styles.card}>
      {/* Name at one end, count at the other, so the head fills its width
          instead of bunching against the left edge. */}
      <Pressable style={styles.head} onPress={onToggle}>
        <Text style={styles.zh}>{concept.zh}</Text>
        <Text style={styles.count}>
          {list.length} 字 {open ? '▾' : '▸'}
        </Text>
      </Pressable>

      {oppositeZh && (
        <Pressable style={styles.opposite} onPress={() => onJump(concept.opposite!)}>
          <Text style={styles.oppositeText}>⇄ 相反：{oppositeZh}</Text>
        </Pressable>
      )}

      {open ? (
        BANDS.map((band) => {
          const inBand = list.filter((x) => bandOf(x.lv) === band);
          if (!inBand.length) return null;
          return (
            <View key={band}>
              <Text style={styles.band}>{BAND_LABEL[band]}</Text>
              {inBand.map(({ w }) => (
                <WordRow key={w} w={w} />
              ))}
            </View>
          );
        })
      ) : (
        // Collapsed, the card shows only the strongest few words as bare chips.
        // A concept averages around 45 words; opening all of them by default
        // buries every other concept below one screenful of scrolling.
        <View style={styles.chips}>
          {list.slice(0, PREVIEW).map(({ w }) => (
            <Text key={w} style={styles.chip}>
              {w}
            </Text>
          ))}
          {list.length > PREVIEW && <Text style={styles.more}>+{list.length - PREVIEW}</Text>}
        </View>
      )}
    </View>
  );
}

export function RelationsScreen() {
  const [query, setQuery] = useState('');
  const [oppositesOnly, setOppositesOnly] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const listRef = useRef<FlatList<{ concept: Concept; words: ConceptWord[] }>>(null);

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

  // A search already narrows the list to a few cards, so leaving them shut
  // would hide the very word that was searched for.
  const searching = query.trim().length > 0;

  function jumpTo(id: string) {
    setQuery('');
    setOppositesOnly(false);
    setOpen((current) => new Set(current).add(id));
    setPendingJump(id);
  }

  // The scroll waits for the cleared filters to produce their new rows, so the
  // index it lands on is the one the list is actually rendering.
  useEffect(() => {
    if (!pendingJump) return;
    const at = rows.findIndex((r) => r.concept.id === pendingJump);
    if (at >= 0) listRef.current?.scrollToIndex({ index: at, viewPosition: 0 });
    setPendingJump(null);
  }, [pendingJump, rows]);

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜尋概念或單字，例如「討厭」或 abhor"
          placeholderTextColor={colors.muted}
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
        ref={listRef}
        data={rows}
        keyExtractor={({ concept }) => concept.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>沒有符合的概念。</Text>}
        // An open card is many times the height of a shut one, so the list
        // cannot work out where a far card sits until it has laid it out.
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({
            offset: (averageItemLength || ESTIMATED_CARD) * index,
            animated: false,
          });
          setTimeout(() => setPendingJump(rows[index]?.concept.id ?? null), 80);
        }}
        renderItem={({ item: { concept, words: list } }) => (
          <ConceptCard
            concept={concept}
            words={list}
            open={searching || open.has(concept.id)}
            onToggle={() => toggle(concept.id)}
            onJump={jumpTo}
          />
        )}
      />
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
  total: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  list: { ...centered, paddingHorizontal: 16, paddingBottom: 36, gap: 12 },
  empty: { color: colors.muted, fontWeight: '700', textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  zh: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  count: { color: colors.muted, fontWeight: '900', fontSize: 13 },
  opposite: { alignSelf: 'flex-start', marginTop: 8 },
  oppositeText: {
    color: colors.redInk,
    backgroundColor: colors.red,
    fontSize: 13,
    fontWeight: '900',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  band: { color: colors.muted, fontWeight: '900', fontSize: 12, marginTop: 14, marginBottom: 2 },
  // Word left, gloss right: the eye runs down one column of English while the
  // Chinese stays available, which is how the strength ladder stays readable.
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 6 },
  rowPressed: { opacity: 0.6 },
  rowWord: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  rowMeaning: { color: colors.muted, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: colors.blue,
    color: colors.blueInk,
    fontWeight: '900',
    fontSize: 14,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  more: { color: colors.muted, fontWeight: '900', fontSize: 13, alignSelf: 'center' },
});
