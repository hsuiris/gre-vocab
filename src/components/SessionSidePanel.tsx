import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { WordEntry } from '../data/words';
import { speakWord } from '../lib/speech';
import { colors, slab, slabEdge } from '../theme';

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
  const canSave = note.trim().length > 0;
  return (
    <View style={styles.stack}>
      <View style={styles.card}>
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
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>

      <View style={styles.card}>
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
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable
          style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
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

const styles = StyleSheet.create({
  stack: { flex: 1, gap: 14 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  headerHint: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  count: {
    color: colors.red,
    backgroundColor: colors.redSoft,
    fontWeight: '900',
    fontSize: 13,
    minWidth: 28,
    textAlign: 'center',
    borderRadius: 14,
    paddingVertical: 4,
  },
  closeBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.muted, fontWeight: '900', fontSize: 15 },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 4 },
  empty: { color: colors.muted, fontWeight: '700', textAlign: 'center', paddingVertical: 28, lineHeight: 22 },
  row: { backgroundColor: colors.page, borderRadius: 18, padding: 13 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeWrong: {
    color: colors.red,
    backgroundColor: colors.redSoft,
    fontWeight: '900',
    fontSize: 11,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  badgeUnsure: {
    color: colors.yellowInk,
    backgroundColor: colors.yellowSoft,
    fontWeight: '900',
    fontSize: 11,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  word: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  meaning: { color: colors.muted, fontWeight: '700', fontSize: 14, marginTop: 6 },
  example: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 6, fontStyle: 'italic' },
  input: {
    flex: 1,
    backgroundColor: colors.page,
    borderRadius: 18,
    padding: 14,
    minHeight: 96,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  saveBtn: {
    ...slab(slabEdge.blue),
    backgroundColor: colors.blue,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnOff: { backgroundColor: colors.page, borderBottomColor: slabEdge.line },
  saveText: { color: colors.surface, fontWeight: '900', fontSize: 15 },
  saveTextOff: { color: colors.muted },
});
