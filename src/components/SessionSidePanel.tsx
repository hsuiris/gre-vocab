import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { WordEntry } from '../data/words';
import { speakWord } from '../lib/speech';
import { colors } from '../theme';

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

export function SessionSidePanel({ marked, note, onChangeNote, onSaveNote, saved, onClose }: Props) {
  const canSave = note.trim().length > 0;
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>錯題 · 不熟</Text>
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
          <Text style={styles.empty}>全對，這裡先空著</Text>
        ) : (
          marked.map(({ entry, reason }) => (
            <Pressable key={entry.word} style={styles.row} onPress={() => speakWord(entry.word)}>
              <View style={styles.rowHead}>
                <Text style={reason === 'wrong' ? styles.badgeWrong : styles.badgeUnsure}>
                  {reason === 'wrong' ? '✖' : '☆'}
                </Text>
                <Text style={styles.word}>{entry.word}</Text>
              </View>
              <Text style={styles.meaning}>{entry.meaning}</Text>
              <Text style={styles.example}>{entry.example}</Text>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={styles.noteBox}>
        <Text style={styles.headerTitle}>筆記</Text>
        <TextInput
          value={note}
          onChangeText={onChangeNote}
          multiline
          textAlignVertical="top"
          placeholder="這一場想記下什麼？"
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
  panel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  count: {
    color: colors.red,
    backgroundColor: colors.redSoft,
    fontWeight: '900',
    fontSize: 13,
    minWidth: 26,
    textAlign: 'center',
    borderRadius: 13,
    paddingVertical: 3,
  },
  closeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.muted, fontWeight: '900' },
  // flex on the list, not the note box: the note keeps its size and the wrong
  // answers take whatever height is left over.
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 4 },
  empty: { color: colors.muted, fontWeight: '700', textAlign: 'center', paddingVertical: 20 },
  row: { backgroundColor: colors.page, borderRadius: 16, padding: 11 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeWrong: { color: colors.red, fontWeight: '900', fontSize: 13 },
  badgeUnsure: { color: colors.orange, fontWeight: '900', fontSize: 13 },
  word: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  meaning: { color: colors.muted, fontWeight: '700', fontSize: 13, marginTop: 3 },
  example: { color: colors.ink, fontSize: 12, lineHeight: 17, marginTop: 5, fontStyle: 'italic' },
  noteBox: { gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  input: {
    backgroundColor: colors.page,
    borderRadius: 16,
    padding: 11,
    minHeight: 86,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  saveBtn: { backgroundColor: colors.blue, borderRadius: 16, paddingVertical: 11, alignItems: 'center' },
  saveBtnOff: { backgroundColor: colors.page },
  saveText: { color: colors.surface, fontWeight: '900' },
  saveTextOff: { color: colors.muted },
});
