import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Image } from 'react-native';
import type { QuizMode } from '../navigation/RootNavigator';
import { WordEntry } from '../data/words';
import type { AppSettings } from '../lib/storage';
import { speakWord } from '../lib/speech';
import { colors, shadow } from '../theme';

type Props = {
  entry: WordEntry;
  direction: 'en-zh' | 'zh-en';
  mode: QuizMode;
  choices: string[];
  choiceAnswers: Record<string, string>;
  settings: AppSettings;
  onResult: (knewIt: boolean) => void;
  onExclude: () => void;
};

export function MultipleChoiceCard({ entry, direction, mode, choices, choiceAnswers, settings, onResult, onExclude }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [expanded, setExpanded] = useState(false);

  const question = mode === 'choice' && direction === 'en-zh' ? entry.word : entry.meaning;
  const correctAnswer = mode === 'choice' && direction === 'en-zh' ? entry.meaning : entry.word;
  const answered = selected !== null;
  const blankedExample = entry.example.replace(new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');

  function handleSelect(choice: string) {
    if (answered) return; // locked after first tap
    setSelected(choice);
    if (settings.autoShowDetails) setExpanded(true);
  }

  function handleTypingSubmit() {
    if (answered) return;
    setSelected(typed.trim());
    if (settings.autoShowDetails) setExpanded(true);
  }

  function handleNext() {
    const knewIt = selected?.trim().toLowerCase() === correctAnswer.toLowerCase();
    setSelected(null);
    setTyped('');
    setExpanded(false);
    onResult(knewIt);
  }

  function optionStyle(choice: string) {
    if (!answered) return styles.option;
    if (choice === correctAnswer) return [styles.option, styles.optionCorrect];
    if (choice === selected) return [styles.option, styles.optionWrong];
    return [styles.option, styles.optionDisabled];
  }

  function optionTextStyle(choice: string) {
    if (!answered) return styles.optionText;
    if (choice === correctAnswer || choice === selected) return [styles.optionText, styles.optionTextFeedback];
    return styles.optionText;
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
          <Pressable style={styles.excludeBtn} onPress={onExclude} hitSlop={8}>
            <Text style={styles.excludeBtnText}>太簡單</Text>
          </Pressable>
        </View>
        <Pressable style={styles.soundBtn} onPress={() => speakWord(entry.word)} hitSlop={8}>
          <Image source={require('../../assets/speaker-icon.png')} style={styles.soundIcon} />
        </Pressable>
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
            <Pressable style={styles.submitBtn} onPress={handleTypingSubmit}>
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
            <Pressable
              key={choice}
              style={optionStyle(choice)}
              onPress={() => handleSelect(choice)}
              disabled={answered}
            >
              <Text style={optionTextStyle(choice)}>{choice}</Text>
              {answered && settings.autoShowChoiceAnswers && choiceAnswers[choice] && (
                <Text style={choice === correctAnswer || choice === selected ? styles.optionMetaFeedback : styles.optionMeta}>
                  {choiceAnswers[choice]}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}

      {answered && (
        <Pressable style={styles.nextBtn} onPress={handleNext}>
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
  container: { alignItems: 'center', padding: 18 },
  card: {
    ...shadow,
    position: 'relative',
    width: '100%',
    maxWidth: 360,
    minHeight: 164,
    borderRadius: 30,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  cardActions: { position: 'absolute', top: 14, right: 14 },
  soundBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 36,
    height: 36,
    backgroundColor: colors.blueSoft,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soundIcon: { width: 21, height: 21 },
  excludeBtn: {
    backgroundColor: colors.redSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  excludeBtnText: { color: colors.red, fontSize: 12, fontWeight: '900' },
  modeLabel: { color: colors.green, fontSize: 13, fontWeight: '900', marginBottom: 10 },
  question: { color: colors.ink, fontSize: 34, fontWeight: '900', textAlign: 'center', paddingHorizontal: 34 },
  cloze: { color: colors.ink, fontSize: 20, fontWeight: '800', lineHeight: 28, textAlign: 'center' },
  options: { width: '100%', maxWidth: 360, marginTop: 18, gap: 10 },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  optionCorrect: { backgroundColor: colors.green, borderColor: colors.green },
  optionWrong: { backgroundColor: colors.red, borderColor: colors.red },
  optionDisabled: { opacity: 0.5 },
  optionText: { fontSize: 16, color: colors.ink, fontWeight: '700', textAlign: 'center' },
  optionTextFeedback: { color: '#fff', fontWeight: '600' },
  optionMeta: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 5 },
  optionMetaFeedback: { color: colors.surface, fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  nextBtn: {
    marginTop: 18,
    backgroundColor: colors.blue,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 22,
  },
  nextBtnText: { color: colors.surface, fontWeight: '900', fontSize: 16 },
  typingBox: { width: '100%', maxWidth: 360, marginTop: 18, gap: 10 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
  },
  submitBtn: { backgroundColor: colors.blue, borderRadius: 20, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: colors.surface, fontWeight: '900' },
  correctText: { color: colors.green, fontWeight: '900', textAlign: 'center', fontSize: 16 },
  wrongText: { color: colors.red, fontWeight: '900', textAlign: 'center', fontSize: 16 },
  detailToggle: { marginTop: 18, color: colors.blue, fontWeight: '900' },
  detail: {
    marginTop: 14,
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  detailLabel: { color: colors.ink, fontWeight: '900', marginTop: 10 },
  detailText: { color: colors.muted, lineHeight: 21, marginTop: 4 },
  highlightWord: { color: colors.orange, fontWeight: '900' },
  translationText: { color: colors.ink, lineHeight: 21, marginTop: 8, fontWeight: '700' },
});
