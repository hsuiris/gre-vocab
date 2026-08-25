import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { words } from '../data/words';
import { getAllProgress, resetAllProgress, getExcludedWords } from '../lib/storage';
import { GlassFill } from '../components/Glass';
import { centered } from '../theme';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = NativeStackScreenProps<RootStackParamList, 'Stats'>;

export function StatsScreen({ navigation }: Props) {
  const styles = useStyles(makeStyles);
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
      <Text style={styles.eyebrow}>複習狀態</Text>
      <Text style={styles.title}>你的單字庫</Text>

      <View style={styles.summary}>
        <GlassFill intensity={28} />
        <Text style={styles.summaryCount}>{newCount}</Text>
        <Text style={styles.summaryLabel}>尚未開始的字</Text>
      </View>

      <View style={styles.list}>
        <GlassFill />
        {boxCounts.map((count, i) => (
          <Pressable key={i} style={styles.row} onPress={() => navigation.navigate('BoxWords', { box: i + 1 })}>
            <View>
              <Text style={styles.rowTitle}>盒子 {i + 1}</Text>
              <Text style={styles.rowMeta}>{[1, 2, 4, 7, 14][i]} 天後再見</Text>
            </View>
            <Text style={styles.rowCount}>{count}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.linkCard} onPress={() => navigation.navigate('Excluded')}>
        <GlassFill />
        <View>
          <Text style={styles.rowTitle}>已標記太簡單</Text>
          <Text style={styles.rowMeta}>暫時不排進複習</Text>
        </View>
        <Text style={styles.rowCount}>{excludedCount}</Text>
      </Pressable>

      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetText}>重置所有進度</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: { ...centered, flex: 1, padding: 20, gap: 14 },
  eyebrow: { color: t.colors.blueInk, fontSize: 14, fontWeight: '900' },
  title: { color: t.colors.ink, fontSize: 32, fontWeight: '900', marginBottom: 4 },
  summary: { ...t.pane(28), ...t.glassShadow, padding: 24 },
  summaryCount: { color: t.colors.ink, fontSize: 48, fontWeight: '900' },
  summaryLabel: { color: t.colors.muted, fontSize: 16, fontWeight: '800', marginTop: 4 },
  list: { ...t.pane(24), ...t.glassShadow },
  row: {
    minHeight: 72,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: t.glass.edge,
  },
  rowTitle: { color: t.colors.ink, fontSize: 16, fontWeight: '900' },
  rowMeta: { color: t.colors.muted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  rowCount: { color: t.colors.blueInk, fontSize: 24, fontWeight: '900' },
  linkCard: {
    ...t.pane(24),
    ...t.glassShadow,
    minHeight: 76,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resetButton: { marginTop: 8, backgroundColor: t.colors.red, padding: 15, borderRadius: 22, alignItems: 'center' },
  resetText: { color: t.colors.redInk, fontWeight: '900' },
});
