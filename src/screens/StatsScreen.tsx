import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { getAllProgress, resetAllProgress, getExcludedWords } from '../lib/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

export function StatsScreen({ navigation }: Props) {
  const [boxCounts, setBoxCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const [newCount, setNewCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);

  const load = useCallback(async () => {
    const [progress, excluded] = await Promise.all([getAllProgress(), getExcludedWords()]);
    const counts = [0, 0, 0, 0, 0];
    let newWords = 0;
    for (const w of words) {
      const p = progress[w.word];
      if (!p) {
        newWords++;
      } else {
        counts[p.box - 1]++;
      }
    }
    setBoxCounts(counts);
    setNewCount(newWords);
    setExcludedCount(excluded.length);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleReset() {
    Alert.alert('重置進度', '確定要清除所有複習紀錄嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定',
        style: 'destructive',
        onPress: async () => {
          await resetAllProgress();
          load();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>統計</Text>
      <Text>尚未開始：{newCount} 字</Text>
      {boxCounts.map((count, i) => (
        <Text key={i}>盒子 {i + 1}：{count} 字</Text>
      ))}
      <Pressable style={styles.linkButton} onPress={() => navigation.navigate('Excluded')}>
        <Text style={styles.linkText}>已標記太簡單：{excludedCount} 字</Text>
      </Pressable>
      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetText}>重置所有進度</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  linkButton: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#3949ab' },
  resetButton: { marginTop: 24, backgroundColor: '#c62828', padding: 12, borderRadius: 8, alignItems: 'center' },
  resetText: { color: '#fff', fontWeight: '600' },
});
