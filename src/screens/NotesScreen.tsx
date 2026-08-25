import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getNotes, saveNote, deleteNote, StudyNote } from '../lib/storage';
import { Mascot } from '../components/Mascot';
import { GlassFill } from '../components/Glass';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

export function NotesScreen() {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
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
          <GlassFill />
          <Mascot size={112} message="這裡還空空的" />
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
                      <Pressable style={({ pressed }) => [styles.saveBtn, pressed && theme.slabPressed]} onPress={() => handleSave(item)}>
                        <Text style={styles.saveText}>儲存</Text>
                      </Pressable>
                      <Pressable style={({ pressed }) => [styles.deleteBtn, pressed && theme.slabPressed]} onPress={() => handleDelete(item.id)}>
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

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { ...centered, flex: 1, padding: 20 },
  eyebrow: { color: t.colors.blueInk, fontSize: 14, fontWeight: '900' },
  title: { color: t.colors.ink, fontSize: 32, fontWeight: '900', marginTop: 4, marginBottom: 16 },
  emptyCard: { ...t.pane(24), ...t.glassShadow, padding: 24, alignItems: 'center' },
  emptyTitle: { color: t.colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 10 },
  empty: { color: t.colors.muted, marginTop: 8, textAlign: 'center', fontWeight: '700', lineHeight: 22 },
  list: { gap: 10, paddingBottom: 24 },
  // A list row keeps a plain translucent fill: one BlurView per row is a real
  // cost on a long list, and the wash behind it already reads as t.glass.
  row: { backgroundColor: t.glass.solid, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: t.glass.edge },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  date: { color: t.colors.ink, fontSize: 17, fontWeight: '900' },
  mode: {
    color: t.colors.blueInk,
    backgroundColor: t.colors.blue,
    fontSize: 12,
    fontWeight: '900',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meta: { color: t.colors.muted, fontWeight: '700', fontSize: 13, marginTop: 5 },
  preview: { color: t.colors.ink, marginTop: 8, lineHeight: 21, fontWeight: '600' },
  input: {
    marginTop: 10,
    backgroundColor: t.glass.solid,
    borderRadius: 16,
    padding: 12,
    minHeight: 120,
    color: t.colors.ink,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: {
    ...t.slab(t.slabEdge.blue),
    flex: 1,
    backgroundColor: t.colors.blue,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: { color: t.colors.blueInk, fontWeight: '900' },
  deleteBtn: {
    ...t.slab(t.slabEdge.line),
    backgroundColor: t.colors.red,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  deleteText: { color: t.colors.redInk, fontWeight: '900' },
});
