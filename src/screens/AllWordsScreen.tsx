import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words, WordEntry } from '../data/words';
import { speakSequence, stopSpeaking } from '../lib/speech';
import { AlphabetIndex, letterStarts } from '../components/AlphabetIndex';
import { excludeWord, getExcludedWords, getSettings, saveSettings, defaultSettings } from '../lib/storage';
import type { AppSettings } from '../lib/storage';
import { ConfirmBin } from '../components/ConfirmBin';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

// Rows size themselves to their example sentence. A fixed height would let
// getItemLayout jump straight to any row, but examples run to 114 characters
// and a fixed height clips them — so the list measures as it goes and
// onScrollToIndexFailed covers the jumps.
const ROW_GAP = 10;
const ESTIMATED_ROW = 116; // only a starting guess for a jump into unmeasured rows
const RATES = [0.75, 1, 1.25];

export function AllWordsScreen() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
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
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  // The word waiting on an answer from the confirm sheet.
  const [pending, setPending] = useState<string | null>(null);

  // Reloaded on focus so a word restored from the recycle bin reappears here.
  useFocusEffect(
    useCallback(() => {
      getExcludedWords().then((list) => setExcluded(new Set(list)));
      getSettings().then(setSettings);
    }, [])
  );

  // Everything the search and the recycle bin leave behind. The letter rail
  // narrows this further, but it is what decides which letters exist at all.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kept = excluded.size ? words.filter((w) => !excluded.has(w.word)) : words;
    if (!q) return kept;
    return kept.filter((w) => w.word.toLowerCase().includes(q) || w.meaning.includes(q));
  }, [query, excluded]);

  // Picking a letter shows that letter, rather than scrolling to it. Scrolling
  // 3192 unmeasured rows to reach W meant the list rendered its way there in
  // front of you; showing only W is instant and cannot land in the wrong place.
  const filtered = useMemo(
    () => (letter ? base.filter((w) => w.word[0]?.toUpperCase() === letter) : base),
    [base, letter]
  );
  dataRef.current = filtered;

  const starts = useMemo(() => letterStarts(base, (w) => w.word), [base]);

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopSpeaking();
  }, []);

  // Leaving the screen must silence it — expo-speech keeps reading otherwise.
  useFocusEffect(useCallback(() => stop, [stop]));

  // Where the last requested jump wanted the row to land, so the retry below
  // repeats the same jump rather than a centred one.
  const viewRef = useRef(0.5);

  // Never animated. Animating a jump from A to W scrolls the list through three
  // thousand rows on screen, which is what made a letter tap take so long.
  const scrollTo = useCallback((at: number, viewPosition = 0.5) => {
    if (at >= dataRef.current.length) return;
    viewRef.current = viewPosition;
    listRef.current?.scrollToIndex({ index: at, viewPosition, animated: false });
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
      speakSequence(entry.word, entry.example, {
        rate: rateRef.current,
        onDone: () => {
          if (playingRef.current) playAt(at + 1);
        },
      });
    },
    [scrollTo, stop]
  );

  // A cross asks first, unless the reader has ticked it off in the sheet.
  function askRemove(word: string) {
    if (settings.confirmBeforeBin) setPending(word);
    else handleRemove(word);
  }

  async function confirmRemove(dontAskAgain: boolean) {
    const word = pending;
    setPending(null);
    if (!word) return;
    if (dontAskAgain) {
      const next = { ...settings, confirmBeforeBin: false };
      setSettings(next);
      await saveSettings(next);
    }
    await handleRemove(word);
  }

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
    setLetter(null);
    setCurrent(0);
  }

  function pickLetter(next: string | null) {
    if (next === letter) return;
    stop();
    setLetter(next);
    setCurrent(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
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
          placeholderTextColor={theme.colors.muted}
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

      {letter && (
        <Pressable style={styles.letterChip} onPress={() => pickLetter(null)}>
          <Text style={styles.letterChipText}>
            {letter} 開頭 · {filtered.length} 個字
          </Text>
          <Text style={styles.letterChipClear}>✕</Text>
        </Pressable>
      )}

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
            setTimeout(() => scrollTo(index, viewRef.current), 80);
          }}
          renderItem={({ item, index }) => {
            const active = index === current;
            return (
              <Pressable
                style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && theme.slabPressed]}
                onPress={() => playAt(index)}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.word} numberOfLines={1}>
                    {item.word}
                  </Text>
                  <Text style={styles.pos}>{item.pos}</Text>
                  {active && playing && <Text style={styles.marker}>播放中</Text>}
                </View>
                <Text style={styles.meaning} numberOfLines={1}>
                  {item.meaning}
                </Text>
                <Text style={styles.example}>{item.example}</Text>
                {item.exampleZh && <Text style={styles.exampleZh}>{item.exampleZh}</Text>}
                {/* Nested inside the row on purpose: the touch responder hands
                    the press to the innermost button, so binning a word never
                    starts it playing. */}
                <Pressable
                  style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                  onPress={() => askRemove(item.word)}
                  hitSlop={10}
                  accessibilityLabel={`把 ${item.word} 移到已熟悉字庫`}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
        <AlphabetIndex starts={starts} selected={letter} onPick={pickLetter} />
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
            <Pressable style={styles.stepBtn} onPress={() => step(-1)} hitSlop={8} accessibilityLabel="上一個字">
              <Text style={styles.stepText}>‹</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.playBtn, pressed && theme.slabPressed]}
              onPress={() => (playing ? stop() : playAt(current))}
              hitSlop={8}
            >
              {/* Drawn, not typed: a play glyph renders as a colour emoji on
                  some platforms and as a bare triangle on others. */}
              {playing ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playIcon} />
              )}
            </Pressable>
            <Pressable style={styles.stepBtn} onPress={() => step(1)} hitSlop={8} accessibilityLabel="下一個字">
              <Text style={styles.stepText}>›</Text>
            </Pressable>
          </View>
          <Pressable style={styles.rateBtn} onPress={cycleRate}>
            <Text style={styles.rateText}>{rate.toFixed(2).replace(/0$/, '')}×</Text>
          </Pressable>
        </View>
      </View>

      {pending && (
        <ConfirmBin
          message="確定要刪除這個單字，移到已熟悉的單字表中嗎？"
          note={`「${pending}」會收進設定頁的「已熟悉字庫」，隨時可以放回來。`}
          onCancel={() => setPending(null)}
          onConfirm={confirmRemove}
        />
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { ...centered, flex: 1, padding: 16, gap: 12 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.glass.solid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.glass.edge,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  searchIcon: { fontSize: 15 },
  search: { flex: 1, color: t.colors.ink, fontSize: 16, fontWeight: '700' },
  clear: { color: t.colors.muted, fontSize: 15, fontWeight: '900' },
  letterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: t.colors.blue,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  letterChipText: { color: t.colors.blueInk, fontWeight: '900', fontSize: 13 },
  letterChipClear: { color: t.colors.blueInk, fontWeight: '900', fontSize: 13 },
  listWrap: { flex: 1, flexDirection: 'row', gap: 4 },
  listContent: { paddingBottom: 4 },
  row: {
    marginBottom: ROW_GAP,
    paddingVertical: 12,
    justifyContent: 'center',
    backgroundColor: t.glass.solid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.glass.edge,
    ...t.slab(t.slabEdge.line),
    paddingHorizontal: 16,
  },
  // Selected is an outline, not a fill. A saturated block swallowed the row it
  // was meant to point at; a coloured rim plus a bar down the left edge marks
  // the same row and still lets the word be the loudest thing in it. The bar
  // eats exactly the padding it adds, so nothing shifts when a row lights up.
  rowActive: {
    backgroundColor: t.colors.surface,
    borderColor: t.slabEdge.blue,
    borderBottomColor: t.slabEdge.blue,
    borderLeftWidth: 5,
    borderLeftColor: t.slabEdge.blue,
    paddingLeft: 12,
  },
  // Clears the corner button, so a long word never runs underneath it.
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 26 },
  // Red is what this palette already uses for "remove", and a filled circle
  // reads as a button at a glance — the swipe it replaces was invisible.
  // Just the cross, no disc behind it: a pink pill in every row's corner was
  // reading as a badge rather than as something to press.
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePressed: { opacity: 0.5 },
  removeText: { color: t.colors.redInk, fontSize: 17, fontWeight: '900' },
  word: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  pos: {
    color: t.colors.blueInk,
    backgroundColor: t.colors.blue,
    fontSize: 11,
    fontWeight: '900',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  marker: { color: t.colors.blueInk, fontSize: 11, fontWeight: '900' },
  meaning: { color: t.colors.muted, fontSize: 14, fontWeight: '700', marginTop: 5 },
  example: { color: t.colors.ink, fontSize: 12.5, lineHeight: 18, fontStyle: 'italic', marginTop: 6 },
  // Upright and quieter than the English above it, so the pair reads as a
  // sentence and its translation rather than as two sentences.
  exampleZh: { color: t.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  player: {
    backgroundColor: t.glass.solid,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: t.glass.edge,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 4,
  },
  nowRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  nowWord: { flex: 1, color: t.colors.ink, fontSize: 19, fontWeight: '900' },
  nowCount: { color: t.colors.muted, fontSize: 13, fontWeight: '900' },
  nowMeaning: { color: t.colors.muted, fontSize: 13, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  ratePlaceholder: { width: 58 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: t.colors.blueInk, fontSize: 30, lineHeight: 34, fontWeight: '400' },
  playBtn: {
    ...t.slab(t.slabEdge.blue),
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: t.colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A triangle built from borders, so it is the same shape on every device.
  playIcon: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 17,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: t.colors.blueInk,
    marginLeft: 5, // a triangle looks off-centre when its box is centred
  },
  pauseIcon: { flexDirection: 'row', gap: 5 },
  pauseBar: { width: 5, height: 18, borderRadius: 3, backgroundColor: t.colors.blueInk },
  rateBtn: {
    width: 58,
    alignItems: 'center',
    backgroundColor: t.colors.blue,
    borderRadius: 14,
    paddingVertical: 8,
  },
  rateText: { color: t.colors.blueInk, fontWeight: '900', fontSize: 13 },
});
