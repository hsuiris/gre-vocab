import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words, WordEntry } from '../data/words';
import { getWrongWords, removeWrongWord, saveLastQuiz } from '../lib/storage';
import { speakWord } from '../lib/speech';
import { GlassFill } from '../components/Glass';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'WrongWords'>;

export function WrongWordsScreen({ navigation, route }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const quiz = route.params.quiz;
  const [items, setItems] = useState<WordEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const wrong = new Set(await getWrongWords());
    setItems(words.filter((w) => wrong.has(w.word)));
    setLoaded(true);
  }, []);

  // Reloaded on focus so coming back from a session shows the pile as it is
  // now, not as it was before the session fixed half of it.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function forget(word: string) {
    await removeWrongWord(word);
    load();
  }

  // Re-testing is the point of the list, so this is also what records the
  // session — the home screen's "接著上次" then lands back here.
  function startQuiz() {
    saveLastQuiz(quiz);
    navigation.navigate('Practice', {
      direction: quiz.direction,
      mode: quiz.mode,
      wrongOnly: true,
    });
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.word}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <GlassFill intensity={28} />
            <Text style={styles.eyebrow}>複習錯題</Text>
            <Text style={styles.title}>還剩 {items.length} 個字不熟</Text>
            <Text style={styles.hint}>答錯或標記「不熟」的字會收在這裡。點單字可以聽發音，答對一次就會自動離開清單。</Text>
          </View>
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.emptyCard}>
              <GlassFill />
              <Text style={styles.emptyTitle}>目前沒有錯題</Text>
              <Text style={styles.emptyMeta}>去練習幾輪，答錯的字會自動收進來。</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable style={styles.wordText} onPress={() => speakWord(item.word)} hitSlop={6}>
              <View style={styles.wordRow}>
                <Text style={styles.word}>{item.word}</Text>
                <Image source={require('../../assets/speaker-icon.png')} style={styles.soundIcon} />
              </View>
              <Text style={styles.meaning}>{item.meaning}</Text>
            </Pressable>
            <Pressable style={styles.forgetButton} onPress={() => forget(item.word)}>
              <Text style={styles.forgetText}>已學會</Text>
            </Pressable>
          </View>
        )}
      />

      {/* Pinned rather than at the end of the list: after reading a long pile,
          the way to test yourself on it should not need scrolling back. */}
      {items.length > 0 && (
        <View style={styles.footer}>
          <Pressable style={({ pressed }) => [styles.startBtn, pressed && theme.slabPressed]} onPress={startQuiz}>
            <Text style={styles.startText}>開始測驗</Text>
            <Text style={styles.startCount}>{items.length} 個字</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1 },
  list: { ...centered, padding: 20, paddingBottom: 24, gap: 12 },
  header: { ...t.pane(28), ...t.glassShadow, paddingHorizontal: 22, paddingVertical: 20, marginBottom: 2 },
  eyebrow: { color: t.colors.redInk, fontSize: 13, fontWeight: '900' },
  title: { color: t.colors.ink, fontSize: 24, fontWeight: '900', marginTop: 6 },
  hint: { color: t.colors.muted, fontSize: 14, fontWeight: '700', lineHeight: 21, marginTop: 8 },
  emptyCard: { ...t.pane(24), ...t.glassShadow, padding: 24, marginTop: 12 },
  emptyTitle: { color: t.colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  emptyMeta: { color: t.colors.muted, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: t.glass.solid,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.glass.edge,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  wordText: { flex: 1 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  soundIcon: { width: 15, height: 15 },
  meaning: { color: t.colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700', marginTop: 4 },
  forgetButton: { backgroundColor: t.colors.green, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  forgetText: { color: t.colors.greenInk, fontWeight: '900' },
  footer: { ...centered, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  // Sized by its own label and centred, not stretched: a pastel bar across the
  // full width reads as a banner, not as the one thing left to press.
  startBtn: {
    ...t.slab(t.slabEdge.blue),
    alignSelf: 'center',
    backgroundColor: t.colors.blue,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startText: { color: t.colors.blueInk, fontSize: 18, fontWeight: '900' },
  startCount: { color: t.colors.blueInk, fontSize: 15, fontWeight: '900' },
});
