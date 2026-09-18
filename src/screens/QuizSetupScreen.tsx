import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { getAllProgress, getExcludedWords, getWrongWords, saveLastQuiz } from '../lib/storage';
import type { LastQuiz } from '../lib/storage';
import { GlassFill } from '../components/Glass';
import { todayStr } from '../lib/date';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';
import { buildPracticeQueue, PracticeOrder } from '../lib/practiceQueue';

type Props = NativeStackScreenProps<RootStackParamList, 'QuizSetup'>;

const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

// 0 means "everything due" — one number for the state instead of a number
// plus a flag.
const limits = [10, 20, 30, 0];

// Picking a way to practise is not the same as knowing what it will ask you.
// One line per quiz, so the setup page can say it out loud.
function quizHint(quiz: LastQuiz): string {
  if (quiz.wrongOnly) return '只練之前答錯、還沒扳回來的字';
  if (quiz.mode === 'cloze') return '讀一個句子，選出最適合填進空格的單字';
  if (quiz.mode === 'typing') return '看中文意思，自己把英文單字拼出來';
  return quiz.direction === 'en-zh' ? '看英文單字，選出正確的中文意思' : '看中文意思，選出正確的英文單字';
}

export function QuizSetupScreen({ navigation, route }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const quiz = route.params.quiz;
  const [order, setOrder] = useState<PracticeOrder>('alphabetical');
  const [letters, setLetters] = useState<string[]>([]);
  const [limit, setLimit] = useState(0);
  const [count, setCount] = useState(0);

  // The count is the whole point of this page: it turns "which letters?" into
  // "how long will this take?" before anything is committed to.
  useEffect(() => {
    let active = true;
    (async () => {
      const [progress, excluded, wrong] = await Promise.all([
        getAllProgress(),
        getExcludedWords(),
        quiz.wrongOnly ? getWrongWords() : Promise.resolve(undefined),
      ]);
      const due = buildPracticeQueue(words, progress, excluded, todayStr(), {
        letters,
        limit,
        wrongWords: wrong,
      });
      if (active) setCount(due.length);
    })();
    return () => {
      active = false;
    };
  }, [letters, limit, quiz.wrongOnly]);

  function toggleLetter(letter: string) {
    setLetters((current) =>
      current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter].sort()
    );
  }

  // The range chosen here rides along in the saved quiz, so "接著上次" on the
  // home screen can skip this page entirely and start the same session again.
  function start() {
    const saved: LastQuiz = { ...quiz, order, letters, limit };
    saveLastQuiz(saved);
    navigation.navigate('Practice', {
      direction: quiz.direction,
      mode: quiz.mode,
      wrongOnly: quiz.wrongOnly,
      order,
      letters,
      limit,
    });
  }

  const letterLabel = letters.length === 0 ? '全部字母' : letters.join(', ').toUpperCase();

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <GlassFill intensity={28} />
          <Text style={styles.eyebrow}>準備練習</Text>
          <Text style={styles.title}>{quiz.label}</Text>
          <Text style={styles.hint}>{quizHint(quiz)}</Text>
        </View>

        <View style={styles.panel}>
          <GlassFill />
          <Text style={styles.panelTitle}>順序</Text>
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
        </View>

        <View style={styles.panel}>
          <GlassFill />
          <Text style={styles.panelTitle}>要練幾個字</Text>
          <View style={styles.segment}>
            {limits.map((n) => (
              <Pressable
                key={n}
                style={[styles.segmentButton, limit === n && styles.segmentButtonActive]}
                onPress={() => setLimit(n)}
              >
                <Text style={[styles.segmentText, limit === n && styles.segmentTextActive]}>
                  {n === 0 ? '全部' : n}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <GlassFill />
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>範圍</Text>
            <Text style={styles.rangeLabel}>{letterLabel}</Text>
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
          <View style={styles.rangeActions}>
            <Pressable style={styles.rangeButton} onPress={() => setLetters(alphabet)}>
              <Text style={styles.rangeButtonText}>全選</Text>
            </Pressable>
            <Pressable style={styles.rangeButton} onPress={() => setLetters([])}>
              <Text style={styles.rangeButtonText}>取消所選</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.startBtn, pressed && theme.slabPressed]} onPress={start}>
          <Text style={styles.startText}>開始練習</Text>
          <Text style={styles.startCount}>{count} 個字</Text>
        </Pressable>
        {count === 0 && <Text style={styles.emptyNote}>這個範圍今天沒有到期的字，換幾個字母試試。</Text>}
        {count > 0 && limit > 0 && count < limit && (
          <Text style={styles.emptyNote}>這個範圍今天只有 {count} 個字到期，練完就結束。</Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { ...centered, padding: 20, paddingBottom: 36, gap: 14 },
  hero: { ...t.pane(28), ...t.glassShadow, paddingHorizontal: 24, paddingVertical: 22 },
  eyebrow: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900' },
  title: { color: t.colors.ink, fontSize: 26, fontWeight: '900', marginTop: 6 },
  hint: { color: t.colors.muted, fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 8 },
  panel: { ...t.pane(24), ...t.glassShadow, padding: 18 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: t.colors.ink, fontSize: 18, fontWeight: '900' },
  rangeLabel: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900', flexShrink: 1, textAlign: 'right' },
  // gap, so the hairlines below never fuse two options into one long box.
  segment: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: t.glass.fillThin,
    borderRadius: 18,
    padding: 4,
    marginTop: 14,
  },
  // Every option is drawn, not just the chosen one. Unpicked, these were a
  // fill barely off the panel behind them, so the row read as one surface and
  // nothing announced there was a choice to make. One hairline fixes that
  // without turning the panel into a grid of boxes.
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: t.slabEdge.line,
  },
  segmentButtonActive: { backgroundColor: t.colors.blue, borderColor: t.slabEdge.blue },
  segmentText: { color: t.colors.muted, fontWeight: '900' },
  segmentTextActive: { color: t.colors.blueInk },
  letters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  letterChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.glass.fillThin,
    borderWidth: 1,
    borderColor: t.slabEdge.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterChipActive: { backgroundColor: t.colors.blue, borderColor: t.slabEdge.blue },
  letterText: { color: t.colors.muted, fontWeight: '900' },
  letterTextActive: { color: t.colors.blueInk },
  rangeActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  rangeButton: { flex: 1, backgroundColor: t.colors.blue, borderRadius: 16, paddingVertical: 10, alignItems: 'center' },
  rangeButtonText: { color: t.colors.blueInk, fontWeight: '900' },
  // The one solid button on the page: everything above it is a choice, this is
  // the way out of the page.
  // Sized by its own label and centred, not stretched: a pastel bar across the
  // full width reads as a banner, not as the one thing left to press.
  startBtn: {
    ...t.slab(t.slabEdge.blue),
    alignSelf: 'center',
    backgroundColor: t.colors.blue,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  startText: { color: t.colors.blueInk, fontSize: 18, fontWeight: '900' },
  startCount: { color: t.colors.blueInk, fontSize: 15, fontWeight: '900' },
  emptyNote: { color: t.colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
