import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { words } from '../data/words';
import { getAllProgress, getHeatmap } from '../lib/storage';
import { isDue } from '../lib/leitner';
import { Heatmap } from '../components/Heatmap';
import { todayStr } from '../lib/date';

export function HomeScreen({ navigation }: any) {
  const [dueCount, setDueCount] = useState(0);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [progress, heat] = await Promise.all([getAllProgress(), getHeatmap()]);
        const today = todayStr();
        const due = words.filter((w) => {
          const p = progress[w.word];
          return !p || isDue(p, today);
        }).length;
        if (active) {
          setDueCount(due);
          setHeatmap(heat);
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GRE 單字複習</Text>
      <Text style={styles.due}>今日待複習：{dueCount} 字</Text>

      <Pressable style={styles.button} onPress={() => navigation.navigate('Practice', { direction: 'en-zh' })}>
        <Text style={styles.buttonText}>英 → 中</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('Practice', { direction: 'zh-en' })}>
        <Text style={styles.buttonText}>中 → 英</Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={() => navigation.navigate('Stats')}>
        <Text style={styles.linkText}>統計</Text>
      </Pressable>

      <Heatmap heatmap={heatmap} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  due: { fontSize: 16, color: '#555', marginBottom: 20 },
  button: { backgroundColor: '#3949ab', padding: 14, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', marginBottom: 20 },
  linkText: { color: '#3949ab' },
});
