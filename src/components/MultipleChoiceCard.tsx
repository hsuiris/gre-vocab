import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Image } from 'react-native';
import type { QuizMode } from '../navigation/RootNavigator';
import { WordEntry } from '../data/words';
import { getRelation } from '../data/relations';
import type { AppSettings } from '../lib/storage';
import { speakWord } from '../lib/speech';
import { colors, slab, slabEdge, slabPressed } from '../theme';

type Props = {
  entry: WordEntry;
  direction: 'en-zh' | 'zh-en';
  mode: QuizMode;
  choices: string[];
  choiceEntries: Record<string, WordEntry>;
  settings: AppSettings;
  onResult: (knewIt: boolean) => void;
  // Fires the instant an answer is picked, not when the card advances, so the
  // mascot can react while the result is still on screen.
  onAnswered: (correct: boolean) => void;
  onExclude: () => void;
  onMarkUnsure: () => void;
  unsure: boolean;
  // Rendered beside the question. Passed in rather than built here so the
  // screen stays the one place that knows how the last answer went.
  mascot?: React.ReactNode;
};

// words.json stores parts of speech as "v." or "n./adj."; spell them out so the
// grammar hint reads as Chinese rather than dictionary shorthand.
const POS_ZH: Record<string, string> = {
  'n.': '名詞',
  'v.': '動詞',
  'adj.': '形容詞',
  'adv.': '副詞',
  'conj.': '連接詞',
};

function posLabel(pos: string): string {
  return pos
    .split('/')
    .map((p) => POS_ZH[p.trim()] ?? p.trim())
    .join('／');
}

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
  mascot,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [expanded, setExpanded] = useState(false);

  const question = mode === 'choice' && direction === 'en-zh' ? entry.word : entry.meaning;
  const correctAnswer = mode === 'choice' && direction === 'en-zh' ? entry.meaning : entry.word;
  const answered = selected !== null;
  const blankedExample = entry.example.replace(new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');

  function isCorrect(answer: string) {
    return answer.trim().toLowerCase() === correctAnswer.toLowerCase();
  }

  function handleSelect(choice: string) {
    if (answered) return; // locked after first tap
    setSelected(choice);
    onAnswered(isCorrect(choice));
    if (settings.autoShowDetails) setExpanded(true);
  }

  function handleTypingSubmit() {
    if (answered) return;
    const answer = typed.trim();
    setSelected(answer);
    onAnswered(isCorrect(answer));
    if (settings.autoShowDetails) setExpanded(true);
  }

  function handleNext() {
    const knewIt = isCorrect(selected ?? '');
    setSelected(null);
    setTyped('');
    setExpanded(false);
    onResult(knewIt);
  }

  function optionStyle(choice: string) {
    return ({ pressed }: { pressed: boolean }) => {
      // Only an unanswered option can be pressed down; once locked, the key
      // staying put is the feedback.
      const press = pressed && !answered ? slabPressed : null;
      if (!answered) return [styles.option, press];
      if (choice === correctAnswer) return [styles.option, styles.optionCorrect];
      if (choice === selected) return [styles.option, styles.optionWrong];
      return [styles.option, styles.optionDisabled];
    };
  }

  function optionTextStyle(choice: string) {
    if (!answered) return styles.optionText;
    if (choice === correctAnswer || choice === selected) return [styles.optionText, styles.optionTextFeedback];
    return styles.optionText;
  }

  // Every option, right or wrong, gets its own speaker button plus grammar and
  // example, so a revealed card teaches four words instead of one.
  function renderOptionDetail(choice: string) {
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
        <Pressable onPress={() => speakWord(info.example)}>
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
          <Pressable style={styles.excludeBtn} onPress={onExclude} hitSlop={8}>
            <Text style={styles.excludeBtnText}>太簡單</Text>
          </Pressable>
        </View>
        <Pressable style={styles.soundBtn} onPress={() => speakWord(entry.word)} hitSlop={8}>
          <Image source={require('../../assets/speaker-icon.png')} style={styles.soundIcon} />
        </Pressable>
        <View style={styles.cardRow}>
          {mascot}
          <View style={styles.cardTextCol}>
            {mode === 'cloze' ? (
              <>
                <Text style={styles.modeLabel}>選出最適合填入句子的單字</Text>
                <Text style={styles.cloze}>{blankedExample}</Text>
              </>
            ) : (
              <>
                <Text style={styles.modeLabel}>{mode === 'typing' ? '請輸入英文單字' : '選出正確答案'}</Text>
                <Text style={styles.question}>{question}</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {mode === 'typing' ? (
        <View style={styles.typingBox}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            editable={!answered}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="在這裡輸入單字"
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={handleTypingSubmit}
          />
          {!answered && (
            <Pressable style={({ pressed }) => [styles.submitBtn, pressed && slabPressed]} onPress={handleTypingSubmit}>
              <Text style={styles.submitText}>送出</Text>
            </Pressable>
          )}
          {answered && (
            <Text style={selected?.trim().toLowerCase() === correctAnswer.toLowerCase() ? styles.correctText : styles.wrongText}>
              正解：{correctAnswer}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.options}>
          {choices.map((choice) => (
            // Not `disabled` when answered: handleSelect already ignores late
            // taps, and a disabled parent would swallow the sound buttons.
            <Pressable key={choice} style={optionStyle(choice)} onPress={() => handleSelect(choice)}>
              <Text style={optionTextStyle(choice)}>{choice}</Text>
              {answered && settings.autoShowChoiceAnswers && renderOptionDetail(choice)}
            </Pressable>
          ))}
        </View>
      )}

      {answered && (
        <Pressable style={({ pressed }) => [styles.nextBtn, pressed && slabPressed]} onPress={handleNext}>
          <Text style={styles.nextBtnText}>下一題</Text>
        </Pressable>
      )}

      {answered && (
        <>
          <Pressable onPress={() => setExpanded(!expanded)}>
            <Text style={styles.detailToggle}>{expanded ? '收起詳情' : '查看詳情'}</Text>
          </Pressable>

          {expanded && (
            <View style={styles.detail}>
              <Text style={styles.detailLabel}>範例句</Text>
              <Text style={styles.detailText}>{renderHighlightedExample()}</Text>
              <Text style={styles.translationText}>{entry.exampleZh ?? '中文翻譯待補'}</Text>
              <Text style={styles.detailLabel}>字根字尾</Text>
              <Text style={styles.detailText}>{entry.roots}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 18 },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 760,
    minHeight: 164,
    borderRadius: 26,
    // Tinted, not white: the whole answer area now sits on a white panel, so a
    // white question card would have nothing to stand out against.
    backgroundColor: colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
    // Clears the action row on top and the speaker button at the bottom, so a
    // three-line question can never run underneath either of them.
    paddingVertical: 52,
  },
  cardActions: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  soundBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 36,
    height: 36,
    backgroundColor: colors.blue,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundIcon: { width: 21, height: 21 },
  excludeBtn: {
    backgroundColor: colors.red,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  excludeBtnText: { color: colors.redInk, fontSize: 12, fontWeight: '900' },
  // Outlined, then filled with the dark gold when on: yellow is the one colour
  // this palette never spreads across a surface.
  unsureBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: slabEdge.yellow,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  unsureBtnOn: { backgroundColor: colors.yellow, borderColor: colors.yellowInk },
  unsureBtnText: { color: colors.yellowInk, fontSize: 12, fontWeight: '900' },
  unsureBtnTextOn: { color: colors.yellowInk },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTextCol: { flex: 1, alignItems: 'center' },
  modeLabel: { color: colors.blueInk, fontSize: 13, fontWeight: '900', marginBottom: 10 },
  question: { color: colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  cloze: { color: colors.ink, fontSize: 20, fontWeight: '800', lineHeight: 28, textAlign: 'center' },
  options: { width: '100%', maxWidth: 760, marginTop: 16, gap: 10 },
  option: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.line,
    ...slab(slabEdge.line),
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  optionCorrect: { backgroundColor: colors.green, borderColor: slabEdge.green, ...slab(slabEdge.green) },
  optionWrong: { backgroundColor: colors.red, borderColor: slabEdge.red, ...slab(slabEdge.red) },
  // Was 0.5, but the unpicked options now carry example sentences worth reading.
  optionDisabled: { opacity: 0.8 },
  optionText: { fontSize: 16, color: colors.ink, fontWeight: '700', textAlign: 'center' },
  optionTextFeedback: { color: colors.ink, fontWeight: '800' },
  optionMeta: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  optionMetaFeedback: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  optionDetail: { marginTop: 10, alignItems: 'center' },
  optionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionSound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  optionSoundIcon: { width: 15, height: 15 },
  optionSoundText: { color: colors.blueInk, fontSize: 13, fontWeight: '900' },
  optionPos: { color: colors.yellowInk, fontSize: 12, fontWeight: '900' },
  optionPosFeedback: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  optionExample: { color: colors.ink, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
  optionExampleFeedback: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  nextBtn: {
    ...slab(slabEdge.blue),
    marginTop: 18,
    backgroundColor: colors.blue,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
  },
  nextBtnText: { color: colors.blueInk, fontWeight: '900', fontSize: 16 },
  typingBox: { width: '100%', maxWidth: 760, marginTop: 16, gap: 10 },
  input: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  submitBtn: {
    ...slab(slabEdge.blue),
    backgroundColor: colors.blue,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: { color: colors.blueInk, fontWeight: '900' },
  correctText: { color: colors.greenInk, fontWeight: '900', textAlign: 'center', fontSize: 16 },
  wrongText: { color: colors.redInk, fontWeight: '900', textAlign: 'center', fontSize: 16 },
  detailToggle: { marginTop: 18, color: colors.blueInk, fontWeight: '900' },
  detail: {
    marginTop: 14,
    width: '100%',
    maxWidth: 760,
    backgroundColor: colors.page,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  detailLabel: { color: colors.ink, fontWeight: '900', marginTop: 10 },
  detailText: { color: colors.muted, lineHeight: 21, marginTop: 4 },
  highlightWord: { color: colors.yellowInk, fontWeight: '900' },
  translationText: { color: colors.ink, lineHeight: 21, marginTop: 8, fontWeight: '700' },
});
