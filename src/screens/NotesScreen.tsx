import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getNotes, saveNote, deleteNote, StudyNote } from '../lib/storage';
import { colors, centered, slab, slabEdge } from '../theme';

export function NotesScreen() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setNotes(await getNotes());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function toggle(note: StudyNote) {
    // Opening a second note drops whatever was typed in the first, so only one
    // draft is ever in flight.
    if (openId === note.id) {
      setOpenId(null);
      return;
    }
    setOpenId(note.id);
    setDraft(note.text);
  }

  async function handleSave(note: StudyNote) {
    await saveNote({ ...note, text: draft });
    setOpenId(null);
    load();
  }

  async function handleDelete(id: string) {
    await deleteNote(id);
    setOpenId(null);
    load();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>寫過的筆記</Text>
      <Text style={styles.title}>筆記庫</Text>
      {notes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>還沒有筆記</Text>
          <Text style={styles.empty}>練習時在右邊的筆記區寫字，按「存到筆記庫」就會出現在這裡</Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const open = openId === item.id;
            return (
              <Pressable style={styles.row} onPress={() => toggle(item)}>
                <View style={styles.rowHead}>
                  <Text style={styles.date}>{item.date}</Text>
                  <Text style={styles.mode}>{item.mode}</Text>
                </View>
                <Text style={styles.meta}>
                  {item.total} 題 · 錯 {item.wrongCount} 題
                </Text>
                {open ? (
                  <>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      multiline
                      textAlignVertical="top"
                      style={styles.input}
                    />
                    <View style={styles.actions}>
                      <Pressable style={styles.saveBtn} onPress={() => handleSave(item)}>
                        <Text style={styles.saveText}>儲存</Text>
                      </Pressable>
                      <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                        <Text style={styles.deleteText}>刪除</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Text style={styles.preview} numberOfLines={2}>
                    {item.text}
                  </Text>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...centered, flex: 1, backgroundColor: colors.page, padding: 20 },
  eyebrow: { color: colors.blue, fontSize: 14, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4, marginBottom: 16 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.line },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  empty: { color: colors.muted, marginTop: 8, textAlign: 'center', fontWeight: '700', lineHeight: 22 },
  list: { gap: 10, paddingBottom: 24 },
  row: { backgroundColor: colors.surface, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  mode: {
    color: colors.yellowInk,
    backgroundColor: colors.yellowSoft,
    fontSize: 12,
    fontWeight: '900',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meta: { color: colors.muted, fontWeight: '700', fontSize: 13, marginTop: 5 },
  preview: { color: colors.ink, marginTop: 8, lineHeight: 21, fontWeight: '600' },
  input: {
    marginTop: 10,
    backgroundColor: colors.page,
    borderRadius: 16,
    padding: 12,
    minHeight: 120,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: {
    ...slab(slabEdge.blue),
    flex: 1,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { color: colors.surface, fontWeight: '900' },
  deleteBtn: {
    ...slab(slabEdge.line),
    backgroundColor: colors.redSoft,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  deleteText: { color: colors.red, fontWeight: '900' },
});
