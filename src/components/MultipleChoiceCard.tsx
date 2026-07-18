import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { WordEntry } from '../data/words';
import { speakWord } from '../lib/speech';

type Props = {
  entry: WordEntry;
  direction: 'en-zh' | 'zh-en';
  choices: string[];
  onResult: (knewIt: boolean) => void;
  onExclude: () => void;
};

export function MultipleChoiceCard({ entry, direction, choices, onResult, onExclude }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const question = direction === 'en-zh' ? entry.word : entry.meaning;
  const correctAnswer = direction === 'en-zh' ? entry.meaning : entry.word;
  const answered = selected !== null;

  function handleSelect(choice: string) {
    if (answered) return; // locked after first tap
    setSelected(choice);
  }

  function handleNext() {
    const knewIt = selected === correctAnswer;
    setSelected(null);
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

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.question}>{question}</Text>
        <Pressable
          style={styles.excludeBtn}
          onPress={onExclude}
          hitSlop={12}
        >
          <Text style={styles.excludeBtnText}>🗑️</Text>
        </Pressable>
      </View>

      <View style={styles.options}>
        {choices.map((choice) => (
          <Pressable
            key={choice}
            style={optionStyle(choice)}
            onPress={() => handleSelect(choice)}
            disabled={answered}
          >
            <Text style={optionTextStyle(choice)}>{choice}</Text>
          </Pressable>
        ))}
      </View>

      {answered && (
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>下一題</Text>
        </Pressable>
      )}

      {answered && (
        <>
          <Pressable onPress={() => setExpanded(!expanded)}>
            <Text style={styles.detailToggle}>{expanded ? '收起詳情 ▲' : '詳情 ▼'}</Text>
          </Pressable>

          {expanded && (
            <View style={styles.detail}>
              <Pressable onPress={() => speakWord(entry.word)}>
                <Text style={styles.speaker}>🔊 {entry.word}</Text>
              </Pressable>
              <Text style={styles.detailLabel}>範例句</Text>
              <Text style={styles.detailText}>{entry.example}</Text>
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
  container: { alignItems: 'center', padding: 16 },
  card: {
    position: 'relative',
    width: 300,
    minHeight: 100,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  excludeBtn: { position: 'absolute', top: 8, right: 8 },
  excludeBtnText: { fontSize: 16 },
  question: { fontSize: 26, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40 },
  options: { width: 300, marginTop: 16, gap: 10 },
  option: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionCorrect: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  optionWrong: { backgroundColor: '#c62828', borderColor: '#c62828' },
  optionDisabled: { opacity: 0.5 },
  optionText: { fontSize: 16, color: '#222', textAlign: 'center' },
  optionTextFeedback: { color: '#fff', fontWeight: '600' },
  nextBtn: {
    marginTop: 16,
    backgroundColor: '#3949ab',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  nextBtnText: { color: '#fff', fontWeight: '600' },
  detailToggle: { marginTop: 16, color: '#555' },
  detail: { marginTop: 12, width: 300 },
  speaker: { fontSize: 18, marginBottom: 8 },
  detailLabel: { fontWeight: '600', marginTop: 8 },
  detailText: { color: '#333' },
});
