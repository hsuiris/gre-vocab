import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { speakSequence, stopSpeaking } from '../lib/speech';
import { AlphabetIndex, letterStarts } from '../components/AlphabetIndex';
import { excludeWord, getExcludedWords } from '../lib/storage';
import { colors, centered, slab, slabEdge, slabPressed } from '../theme';

// Rows size themselves to their example sentence. A fixed height would let
// getItemLayout jump straight to any row, but examples run to 114 characters
// and a fixed height clips them — so the list measures as it goes and
// onScrollToIndexFailed covers the jumps.
const ROW_GAP = 10;
const ESTIMATED_ROW = 116; // only a starting guess for a jump into unmeasured rows
const RATES = [0.75, 1, 1.25];

export function AllWordsScreen() {
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rate, setRate] = useState(1);
  const listRef = useRef<FlatList<WordEntry>>(null);

  // The player advances from inside a speech callback, long after the render
  // that started it. Refs, not state, are what that callback can trust.
  const playingRef = useRef(false);
  const rateRef = useRef(1);
  const dataRef = useRef<WordEntry[]>(words);

  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Reloaded on focus so a word restored from the recycle bin reappears here.
  useFocusEffect(
    useCallback(() => {
      getExcludedWords().then((list) => setExcluded(new Set(list)));
    }, [])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kept = excluded.size ? words.filter((w) => !excluded.has(w.word)) : words;
    if (!q) return kept;
    return kept.filter((w) => w.word.toLowerCase().includes(q) || w.meaning.includes(q));
  }, [query, excluded]);
  dataRef.current = filtered;

  const starts = useMemo(() => letterStarts(filtered, (w) => w.word), [filtered]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopSpeaking();
  }, []);

  // Leaving the screen must silence it — expo-speech keeps reading otherwise.
  useFocusEffect(useCallback(() => stop, [stop]));

  const scrollTo = useCallback((at: number) => {
    if (at < dataRef.current.length) listRef.current?.scrollToIndex({ index: at, viewPosition: 0.5 });
  }, []);

  const playAt = useCallback(
    (at: number) => {
      const list = dataRef.current;
      if (at < 0 || at >= list.length) {
        stop();
        return;
      }
      playingRef.current = true;
      setPlaying(true);
      setCurrent(at);
      scrollTo(at);
      const entry = list[at];
      speakSequence([entry.word, entry.example], {
        rate: rateRef.current,
        onDone: () => {
          if (playingRef.current) playAt(at + 1);
        },
      });
    },
    [scrollTo, stop]
  );

  async function handleRemove(word: string) {
    // Every index the player holds points into the old list, so stop rather
    // than let it carry on reading from a shifted position.
    stop();
    await excludeWord(word);
    setExcluded((current) => new Set(current).add(word));
    setCurrent(0);
  }

  function handleQuery(text: string) {
    // The index the player is on means nothing once the list underneath changes.
    stop();
    setQuery(text);
    setCurrent(0);
  }

  function step(delta: number) {
    const next = current + delta;
    if (next < 0 || next >= filtered.length) return;
    if (playing) playAt(next);
    else {
      setCurrent(next);
      scrollTo(next);
    }
  }

  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    rateRef.current = next;
    setRate(next);
    if (playingRef.current) playAt(current); // restart this word at the new speed
  }

  const currentEntry = filtered[current];

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={handleQuery}
          placeholder="搜尋單字或中文意思"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
        {query.length > 0 && (
          <Pressable onPress={() => handleQuery('')} hitSlop={8}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.word}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          showsVerticalScrollIndicator={false}
          // Rows are measured, not calculated, so a jump to a far letter lands
          // on a row the list has never laid out. Approximate, then ask again
          // once it has caught up.
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            listRef.current?.scrollToOffset({
              offset: (averageItemLength || ESTIMATED_ROW) * index,
              animated: false,
            });
            setTimeout(() => scrollTo(index), 80);
          }}
          renderItem={({ item, index }) => {
            const active = index === current;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && slabPressed]}
                onPress={() => playAt(index)}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.word} numberOfLines={1}>
                    {item.word}
                  </Text>
                  <Text style={styles.pos}>{item.pos}</Text>
                  {active && playing && <Text style={styles.marker}>▶ 播放中</Text>}
                </View>
                <Text style={styles.meaning} numberOfLines={1}>
                  {item.meaning}
                </Text>
                <Text style={styles.example}>{item.example}</Text>
                {/* Nested inside the row on purpose: the touch responder hands
                    the press to the innermost button, so binning a word never
                    starts it playing. */}
                <Pressable
                  style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                  onPress={() => handleRemove(item.word)}
                  hitSlop={10}
                  accessibilityLabel={`把 ${item.word} 丟進回收桶`}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
        <AlphabetIndex starts={starts} onJump={scrollTo} />
      </View>

      <View style={styles.player}>
        <View style={styles.nowRow}>
          <Text style={styles.nowWord} numberOfLines={1}>
            {currentEntry ? currentEntry.word : '沒有符合的單字'}
          </Text>
          <Text style={styles.nowCount}>
            {filtered.length > 0 ? `${current + 1} / ${filtered.length}` : ''}
          </Text>
        </View>
        {currentEntry && (
          <Text style={styles.nowMeaning} numberOfLines={1}>
            {currentEntry.meaning}
          </Text>
        )}
        <View style={styles.controls}>
          {/* Balances the rate pill so the transport stays optically centred. */}
          <View style={styles.ratePlaceholder} />
          <View style={styles.transport}>
            <Pressable style={styles.stepBtn} onPress={() => step(-1)} hitSlop={8}>
              <Text style={styles.stepText}>⏮</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.playBtn, pressed && slabPressed]}
              onPress={() => (playing ? stop() : playAt(current))}
              hitSlop={8}
            >
              <Text style={styles.playText}>{playing ? '⏸' : '▶'}</Text>
            </Pressable>
            <Pressable style={styles.stepBtn} onPress={() => step(1)} hitSlop={8}>
              <Text style={styles.stepText}>⏭</Text>
            </Pressable>
          </View>
          <Pressable style={styles.rateBtn} onPress={cycleRate}>
            <Text style={styles.rateText}>{rate.toFixed(2).replace(/0$/, '')}×</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...centered, flex: 1, backgroundColor: colors.page, padding: 16, gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  searchIcon: { fontSize: 15 },
  search: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '700' },
  clear: { color: colors.muted, fontSize: 15, fontWeight: '900' },
  listWrap: { flex: 1, flexDirection: 'row', gap: 4 },
  listContent: { paddingBottom: 4 },
  row: {
    marginBottom: ROW_GAP,
    paddingVertical: 12,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    ...slab(slabEdge.line),
    paddingHorizontal: 16,
  },
  rowActive: { backgroundColor: colors.blue, borderColor: slabEdge.blue, borderBottomColor: slabEdge.blue },
  // Clears the corner button, so a long word never runs underneath it.
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 26 },
  // Red is what this palette already uses for "remove", and a filled circle
  // reads as a button at a glance — the swipe it replaces was invisible.
  remove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { backgroundColor: slabEdge.red },
  removeText: { color: colors.redInk, fontSize: 13, fontWeight: '900' },
  word: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  pos: {
    color: colors.blueInk,
    backgroundColor: colors.blue,
    fontSize: 11,
    fontWeight: '900',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  marker: { color: colors.blueInk, fontSize: 11, fontWeight: '900' },
  meaning: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 5 },
  example: { color: colors.ink, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic', marginTop: 6 },
  player: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 4,
  },
  nowRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  nowWord: { flex: 1, color: colors.ink, fontSize: 19, fontWeight: '900' },
  nowCount: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  nowMeaning: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  ratePlaceholder: { width: 58 },
  stepBtn: { paddingHorizontal: 4 },
  stepText: { color: colors.ink, fontSize: 22 },
  playBtn: {
    ...slab(slabEdge.blue),
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: colors.blueInk, fontSize: 22 },
  rateBtn: {
    width: 58,
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 8,
  },
  rateText: { color: colors.blueInk, fontWeight: '900', fontSize: 13 },
});
