import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { getAllProgress, getHeatmap, getExcludedWords, getLastQuiz } from '../lib/storage';
import type { LastQuiz } from '../lib/storage';
import { Heatmap } from '../components/Heatmap';
import { Mascot } from '../components/Mascot';
import { GlassFill } from '../components/Glass';
import { todayStr } from '../lib/date';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';
import { buildPracticeQueue } from '../lib/practiceQueue';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// The five ways to practise, in one list so the "carry on where you left off"
// card can name a saved quiz without re-deriving its title.
const QUIZZES: LastQuiz[] = [
  { label: '英文選中文意思', direction: 'en-zh', mode: 'choice' },
  { label: '中文選英文單字', direction: 'zh-en', mode: 'choice' },
  { label: '句子填空', direction: 'zh-en', mode: 'cloze' },
  { label: '單字拼寫', direction: 'zh-en', mode: 'typing' },
  { label: '複習錯題', direction: 'zh-en', mode: 'choice', wrongOnly: true },
];

function MenuCard({ title, meta, onPress }: { title: string; meta?: string; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && theme.slabPressed]} onPress={onPress}>
      <GlassFill fill={theme.glass.pane} />
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        {meta && <Text style={styles.cardMeta}>{meta}</Text>}
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

export function HomeScreen({ navigation }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [dueCount, setDueCount] = useState(0);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [last, setLast] = useState<LastQuiz | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [progress, heat, excluded, lastQuiz] = await Promise.all([
          getAllProgress(),
          getHeatmap(),
          getExcludedWords(),
          getLastQuiz(),
        ]);
        const today = todayStr();
        const due = buildPracticeQueue(words, progress, excluded, today).length;
        if (active) {
          setDueCount(due);
          setHeatmap(heat);
          setLast(lastQuiz);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  // Picking a quiz no longer starts one. Range and order belong to the quiz you
  // chose, not to the home screen, so the setup page asks for them next — and
  // it is what saves the quiz once you actually begin.
  //
  // Reviewing mistakes is the exception: the pile IS the range, so there is
  // nothing to pick. That one opens straight onto the list of words.
  function openSetup(quiz: LastQuiz) {
    navigation.navigate(quiz.wrongOnly ? 'WrongWords' : 'QuizSetup', { quiz });
  }

  // The saved quiz already carries the range it was started with, so carrying
  // on means going straight to the cards.
  function resume(quiz: LastQuiz) {
    navigation.navigate('Practice', {
      direction: quiz.direction,
      mode: quiz.mode,
      wrongOnly: quiz.wrongOnly,
      order: quiz.order,
      letters: quiz.letters,
      limit: quiz.limit,
    });
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <GlassFill intensity={28} />
          {/* Wraps rather than squeezes: with her speech bubble she is already
            190 wide, which leaves a narrow phone no room for a second column. */}
          <View style={styles.heroRow}>
            <Mascot message={'一天一天\n往目標邁進'} size={172} />
            <View style={styles.today}>
              <GlassFill fill={theme.glass.pane} />
              <Text style={styles.todayLabel}>今天背了</Text>
              <Text style={styles.todayCount}>{heatmap[todayStr()] ?? 0}</Text>
              <Text style={styles.todayLabel}>個字</Text>
            </View>
          </View>
          <Text style={styles.eyebrow}>今日複習</Text>
          <Text style={styles.title}>把 GRE 單字照顧好</Text>
          <Text style={styles.due}>{dueCount} 個字正在等你</Text>
        </View>

        {/* One tap back into whatever was practised last, so the usual case
          never means scrolling past the range picker to find the same row. */}
        {last && (
          <Pressable style={({ pressed }) => [styles.resume, pressed && theme.slabPressed]} onPress={() => resume(last)}>
            <GlassFill intensity={40} fill="rgba(214,230,243,0.62)" />
            <View style={styles.cardText}>
              <Text style={styles.resumeLabel}>接著上次</Text>
              <Text style={styles.resumeTitle}>{last.label}</Text>
            </View>
            <Text style={styles.resumeGo}>開始</Text>
          </Pressable>
        )}

        <MenuCard
          title="單字總覽"
          meta={`${words.length} 個字 · 可以按播放讓它自己唸`}
          onPress={() => navigation.navigate('AllWords')}
        />
        {QUIZZES.map((quiz) => (
          <MenuCard key={quiz.label} title={quiz.label} onPress={() => openSetup(quiz)} />
        ))}
        <MenuCard title="近義詞與反義詞" onPress={() => navigation.navigate('Relations')} />
        <MenuCard title="筆記庫" onPress={() => navigation.navigate('Notes')} />

        <View style={styles.panel}>
          <GlassFill />
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>學習節奏</Text>
            <Pressable style={styles.statsButton} onPress={() => navigation.navigate('Stats')}>
              <Text style={styles.statsButtonText}>統計</Text>
            </Pressable>
          </View>
          <Heatmap heatmap={heatmap} />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { ...centered, padding: 20, paddingBottom: 36, gap: 14 },
  // She leads the page rather than hiding in a corner, so everything below her
  // is centred to match.
  hero: {
    ...t.pane(30),
    ...t.glassShadow,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 26,
    alignItems: 'center',
  },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 14 },
  // A brighter pane on the hero's own glass, so the day's tally reads as a
  // counter sitting beside her rather than another line of the headline.
  today: {
    ...t.pane(22),
    paddingHorizontal: 18,
    paddingVertical: 14,
    minWidth: 96,
    alignItems: 'center',
  },
  todayLabel: { color: t.colors.muted, fontSize: 12, fontWeight: '900' },
  todayCount: { color: t.colors.blueInk, fontSize: 34, fontWeight: '900', lineHeight: 40, marginVertical: 2 },
  eyebrow: { color: t.colors.blueInk, fontSize: 14, fontWeight: '800', marginTop: 14 },
  title: { color: t.colors.ink, fontSize: 28, fontWeight: '900', lineHeight: 34, marginTop: 6, textAlign: 'center' },
  due: { color: t.colors.muted, fontSize: 17, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  resume: {
    ...t.pane(24),
    ...t.glassShadow,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resumeLabel: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900' },
  resumeTitle: { color: t.colors.ink, fontSize: 20, fontWeight: '900', marginTop: 4 },
  resumeGo: {
    color: t.colors.blueInk,
    fontSize: 15,
    fontWeight: '900',
    backgroundColor: t.glass.solid,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  card: {
    ...t.pane(24),
    ...t.glassShadow,
    padding: 20,
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardText: { flex: 1 },
  cardTitle: { color: t.colors.ink, fontSize: 20, fontWeight: '900' },
  cardMeta: { color: t.colors.muted, fontSize: 13, fontWeight: '700', marginTop: 5 },
  arrow: { color: t.colors.ink, fontSize: 34, fontWeight: '300' },
  panel: { ...t.pane(24), ...t.glassShadow, padding: 18 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  statsButton: { backgroundColor: t.colors.blue, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  statsButtonText: { color: t.colors.blueInk, fontWeight: '900' },
});
