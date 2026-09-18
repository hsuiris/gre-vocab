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
import { nextStep, startAt, type PlayPlan } from '../lib/playback';

// Rows size themselves to their example sentence. A fixed height would let
// getItemLayout jump straight to any row, but examples run to 114 characters
// and a fixed height clips them — so the list measures as it goes and
// onScrollToIndexFailed covers the jumps.
const ROW_GAP = 10;
const ESTIMATED_ROW = 116; // only a starting guess for a jump into unmeasured rows
const RATES = [0.75, 1, 1.25];
const REPEATS = [1, 2, 3];

// Four named readings rather than two switches to combine in your head. They
// are still stored as the two flags underneath, because that is what decides
// which parts get spoken.
const CONTENTS = [
  { label: '只有單字', example: false, chinese: false },
  { label: '單字＋例句', example: true, chinese: false },
  { label: '單字＋中文', example: false, chinese: true },
  { label: '單字＋例句＋中文', example: true, chinese: true },
];

// Every choice on the playback panel is the same two-state pill.
function Chip({
  label,
  on,
  onPress,
  a11yLabel,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  // Only where the visible word is too short to stand alone — "開" on its own
  // says nothing about what it turns on.
  a11yLabel?: string;
}) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && theme.slabPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function AllWordsScreen() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [rate, setRate] = useState(1);
  const [showOptions, setShowOptions] = useState(false);
  // Not saved with the settings: a loop over words nobody has ticked yet would
  // be the whole list going round in silence, which is not what anyone left
  // switched on. It starts off every time, along with the ticks.
  const [loop, setLoop] = useState(false);
  // The words ticked for the loop. Held by word rather than by position, so a
  // search or a letter can be changed without losing what was ticked — nobody
  // remembers that a word was "number 40", which is what the two number boxes
  // used to ask for.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList<WordEntry>>(null);

  // The player advances from inside a speech callback, long after the render
  // that started it. Refs, not state, are what that callback can trust.
  const playingRef = useRef(false);
  const rateRef = useRef(1);
  const dataRef = useRef<WordEntry[]>(words);
  const planRef = useRef<PlayPlan>({
    example: true,
    chinese: false,
    repeat: 1,
    loop: false,
    ring: null,
  });

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

  // null while nothing is ticked, which is what makes the loop cover the whole
  // visible list until the reader says otherwise.
  const ring = useMemo(
    () =>
      picked.size === 0
        ? null
        : filtered.map((w, i) => (picked.has(w.word) ? i : -1)).filter((i) => i >= 0),
    [filtered, picked]
  );

  planRef.current = {
    example: settings.playExample,
    chinese: settings.playChinese,
    repeat: settings.playRepeat,
    loop,
    ring,
  };

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

  // `pass` is which reading of this word is playing, for "唸 2 次".
  const playAt = useCallback(
    (at: number, pass = 1) => {
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
      const plan = planRef.current;
      // The translation belongs to the sentence, so turning the example off
      // takes its Chinese with it.
      speakSequence(entry.word, plan.example ? entry.example : '', {
        rate: rateRef.current,
        meaning: plan.chinese ? entry.meaning : undefined,
        exampleZh: plan.chinese ? entry.exampleZh : undefined,
        onDone: () => {
          if (!playingRef.current) return;
          const next = nextStep(at, pass, dataRef.current.length, planRef.current);
          if (next) playAt(next.at, next.pass);
          else stop();
        },
      });
    },
    [scrollTo, stop]
  );

  function togglePicked(word: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(word)) next.add(word);
      return next;
    });
  }

  function updateSettings(patch: Partial<AppSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(next);
  }

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
    setPicked((current) => {
      if (!current.has(word)) return current;
      const next = new Set(current);
      next.delete(word);
      return next;
    });
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
                  {/* Only while looping: the rest of the time it would be a
                      box with nothing to do. Nested inside the row Pressable
                      like the ✕ is, so ticking never starts the word playing. */}
                  {loop && (
                    <Pressable
                      onPress={() => togglePicked(item.word)}
                      hitSlop={10}
                      accessibilityLabel={`循環播放 ${item.word}`}
                      accessibilityState={{ selected: picked.has(item.word) }}
                    >
                      <View style={[styles.tick, picked.has(item.word) && styles.tickOn]}>
                        {picked.has(item.word) && <Text style={styles.tickMark}>✓</Text>}
                      </View>
                    </Pressable>
                  )}
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
        {showOptions && (
          <View style={styles.options}>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>要唸什麼</Text>
              <View style={styles.chips}>
                {CONTENTS.map((choice) => (
                  <Chip
                    key={choice.label}
                    label={choice.label}
                    on={settings.playExample === choice.example && settings.playChinese === choice.chinese}
                    onPress={() =>
                      updateSettings({ playExample: choice.example, playChinese: choice.chinese })
                    }
                  />
                ))}
              </View>
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>每個字唸</Text>
              <View style={styles.chips}>
                {REPEATS.map((n) => (
                  <Chip
                    key={n}
                    label={`${n} 次`}
                    on={settings.playRepeat === n}
                    onPress={() => updateSettings({ playRepeat: n })}
                  />
                ))}
              </View>
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>循環播放</Text>
              <View style={styles.chips}>
                <Chip
                  label={loop ? '開' : '關'}
                  a11yLabel="循環播放"
                  on={loop}
                  onPress={() => setLoop((on) => !on)}
                />
              </View>
            </View>

            {loop && (
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>循環哪些</Text>
                <View style={styles.chips}>
                  <Text style={styles.rangeHint}>
                    {picked.size === 0
                      ? `在清單上勾選要循環的字（沒勾就是全部 ${filtered.length} 個）`
                      : ring && ring.length === 0
                        ? `勾了 ${picked.size} 個字，但都不在目前的清單裡`
                        : `已勾選 ${picked.size} 個字`}
                  </Text>
                  {picked.size > 0 && (
                    <Chip label="清除勾選" on={false} onPress={() => setPicked(new Set())} />
                  )}
                </View>
              </View>
            )}
          </View>
        )}
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
          <Pressable
            style={({ pressed }) => [styles.optionsBtn, showOptions && styles.optionsBtnOn, pressed && theme.slabPressed]}
            onPress={() => setShowOptions((open) => !open)}
            accessibilityLabel="播放設定"
          >
            <Text style={[styles.optionsBtnText, showOptions && styles.optionsBtnTextOn]}>設定</Text>
          </Pressable>
          <View style={styles.transport}>
            <Pressable style={styles.stepBtn} onPress={() => step(-1)} hitSlop={8} accessibilityLabel="上一個字">
              <Text style={styles.stepText}>‹</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.playBtn, pressed && theme.slabPressed]}
              onPress={() =>
                playing ? stop() : playAt(startAt(current, filtered.length, planRef.current))
              }
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
  // was meant to point at; a coloured rim plus a thicker slab edge underneath
  // marks the same row and still lets the word be the loudest thing in it. The
  // edge eats exactly the padding it adds, so nothing shifts when a row lights
  // up — every row's shadow stays under it, never beside it.
  rowActive: {
    backgroundColor: t.colors.surface,
    borderColor: t.slabEdge.blue,
    borderBottomWidth: 6,
    paddingBottom: 9,
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
  options: {
    gap: 10,
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: t.glass.edge,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionLabel: { width: 66, color: t.colors.muted, fontSize: 12, fontWeight: '900' },
  chips: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: {
    ...t.slab(t.slabEdge.line),
    backgroundColor: t.colors.inset,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { ...t.slab(t.slabEdge.blue), backgroundColor: t.colors.blue },
  chipText: { color: t.colors.muted, fontSize: 12.5, fontWeight: '900' },
  chipTextOn: { color: t.colors.blueInk },
  rangeHint: { flexShrink: 1, color: t.colors.muted, fontSize: 11.5, fontWeight: '700' },
  tick: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: t.slabEdge.line,
    backgroundColor: t.colors.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOn: { borderColor: t.slabEdge.blue, backgroundColor: t.colors.blue },
  tickMark: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900', lineHeight: 16 },
  optionsBtn: {
    width: 58,
    alignItems: 'center',
    backgroundColor: t.colors.inset,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.glass.edge,
    paddingVertical: 8,
  },
  optionsBtnOn: { backgroundColor: t.colors.blue, borderColor: t.slabEdge.blue },
  optionsBtnText: { color: t.colors.muted, fontWeight: '900', fontSize: 13 },
  optionsBtnTextOn: { color: t.colors.blueInk },
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
