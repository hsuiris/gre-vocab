import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { WordEntry } from '../data/words';
import { speakWord } from '../lib/speech';

type Props = {
  entry: WordEntry;
  direction: 'en-zh' | 'zh-en';
  onResult: (knewIt: boolean) => void;
};

export function FlashCard({ entry, direction, onResult }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  const front = direction === 'en-zh' ? entry.word : entry.meaning;
  const back = direction === 'en-zh' ? entry.meaning : entry.word;

  function flip() {
    Animated.timing(spin, {
      toValue: flipped ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  }

  function handleResult(knewIt: boolean) {
    setFlipped(false);
    setExpanded(false);
    spin.setValue(0);
    onResult(knewIt);
  }

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.container}>
      <Pressable onPress={flip}>
        <Animated.View style={[styles.card, { transform: [{ rotateY }] }]}>
          <Text style={styles.cardText}>{flipped ? back : front}</Text>
        </Animated.View>
      </Pressable>

      {flipped && (
        <View style={styles.actions}>
          <Pressable style={styles.knowBtn} onPress={() => handleResult(true)}>
            <Text style={styles.btnText}>認識</Text>
          </Pressable>
          <Pressable style={styles.dontKnowBtn} onPress={() => handleResult(false)}>
            <Text style={styles.btnText}>不認識</Text>
          </Pressable>
        </View>
      )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 16 },
  card: {
    width: 300,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardText: { fontSize: 28, fontWeight: '600' },
  actions: { flexDirection: 'row', marginTop: 16, gap: 12 },
  knowBtn: { backgroundColor: '#2e7d32', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  dontKnowBtn: { backgroundColor: '#c62828', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
  detailToggle: { marginTop: 16, color: '#555' },
  detail: { marginTop: 12, width: 300 },
  speaker: { fontSize: 18, marginBottom: 8 },
  detailLabel: { fontWeight: '600', marginTop: 8 },
  detailText: { color: '#333' },
});
