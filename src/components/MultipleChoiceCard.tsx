import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Image } from 'react-native';
import type { QuizMode } from '../navigation/RootNavigator';
import { WordEntry } from '../data/words';
import { getRelation } from '../data/relations';
import type { AppSettings } from '../lib/storage';
import { speakExample, speakWord } from '../lib/speech';
import { posLabel } from '../lib/pos';
import { GlassFill } from './Glass';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = {
  entry: WordEntry;
  direction: 'en-zh' | 'zh-en';
  mode: QuizMode;
  choices: string[];
  choiceEntries: Record<string, WordEntry>;
  settings: AppSettings;
  onResult: (knewIt: boolean) => void;
  // Fires the instant an answer is picked, not when the card advances, so the
  // screen can bank the answer while the result is still on screen.
  onAnswered: (correct: boolean) => void;
  onExclude: () => void;
  onMarkUnsure: () => void;
  unsure: boolean;
};

// Each option is labelled like an exam paper. Four is the most buildChoices
// ever returns, so the list never runs out of letters.
const OPTION_KEYS = 'ABCD';

export function MultipleChoiceCard({
  entry,
  direction,
  mode,
  choices,
  choiceEntries,
  settings,
  onResult,
  onAnswered,
  onExclude,
  onMarkUnsure,
  unsure,
}: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  // True only when the card is already showing the English word as the
  // question. Everywhere else — 中文選英文, 拼字, 克漏字 — the word is the answer,
  // and a card that will pronounce it on demand has given the answer away.
  const questionIsWord = mode === 'choice' && direction === 'en-zh';
  const question = questionIsWord ? entry.word : entry.meaning;
  const correctAnswer = questionIsWord ? entry.meaning : entry.word;
  const answered = selected !== null;
  const gotIt = answered && isCorrect(selected!);
  const blankedExample = entry.example.replace(new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');

  function isCorrect(answer: string) {
    return answer.trim().toLowerCase() === correctAnswer.toLowerCase();
  }

  // Both ways of answering land here. The tap or the submit that got us this
  // far is also the user gesture a browser wants before it will speak, so this
  // is the one moment auto-play is allowed to work on the web build.
  function reveal(answer: string) {
    setSelected(answer);
    onAnswered(isCorrect(answer));
    if (settings.autoSpeakAfterAnswer) speakWord(entry.word);
  }

  function handleSelect(choice: string) {
    if (answered) return; // locked after first tap
    reveal(choice);
  }

  function handleTypingSubmit() {
    if (answered) return;
    reveal(typed.trim());
  }

  function handleNext() {
    const knewIt = isCorrect(selected ?? '');
    setSelected(null);
    setTyped('');
    onResult(knewIt);
  }

  function optionStyle(choice: string) {
    return ({ pressed }: { pressed: boolean }) => {
      // Only an unanswered option can be pressed down; once locked, the key
      // staying put is the feedback.
      const press = pressed && !answered ? styles.optionPressed : null;
      if (!answered) return [styles.option, press];
      if (choice === correctAnswer) return [styles.option, styles.optionCorrect];
      if (choice === selected) return [styles.option, styles.optionWrong];
      return [styles.option, styles.optionDisabled];
    };
  }

  // Each option is its own pane of glass, tinted by how it turned out.
  function optionFill(choice: string) {
    if (!answered) return theme.glass.pane;
    if (choice === correctAnswer) return 'rgba(214,233,210,0.8)';
    if (choice === selected) return 'rgba(245,219,216,0.8)';
    return theme.glass.fillThin;
  }

  function optionTextStyle(choice: string) {
    if (!answered) return styles.optionText;
    if (choice === correctAnswer || choice === selected) return [styles.optionText, styles.optionTextFeedback];
    return styles.optionText;
  }

  function optionKeyLabel(choice: string, index: number) {
    if (!answered) return OPTION_KEYS[index] ?? '•';
    if (choice === correctAnswer) return '✓';
    if (choice === selected) return '✗';
    return OPTION_KEYS[index] ?? '•';
  }

  function optionKeyStyle(choice: string) {
    if (!answered) return styles.optionKey;
    if (choice === correctAnswer) return [styles.optionKey, styles.optionKeyCorrect];
    if (choice === selected) return [styles.optionKey, styles.optionKeyWrong];
    return styles.optionKey;
  }

  function optionKeyTextStyle(choice: string) {
    if (!answered) return styles.optionKeyText;
    if (choice === correctAnswer) return [styles.optionKeyText, styles.optionKeyTextCorrect];
    if (choice === selected) return [styles.optionKeyText, styles.optionKeyTextWrong];
    return styles.optionKeyText;
  }

  // The wrong options get their own speaker button plus grammar and example, so
  // a revealed card teaches four words instead of one. The right one doesn't:
  // its entry is already spelled out at the top of the card.
  function renderOptionDetail(choice: string) {
    if (choice === correctAnswer) return null;
    const info = choiceEntries[choice];
    if (!info) return null;
    const feedback = choice === correctAnswer || choice === selected;
    const syn = getRelation(info.word).syn.slice(0, 3);
    // When the option text is already the Chinese meaning, repeating it is noise.
    const gloss = choice === info.word ? info.meaning : null;
    return (
      <View style={styles.optionDetail}>
        <View style={styles.optionMetaRow}>
          <Pressable style={styles.optionSound} onPress={() => speakWord(info.word)} hitSlop={8}>
            <Image source={require('../../assets/speaker-icon.png')} style={styles.optionSoundIcon} />
            <Text style={styles.optionSoundText}>{info.word}</Text>
          </Pressable>
          <Text style={feedback ? styles.optionPosFeedback : styles.optionPos}>{posLabel(info.pos)}</Text>
        </View>
        {gloss && <Text style={feedback ? styles.optionMetaFeedback : styles.optionMeta}>{gloss}</Text>}
        {syn.length > 0 && (
          <Text style={feedback ? styles.optionMetaFeedback : styles.optionMeta}>≈ {syn.join('、')}</Text>
        )}
        <Pressable onPress={() => speakExample(info.word, info.example)}>
          <Text style={feedback ? styles.optionExampleFeedback : styles.optionExample}>{info.example}</Text>
        </Pressable>
        {info.exampleZh && (
          <Text style={feedback ? styles.optionMetaFeedback : styles.optionMeta}>{info.exampleZh}</Text>
        )}
      </View>
    );
  }

  function renderHighlightedExample() {
    const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = entry.example.split(new RegExp(`(${escaped})`, 'i'));
    return parts.map((part, index) => (
      <Text key={`${part}-${index}`} style={part.toLowerCase() === entry.word.toLowerCase() && styles.highlightWord}>
        {part}
      </Text>
    ));
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <GlassFill intensity={30} />
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.unsureBtn, unsure && styles.unsureBtnOn]}
            onPress={onMarkUnsure}
            hitSlop={8}
          >
            <Text style={[styles.unsureBtnText, unsure && styles.unsureBtnTextOn]}>
              {unsure ? '★ 不熟' : '☆ 不熟'}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.excludeBtn, pressed && styles.excludeBtnPressed]}
            onPress={onExclude}
            hitSlop={10}
            accessibilityLabel="這個字太簡單"
          >
            <Text style={styles.excludeBtnText}>✕</Text>
          </Pressable>
        </View>

        {answered ? (
          // The word and its explanation replace the question the moment an
          // answer lands: the answer is what you came here to read, so it sits
          // at the top of the card instead of at the bottom of the page.
          <View style={styles.answerBody}>
            <Text style={gotIt ? styles.verdictRight : styles.verdictWrong}>{gotIt ? '答對了' : '答錯了'}</Text>
            <Pressable style={styles.answerWordRow} onPress={() => speakWord(entry.word)} hitSlop={8}>
              <Text style={styles.answerWord}>{entry.word}</Text>
              <Image source={require('../../assets/speaker-icon.png')} style={styles.answerSoundIcon} />
            </Pressable>
            <Text style={styles.answerPos}>{posLabel(entry.pos)}</Text>
            <Text style={styles.answerMeaning}>{entry.meaning}</Text>

            <View style={styles.explain}>
              <Text style={styles.explainLabel}>範例句</Text>
              <Pressable onPress={() => speakExample(entry.word, entry.example)}>
                <Text style={styles.explainText}>{renderHighlightedExample()}</Text>
              </Pressable>
              <Text style={styles.explainZh}>{entry.exampleZh ?? '中文翻譯待補'}</Text>
              <Text style={styles.explainLabel}>字根字尾</Text>
              <Text style={styles.explainText}>{entry.roots}</Text>
            </View>
          </View>
        ) : mode === 'cloze' ? (
          <View style={styles.questionBody}>
            <Text style={styles.modeLabel}>選出最適合填入句子的單字</Text>
            <Text style={styles.cloze}>{blankedExample}</Text>
          </View>
        ) : (
          <View style={styles.questionBody}>
            <Text style={styles.modeLabel}>{mode === 'typing' ? '請輸入英文單字' : '選出正確答案'}</Text>
            <Text style={styles.question}>{question}</Text>
            {questionIsWord && (
              <Pressable
                style={styles.soundBtn}
                onPress={() => speakWord(entry.word)}
                hitSlop={8}
                accessibilityLabel="聽發音"
              >
                <Image source={require('../../assets/speaker-icon.png')} style={styles.soundIcon} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {answered && (
        <Pressable style={({ pressed }) => [styles.nextBtn, pressed && theme.slabPressed]} onPress={handleNext}>
          <Text style={styles.nextBtnText}>下一題</Text>
        </Pressable>
      )}

      {mode === 'typing' ? (
        <View style={styles.typingBox}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            editable={!answered}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="在這裡輸入單字"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            onSubmitEditing={handleTypingSubmit}
          />
          {!answered && (
            <Pressable style={({ pressed }) => [styles.submitBtn, pressed && theme.slabPressed]} onPress={handleTypingSubmit}>
              <Text style={styles.submitText}>送出</Text>
            </Pressable>
          )}
          {answered && !gotIt && <Text style={styles.wrongText}>你寫的：{selected || '（空白）'}</Text>}
        </View>
      ) : (
        <View style={styles.options}>
          {choices.map((choice, index) => (
            // Not `disabled` when answered: handleSelect already ignores late
            // taps, and a disabled parent would swallow the sound buttons.
            <Pressable key={choice} style={optionStyle(choice)} onPress={() => handleSelect(choice)}>
              <GlassFill intensity={26} fill={optionFill(choice)} />
              <View style={styles.optionRow}>
                <View style={optionKeyStyle(choice)}>
                  <Text style={optionKeyTextStyle(choice)}>{optionKeyLabel(choice, index)}</Text>
                </View>
                <Text style={optionTextStyle(choice)}>{choice}</Text>
              </View>
              {answered && settings.autoShowChoiceAnswers && renderOptionDetail(choice)}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { width: '100%', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18 },
  card: {
    ...t.pane(26),
    ...t.glassShadow,
    position: 'relative',
    width: '100%',
    maxWidth: 760,
    minHeight: 164,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
    // Clears the action row pinned to the top of the card, so a three-line
    // question can never run underneath it.
    paddingTop: 54,
    paddingBottom: 26,
  },
  cardActions: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  questionBody: { width: '100%', alignItems: 'center' },
  soundBtn: {
    marginTop: 16,
    width: 36,
    height: 36,
    backgroundColor: t.colors.blue,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundIcon: { width: 21, height: 21 },
  // A bare cross, no pink pill: the sheet it opens is what explains the word
  // is going to the familiar list, so the button itself needs no label.
  excludeBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  excludeBtnPressed: { opacity: 0.5 },
  excludeBtnText: { color: t.colors.redInk, fontSize: 19, fontWeight: '900' },
  // Outlined, then filled with the dark gold when on: yellow is the one colour
  // this palette never spreads across a surface.
  unsureBtn: {
    backgroundColor: t.glass.solid,
    borderWidth: 1.5,
    borderColor: t.slabEdge.yellow,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unsureBtnOn: { backgroundColor: t.colors.yellow, borderColor: t.colors.yellowInk },
  unsureBtnText: { color: t.colors.yellowInk, fontSize: 12, fontWeight: '900' },
  unsureBtnTextOn: { color: t.colors.yellowInk },
  modeLabel: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900', marginBottom: 10 },
  question: { color: t.colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  cloze: { color: t.colors.ink, fontSize: 20, fontWeight: '800', lineHeight: 28, textAlign: 'center' },
  answerBody: { width: '100%', alignItems: 'center' },
  verdictRight: { color: t.colors.greenInk, fontSize: 13, fontWeight: '900' },
  verdictWrong: { color: t.colors.redInk, fontSize: 13, fontWeight: '900' },
  answerWordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  answerWord: { color: t.colors.ink, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  answerSoundIcon: { width: 20, height: 20 },
  answerPos: { color: t.colors.yellowInk, fontSize: 13, fontWeight: '900', marginTop: 6 },
  answerMeaning: { color: t.colors.ink, fontSize: 19, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  explain: {
    width: '100%',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: t.glass.edge,
  },
  explainLabel: { color: t.colors.ink, fontWeight: '900', marginTop: 10, fontSize: 13 },
  explainText: { color: t.colors.muted, lineHeight: 21, marginTop: 4 },
  explainZh: { color: t.colors.ink, lineHeight: 21, marginTop: 6, fontWeight: '700' },
  highlightWord: { color: t.colors.yellowInk, fontWeight: '900' },
  options: { width: '100%', maxWidth: 760, marginTop: 16, gap: 12 },
  // A white hairline over a near-white page is no outline at all, which is why
  // these used to read as text floating on the background. The frame is now an
  // edge you can see all the way round, plus the slab lip, so an option looks
  // like a key waiting to be pressed.
  // The border has to be the same width the whole way round. A thicker bottom
  // lip on top of a large radius is what was drawing those straight overshoots
  // past the ends of the capsule: the corner cannot blend two widths, so it
  // gives up and squares off. Depth comes from the t.shadow instead.
  //
  // 34 is over half a resting option's height, so it clamps to a true capsule;
  // an answered option grows to hold its example and settles into a rounded
  // rectangle rather than a lens.
  option: {
    ...t.pane(34),
    ...t.softShadow,
    borderWidth: 1.5,
    borderColor: t.slabEdge.blue,
    paddingVertical: 15,
    paddingHorizontal: 22,
  },
  // No lip to squash, so pressing sinks the whole key a hair instead.
  optionPressed: { transform: [{ translateY: 1 }], opacity: 0.88 },
  optionCorrect: { borderColor: t.slabEdge.green },
  optionWrong: { borderColor: t.slabEdge.red },
  // Was 0.5, but the unpicked options now carry example sentences worth
  // reading. Their edge goes quiet instead: only the two that decided the
  // question keep a coloured frame.
  optionDisabled: { opacity: 0.85, borderColor: t.slabEdge.line },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  // A lettered key on the left gives every row the same place to start reading
  // from, and once answered it is where the ✓ or ✗ lands.
  optionKey: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.glass.solid,
    borderWidth: 1.5,
    borderColor: t.slabEdge.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionKeyCorrect: { backgroundColor: t.colors.green, borderColor: t.slabEdge.green },
  optionKeyWrong: { backgroundColor: t.colors.red, borderColor: t.slabEdge.red },
  optionKeyText: { color: t.colors.blueInk, fontSize: 15, fontWeight: '900' },
  optionKeyTextCorrect: { color: t.colors.greenInk },
  optionKeyTextWrong: { color: t.colors.redInk },
  optionText: { flex: 1, fontSize: 16, color: t.colors.ink, fontWeight: '700' },
  optionTextFeedback: { color: t.colors.ink, fontWeight: '800' },
  optionMeta: { color: t.colors.muted, fontSize: 13, fontWeight: '700', marginTop: 5 },
  optionMetaFeedback: { color: t.colors.ink, fontSize: 13, fontWeight: '800', marginTop: 5 },
  // Indented to clear the lettered key, so the detail lines up under the
  // option's own text rather than under its badge.
  optionDetail: { marginTop: 10, paddingLeft: 45 },
  optionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionSound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: t.glass.solid,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionSoundIcon: { width: 15, height: 15 },
  optionSoundText: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900' },
  optionPos: { color: t.colors.yellowInk, fontSize: 12, fontWeight: '900' },
  optionPosFeedback: { color: t.colors.ink, fontSize: 12, fontWeight: '900' },
  optionExample: { color: t.colors.ink, fontSize: 13, lineHeight: 19, marginTop: 8, fontStyle: 'italic' },
  optionExampleFeedback: {
    color: t.colors.ink,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // Directly under the card, not under the options: after reading the
  // explanation the way on is the next thing your thumb reaches.
  nextBtn: {
    ...t.slab(t.slabEdge.blue),
    marginTop: 14,
    backgroundColor: t.colors.blue,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
  },
  nextBtnText: { color: t.colors.blueInk, fontWeight: '900', fontSize: 16 },
  typingBox: { width: '100%', maxWidth: 760, marginTop: 16, gap: 10 },
  input: {
    backgroundColor: t.glass.solid,
    // A white edge on a near-white fill draws nothing. This is the one field
    // you type into, so it gets a real hairline to sit inside.
    borderWidth: 1,
    borderColor: t.slabEdge.line,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: t.colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  submitBtn: {
    ...t.slab(t.slabEdge.blue),
    backgroundColor: t.colors.blue,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: t.colors.blueInk, fontWeight: '900' },
  wrongText: { color: t.colors.redInk, fontWeight: '900', textAlign: 'center', fontSize: 16 },
});
