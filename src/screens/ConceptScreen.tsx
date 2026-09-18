import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { concepts, bandOf, BAND_LABEL, type Band } from '../data/concepts';
import { getRelation } from '../data/relations';
import { getExcludedWords } from '../lib/storage';
import { speakExample, speakWord } from '../lib/speech';
import { posLabel } from '../lib/pos';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Concept'>;

const entries = new Map(words.map((w) => [w.word.toLowerCase(), w]));
const BANDS: Band[] = ['strong', 'mid', 'weak'];

// What a page of a student's notebook actually holds: a heading for the section
// it belongs to, then one written-up entry per word.
type Line = { kind: 'band'; band: Band; count: number } | { kind: 'word'; word: string; last: boolean };

export function ConceptScreen({ navigation, route }: Props) {
  const styles = useStyles(makeStyles);
  const concept = concepts.find((c) => c.id === route.params.id);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      getExcludedWords().then((list) => setExcluded(new Set(list)));
    }, [])
  );

  const opposite = concepts.find((c) => c.id === concept?.opposite);

  const lines = useMemo<Line[]>(() => {
    if (!concept) return [];
    const kept = concept.words.filter(({ w }) => !excluded.has(w));
    const out: Line[] = [];
    for (const band of BANDS) {
      const inBand = kept.filter((x) => bandOf(x.lv) === band);
      if (!inBand.length) continue;
      out.push({ kind: 'band', band, count: inBand.length });
      inBand.forEach(({ w }, i) => out.push({ kind: 'word', word: w, last: i === inBand.length - 1 }));
    }
    return out;
  }, [concept, excluded]);

  if (!concept) return null;

  const total = lines.filter((l) => l.kind === 'word').length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={lines}
        keyExtractor={(line) => (line.kind === 'band' ? `band-${line.band}` : `w-${line.word}`)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.zh}>{concept.zh}</Text>
            <Text style={styles.total}>{total} 個字</Text>
            {opposite && (
              <Pressable
                style={styles.opposite}
                // push, not navigate: the same screen with a different concept,
                // so going back returns to the one you came from.
                onPress={() => navigation.push('Concept', { id: opposite.id })}
              >
                <Text style={styles.oppositeText}>⇄ 意思相反的是「{opposite.zh}」</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'band' ? (
            <View style={styles.bandRow}>
              <Text style={styles.bandLabel}>{BAND_LABEL[item.band]}</Text>
              <View style={styles.bandRule} />
              <Text style={styles.bandCount}>{item.count} 字</Text>
            </View>
          ) : (
            <WordNote word={item.word} last={item.last} excluded={excluded} />
          )
        }
      />
    </View>
  );
}

// One notebook entry: the word, what it means, then the words a reader would
// otherwise have to look up separately. A binned word is gone from this screen
// entirely, so it cannot come back in through someone else's synonym list.
function WordNote({ word, last, excluded }: { word: string; last: boolean; excluded: Set<string> }) {
  const styles = useStyles(makeStyles);
  const entry = entries.get(word.toLowerCase());
  const relation = getRelation(word);
  const syn = relation.syn.filter((w) => !excluded.has(w));
  const ant = relation.ant.filter((w) => !excluded.has(w));
  if (!entry) return null;
  return (
    <View style={[styles.note, last && styles.noteLast]}>
      <Pressable style={styles.noteHead} onPress={() => speakWord(entry.word)} hitSlop={6}>
        <Text style={styles.noteWord}>{entry.word}</Text>
        <Image source={require('../../assets/speaker-icon.png')} style={styles.noteSound} />
        <Text style={styles.notePos}>{posLabel(entry.pos)}</Text>
      </Pressable>
      <Text style={styles.noteMeaning}>{entry.meaning}</Text>

      {syn.length > 0 && (
        <View style={styles.relRow}>
          <Text style={styles.relLabel}>近義</Text>
          <Text style={styles.relText}>{syn.slice(0, 4).join('、')}</Text>
        </View>
      )}
      {ant.length > 0 && (
        <View style={styles.relRow}>
          <Text style={styles.relLabelAnt}>反義</Text>
          <Text style={styles.relText}>{ant.slice(0, 4).join('、')}</Text>
        </View>
      )}

      <Pressable onPress={() => speakExample(entry.word, entry.example)}>
        <Text style={styles.example}>{entry.example}</Text>
        {entry.exampleZh && <Text style={styles.exampleZh}>{entry.exampleZh}</Text>}
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1 },
  list: { ...centered, paddingHorizontal: 18, paddingBottom: 40 },
  header: { paddingTop: 4, paddingBottom: 18 },
  zh: { color: t.colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  total: { color: t.colors.muted, fontSize: 14, fontWeight: '700', marginTop: 6 },
  // Outlined in red rather than filled with pink: the frame is enough to mark
  // it as the opposite, and a pink capsule was shouting louder than the heading.
  opposite: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: t.slabEdge.red,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  oppositeText: { color: t.colors.redInk, fontSize: 14, fontWeight: '900' },
  // The section heading is a rule across the page with the strength written on
  // it — the way a heading gets underlined in a real notebook.
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26, marginBottom: 10 },
  bandLabel: { color: t.colors.ink, fontSize: 17, fontWeight: '900' },
  bandRule: { flex: 1, height: 2, borderRadius: 1, backgroundColor: t.colors.line },
  bandCount: { color: t.colors.muted, fontSize: 12, fontWeight: '800' },
  // Entries are ruled apart rather than boxed: a page of boxes is what made the
  // old list unreadable, and a notebook separates with a line.
  note: {
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.line,
  },
  noteLast: { borderBottomWidth: 0, marginBottom: 4 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  noteWord: { color: t.colors.ink, fontSize: 21, fontWeight: '900' },
  noteSound: { width: 15, height: 15 },
  notePos: { color: t.colors.yellowInk, fontSize: 12, fontWeight: '900' },
  noteMeaning: { color: t.colors.ink, fontSize: 16, fontWeight: '700', lineHeight: 24, marginTop: 6 },
  relRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 },
  relLabel: { color: t.colors.greenInk, fontSize: 12, fontWeight: '900', width: 30 },
  relLabelAnt: { color: t.colors.redInk, fontSize: 12, fontWeight: '900', width: 30 },
  relText: { color: t.colors.muted, fontSize: 14, fontWeight: '700', flex: 1, lineHeight: 21 },
  example: { color: t.colors.muted, fontSize: 14, lineHeight: 22, marginTop: 10, fontStyle: 'italic' },
  exampleZh: { color: t.colors.muted, fontSize: 13, lineHeight: 20, marginTop: 2 },
});
