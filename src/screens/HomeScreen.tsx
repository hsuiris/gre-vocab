import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuizMode, RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { getAllProgress, getHeatmap, getExcludedWords } from '../lib/storage';
import { Heatmap } from '../components/Heatmap';
import { Mascot } from '../components/Mascot';
import { todayStr } from '../lib/date';
import { colors, shadow, centered, slab, slabEdge, slabPressed } from '../theme';
import { buildPracticeQueue, PracticeOrder } from '../lib/practiceQueue';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function HomeScreen({ navigation }: Props) {
  const [dueCount, setDueCount] = useState(0);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<PracticeOrder>('alphabetical');
  const [letters, setLetters] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [progress, heat, excluded] = await Promise.all([
          getAllProgress(),
          getHeatmap(),
          getExcludedWords(),
        ]);
        const today = todayStr();
        const due = buildPracticeQueue(words, progress, excluded, today, { letters }).length;
        if (active) {
          setDueCount(due);
          setHeatmap(heat);
        }
      })();
      return () => {
        active = false;
      };
    }, [letters])
  );

  function toggleLetter(letter: string) {
    setLetters((current) =>
      current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter].sort()
    );
  }

  function start(direction: 'en-zh' | 'zh-en', mode: QuizMode) {
    navigation.navigate('Practice', { direction, order, letters, mode });
  }

  function startWrongReview() {
    navigation.navigate('Practice', { direction: 'zh-en', order, letters, mode: 'choice', wrongOnly: true });
  }

  const letterLabel = letters.length === 0 ? '全部字母' : letters.join(', ').toUpperCase();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Mascot message={'一天一天\n往目標邁進'} size={124} style={styles.heroPet} />
        <Text style={styles.eyebrow}>今日複習</Text>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
          把 GRE 單字照顧好
        </Text>
        <Text style={styles.due}>{dueCount} 個字正在等你</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>範圍與順序</Text>
        <View style={styles.segment}>
          <Pressable
            style={[styles.segmentButton, order === 'alphabetical' && styles.segmentButtonActive]}
            onPress={() => setOrder('alphabetical')}
          >
            <Text style={[styles.segmentText, order === 'alphabetical' && styles.segmentTextActive]}>A-Z 順序</Text>
          </Pressable>
          <Pressable
            style={[styles.segmentButton, order === 'shuffle' && styles.segmentButtonActive]}
            onPress={() => setOrder('shuffle')}
          >
            <Text style={[styles.segmentText, order === 'shuffle' && styles.segmentTextActive]}>跳著背</Text>
          </Pressable>
        </View>
        <View style={styles.letters}>
          {alphabet.map((letter) => (
            <Pressable
              key={letter}
              style={[styles.letterChip, letters.includes(letter) && styles.letterChipActive]}
              onPress={() => toggleLetter(letter)}
            >
              <Text style={[styles.letterText, letters.includes(letter) && styles.letterTextActive]}>
                {letter.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.clearButton} onPress={() => setLetters([])}>
          <Text style={styles.clearButtonText}>{letterLabel}</Text>
        </Pressable>
        <View style={styles.rangeActions}>
          <Pressable style={styles.rangeButton} onPress={() => setLetters(alphabet)}>
            <Text style={styles.rangeButtonText}>全選</Text>
          </Pressable>
          <Pressable style={styles.rangeButton} onPress={() => setLetters([])}>
            <Text style={styles.rangeButtonText}>取消所選</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => navigation.navigate('AllWords')}>
        <View>
          <Text style={styles.cardTitle}>單字總覽</Text>
          <Text style={styles.cardMeta}>{words.length} 個字 · 可以按播放讓它自己唸</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => start('en-zh', 'choice')}>
        <View>
          <Text style={styles.cardTitle}>英文選中文意思</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => start('zh-en', 'choice')}>
        <View>
          <Text style={styles.cardTitle}>中文選英文單字</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => start('zh-en', 'cloze')}>
        <View>
          <Text style={styles.cardTitle}>句子填空</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => start('zh-en', 'typing')}>
        <View>
          <Text style={styles.cardTitle}>手寫單字</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={startWrongReview}>
        <View>
          <Text style={styles.cardTitle}>複習錯題</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => navigation.navigate('Relations')}>
        <View>
          <Text style={styles.cardTitle}>近義／反義詞</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={() => navigation.navigate('Notes')}>
        <View>
          <Text style={styles.cardTitle}>筆記庫</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </Pressable>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>學習節奏</Text>
          <Pressable style={styles.statsButton} onPress={() => navigation.navigate('Stats')}>
            <Text style={styles.statsButtonText}>統計</Text>
          </Pressable>
        </View>
        <Heatmap heatmap={heatmap} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  content: { ...centered, padding: 20, paddingBottom: 36, gap: 14 },
  hero: {
    backgroundColor: colors.tint,
    borderRadius: 30,
    padding: 24,
    minHeight: 210,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  heroPet: { position: 'absolute', right: -6, top: 40 },
  eyebrow: { color: colors.blue, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', lineHeight: 34, maxWidth: 270 },
  due: { color: colors.muted, fontSize: 17, fontWeight: '700', marginTop: 10 },
  card: {
    ...shadow,
    ...slab(slabEdge.line),
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  cardMeta: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 5 },
  arrow: { color: colors.ink, fontSize: 34, fontWeight: '300' },
  panel: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.line },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  segment: { flexDirection: 'row', backgroundColor: colors.page, borderRadius: 18, padding: 4, marginTop: 14 },
  segmentButton: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 11 },
  segmentButtonActive: { backgroundColor: colors.blue },
  segmentText: { color: colors.muted, fontWeight: '900' },
  segmentTextActive: { color: colors.surface },
  letters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  letterChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterChipActive: { backgroundColor: colors.blue },
  letterText: { color: colors.muted, fontWeight: '900' },
  letterTextActive: { color: colors.surface },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.blueSoft,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: { color: colors.blue, fontWeight: '900' },
  rangeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rangeButton: { flex: 1, backgroundColor: colors.blueSoft, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  rangeButtonText: { color: colors.blue, fontWeight: '900' },
  statsButton: { backgroundColor: colors.blueSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  statsButtonText: { color: colors.blue, fontWeight: '900' },
});
