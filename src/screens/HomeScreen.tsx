import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { QuizMode, RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { getAllProgress, getHeatmap, getExcludedWords } from '../lib/storage';
import { Heatmap } from '../components/Heatmap';
import { Mascot } from '../components/Mascot';
import { ANIMALS, AnimalName } from '../components/mascots';
import { todayStr } from '../lib/date';
import { colors, shadow, centered, slab, slabEdge, slabPressed } from '../theme';
import { buildPracticeQueue, PracticeOrder } from '../lib/practiceQueue';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

// One animal per row, so the menu reads as a line-up of characters rather than
// eight identical rectangles.
function MenuCard({
  pet,
  title,
  meta,
  onPress,
}: {
  pet: AnimalName;
  title: string;
  meta?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && slabPressed]} onPress={onPress}>
      <Image source={ANIMALS[pet]} style={styles.cardPet} resizeMode="contain" />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {meta && <Text style={styles.cardMeta}>{meta}</Text>}
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

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
        <Mascot message={'一天一天\n往目標邁進'} size={172} />
        <Text style={styles.eyebrow}>今日複習</Text>
        <Text style={styles.title}>把 GRE 單字照顧好</Text>
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

      <MenuCard pet="cat" title="單字總覽" meta={`${words.length} 個字 · 可以按播放讓它自己唸`} onPress={() => navigation.navigate('AllWords')} />
      <MenuCard pet="shiba" title="英文選中文意思" onPress={() => start('en-zh', 'choice')} />
      <MenuCard pet="rabbit" title="中文選英文單字" onPress={() => start('zh-en', 'choice')} />
      <MenuCard pet="penguin" title="句子填空" onPress={() => start('zh-en', 'cloze')} />
      <MenuCard pet="chick" title="手寫單字" onPress={() => start('zh-en', 'typing')} />
      <MenuCard pet="hamster" title="複習錯題" onPress={startWrongReview} />
      <MenuCard pet="elephant" title="照意思找字" onPress={() => navigation.navigate('Relations')} />
      <MenuCard pet="pig" title="筆記庫" onPress={() => navigation.navigate('Notes')} />

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
  // She leads the page rather than hiding in a corner, so everything below her
  // is centred to match.
  hero: {
    backgroundColor: colors.tint,
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 26,
    alignItems: 'center',
  },
  eyebrow: { color: colors.blueInk, fontSize: 14, fontWeight: '800', marginTop: 14 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', lineHeight: 34, marginTop: 6, textAlign: 'center' },
  due: { color: colors.muted, fontSize: 17, fontWeight: '700', marginTop: 8, textAlign: 'center' },
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
  // Sized so the animal itself still reads at ~50pt now that each sprite
  // carries a margin of its own.
  cardPet: { width: 62, height: 62, marginRight: 12 },
  cardText: { flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  cardMeta: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 5 },
  arrow: { color: colors.ink, fontSize: 34, fontWeight: '300' },
  panel: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: colors.line },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  segment: { flexDirection: 'row', backgroundColor: colors.inset, borderRadius: 18, padding: 4, marginTop: 14 },
  segmentButton: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 11 },
  segmentButtonActive: { backgroundColor: colors.blue },
  segmentText: { color: colors.muted, fontWeight: '900' },
  segmentTextActive: { color: colors.blueInk },
  letters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  letterChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterChipActive: { backgroundColor: colors.blue },
  letterText: { color: colors.muted, fontWeight: '900' },
  letterTextActive: { color: colors.blueInk },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: colors.blue,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: { color: colors.blueInk, fontWeight: '900' },
  rangeActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rangeButton: { flex: 1, backgroundColor: colors.blue, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  rangeButtonText: { color: colors.blueInk, fontWeight: '900' },
  statsButton: { backgroundColor: colors.blue, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  statsButtonText: { color: colors.blueInk, fontWeight: '900' },
});
