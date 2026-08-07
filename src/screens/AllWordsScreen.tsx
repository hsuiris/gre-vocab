import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { speakSequence, stopSpeaking } from '../lib/speech';
import { colors, centered, slab, slabEdge, slabPressed } from '../theme';

// Fixed so getItemLayout can exist, which is what lets the A-Z strip and the
// player jump straight to a row in a 3000-item list without measuring it.
// Card height plus the gap below it.
const CARD_HEIGHT = 96;
const ROW_GAP = 10;
const ROW_HEIGHT = CARD_HEIGHT + ROW_GAP;
const RATES = [0.75, 1, 1.25];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return words;
    return words.filter((w) => w.word.toLowerCase().includes(q) || w.meaning.includes(q));
  }, [query]);
  dataRef.current = filtered;

  const letterStarts = useMemo(() => {
    const starts: Record<string, number> = {};
    filtered.forEach((w, i) => {
      const letter = w.word[0].toUpperCase();
      if (starts[letter] === undefined) starts[letter] = i;
    });
    return starts;
  }, [filtered]);

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
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          showsVerticalScrollIndicator={false}
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
                <Text style={styles.example} numberOfLines={1}>
                  {item.example}
                </Text>
              </Pressable>
            );
          }}
        />
        <View style={styles.strip}>
          {ALPHABET.map((letter) => {
            const at = letterStarts[letter];
            return (
              <Pressable key={letter} onPress={() => at !== undefined && scrollTo(at)} hitSlop={3}>
                <Text style={at === undefined ? styles.stripLetterOff : styles.stripLetter}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
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
    // CARD_HEIGHT already counts the 4pt lip, so getItemLayout stays right.
    height: CARD_HEIGHT,
    marginBottom: ROW_GAP,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    ...slab(slabEdge.line),
    paddingHorizontal: 16,
  },
  rowActive: { backgroundColor: colors.tint, borderColor: colors.blue, borderBottomColor: slabEdge.blue },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  pos: {
    color: colors.blue,
    backgroundColor: colors.blueSoft,
    fontSize: 11,
    fontWeight: '900',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  marker: { color: colors.blue, fontSize: 11, fontWeight: '900' },
  meaning: { color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 5 },
  example: { color: colors.ink, fontSize: 12.5, fontStyle: 'italic', marginTop: 6 },
  strip: { width: 20, justifyContent: 'center', alignItems: 'center' },
  stripLetter: { color: colors.blue, fontSize: 10, fontWeight: '900', paddingVertical: 1 },
  stripLetterOff: { color: colors.line, fontSize: 10, fontWeight: '900', paddingVertical: 1 },
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
  playText: { color: colors.surface, fontSize: 22 },
  rateBtn: {
    width: 58,
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    paddingVertical: 8,
  },
  rateText: { color: colors.blue, fontWeight: '900', fontSize: 13 },
});
