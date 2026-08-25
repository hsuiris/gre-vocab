import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { WordEntry } from '../data/words';
import { speakWord } from '../lib/speech';
import { GlassFill } from './Glass';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

// "wrong" lands here on its own when an answer is missed; "unsure" is the star
// on the card, for the ones guessed right without really knowing them.
export type MarkedWord = { entry: WordEntry; reason: 'wrong' | 'unsure' };

type Props = {
  marked: MarkedWord[];
  note: string;
  onChangeNote: (text: string) => void;
  onSaveNote: () => void;
  saved: boolean;
  onClose?: () => void;
};

// Two separate cards, not one panel with a rule down the middle: the wrong
// answers and the note are different things and the layout should say so.
export function SessionSidePanel({ marked, note, onChangeNote, onSaveNote, saved, onClose }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const canSave = note.trim().length > 0;
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <GlassFill />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>錯題庫</Text>
          <View style={styles.headerRight}>
            <Text style={styles.count}>{marked.length}</Text>
            {onClose && (
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {marked.length === 0 ? (
            <Text style={styles.empty}>答錯或標記「不熟」的字會收在這裡</Text>
          ) : (
            marked.map(({ entry, reason }) => (
              <Pressable key={entry.word} style={styles.row} onPress={() => speakWord(entry.word)}>
                <View style={styles.rowHead}>
                  <Text style={reason === 'wrong' ? styles.badgeWrong : styles.badgeUnsure}>
                    {reason === 'wrong' ? '✖ 答錯' : '☆ 不熟'}
                  </Text>
                  <Text style={styles.word}>{entry.word}</Text>
                </View>
                <Text style={styles.meaning}>{entry.meaning}</Text>
                <Text style={styles.example}>{entry.example}</Text>
                {entry.exampleZh && <Text style={styles.exampleZh}>{entry.exampleZh}</Text>}
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <GlassFill />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>筆記</Text>
          <Text style={styles.headerHint}>這一場想記什麼都可以</Text>
        </View>
        <TextInput
          value={note}
          onChangeText={onChangeNote}
          multiline
          textAlignVertical="top"
          placeholder="例：ab- 開頭的字幾乎都是負面的…"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />
        <Pressable
          style={({ pressed }) => [styles.saveBtn, !canSave && styles.saveBtnOff, pressed && canSave && theme.slabPressed]}
          onPress={onSaveNote}
          disabled={!canSave}
        >
          <Text style={[styles.saveText, !canSave && styles.saveTextOff]}>
            {saved ? '已存到筆記庫 ✓' : '存到筆記庫'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  stack: { flex: 1, gap: 14 },
  card: { ...t.pane(28), ...t.glassShadow, flex: 1, padding: 16, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: t.colors.ink, fontSize: 17, fontWeight: '900' },
  headerHint: { color: t.colors.muted, fontSize: 12, fontWeight: '700' },
  count: {
    color: t.colors.redInk,
    backgroundColor: t.colors.red,
    fontWeight: '900',
    fontSize: 13,
    minWidth: 28,
    textAlign: 'center',
    borderRadius: 14,
    paddingVertical: 4,
  },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: t.colors.muted, fontWeight: '900', fontSize: 15 },
  list: { flex: 1, backgroundColor: 'transparent' },
  listContent: { gap: 10, paddingBottom: 4 },
  empty: { color: t.colors.muted, fontWeight: '700', textAlign: 'center', paddingVertical: 28, lineHeight: 22 },
  row: { backgroundColor: t.glass.solid, borderRadius: 18, padding: 13, borderWidth: 1, borderColor: t.glass.edge },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeWrong: {
    color: t.colors.redInk,
    backgroundColor: t.colors.red,
    fontWeight: '900',
    fontSize: 11,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  badgeUnsure: {
    color: t.colors.yellowInk,
    backgroundColor: t.glass.solid,
    borderWidth: 1,
    borderColor: t.colors.yellow,
    fontWeight: '900',
    fontSize: 11,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  word: { color: t.colors.ink, fontSize: 17, fontWeight: '900' },
  meaning: { color: t.colors.muted, fontWeight: '700', fontSize: 14, marginTop: 6 },
  example: { color: t.colors.ink, fontSize: 13, lineHeight: 19, marginTop: 6, fontStyle: 'italic' },
  exampleZh: { color: t.colors.muted, fontSize: 12.5, lineHeight: 19, marginTop: 3 },
  input: {
    flex: 1,
    backgroundColor: t.glass.solid,
    borderRadius: 18,
    padding: 14,
    minHeight: 96,
    color: t.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  saveBtn: {
    ...t.slab(t.slabEdge.blue),
    backgroundColor: t.colors.blue,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnOff: { backgroundColor: t.glass.fillThin, borderBottomColor: t.slabEdge.line },
  saveText: { color: t.colors.blueInk, fontWeight: '900', fontSize: 15 },
  saveTextOff: { color: t.colors.muted },
});
