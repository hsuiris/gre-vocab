import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { speakSequence, stopSpeaking } from '../lib/speech';
import { colors, centered } from '../theme';

// Fixed so getItemLayout can exist, which is what lets the A-Z strip and the
// player jump straight to a row in a 3000-item list without measuring it.
const ROW_HEIGHT = 62;
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
      <TextInput
        value={query}
        onChangeText={handleQuery}
        placeholder="搜尋單字或中文意思"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.search}
      />

      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.word}
          getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
          contentContainerStyle={styles.listContent}
          initialNumToRender={20}
          renderItem={({ item, index }) => (
            <Pressable
              style={[styles.row, index === current && styles.rowActive]}
              onPress={() => playAt(index)}
            >
              <Text style={styles.marker}>{index === current && playing ? '▶' : ''}</Text>
              <Text style={styles.word} numberOfLines={1}>
                {item.word}
              </Text>
              <Text style={styles.meaning} numberOfLines={1}>
                {item.meaning}
              </Text>
            </Pressable>
          )}
        />
        <View style={styles.strip}>
          {ALPHABET.map((letter) => {
            const at = letterStarts[letter];
            return (
              <Pressable key={letter} onPress={() => at !== undefined && scrollTo(at)} hitSlop={4}>
                <Text style={at === undefined ? styles.stripLetterOff : styles.stripLetter}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.player}>
        <View style={styles.controls}>
          <Pressable style={styles.stepBtn} onPress={() => step(-1)} hitSlop={6}>
            <Text style={styles.stepText}>⏮</Text>
          </Pressable>
          <Pressable
            style={styles.playBtn}
            onPress={() => (playing ? stop() : playAt(current))}
            hitSlop={6}
          >
            <Text style={styles.playText}>{playing ? '⏸' : '▶'}</Text>
          </Pressable>
          <Pressable style={styles.stepBtn} onPress={() => step(1)} hitSlop={6}>
            <Text style={styles.stepText}>⏭</Text>
          </Pressable>
          <Pressable style={styles.rateBtn} onPress={cycleRate}>
            <Text style={styles.rateText}>{rate.toFixed(2).replace(/0$/, '')}×</Text>
          </Pressable>
        </View>
        <Text style={styles.nowPlaying} numberOfLines={1}>
          {currentEntry ? `${currentEntry.word} · ${current + 1} / ${filtered.length}` : '沒有符合的單字'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...centered, flex: 1, backgroundColor: colors.page, padding: 16, gap: 12 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  listWrap: { flex: 1, flexDirection: 'row' },
  listContent: { paddingBottom: 8 },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  rowActive: { backgroundColor: colors.tint },
  marker: { width: 14, color: colors.green, fontSize: 12, fontWeight: '900' },
  word: { width: 130, color: colors.ink, fontSize: 16, fontWeight: '900' },
  meaning: { flex: 1, color: colors.muted, fontSize: 14, fontWeight: '700' },
  strip: { width: 22, justifyContent: 'center', alignItems: 'center' },
  stripLetter: { color: colors.blue, fontSize: 10, fontWeight: '900', paddingVertical: 1 },
  stripLetterOff: { color: colors.line, fontSize: 10, fontWeight: '900', paddingVertical: 1 },
  player: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  stepBtn: { paddingHorizontal: 6 },
  stepText: { color: colors.ink, fontSize: 22 },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: colors.surface, fontSize: 22 },
  rateBtn: {
    position: 'absolute',
    right: 0,
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  rateText: { color: colors.blue, fontWeight: '900', fontSize: 13 },
  nowPlaying: { color: colors.muted, fontWeight: '900', fontSize: 13, textAlign: 'center' },
});
