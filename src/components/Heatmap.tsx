import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = { heatmap: Record<string, number>; weeks?: number };

export function colorForCount(count: number): string {
  if (count === 0) return '#d9e9ec';
  if (count < 5) return '#bdeee2';
  if (count < 15) return '#66d9bd';
  if (count < 30) return colors.green;
  return '#08765a';
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Heatmap({ heatmap, weeks = 16 }: Props) {
  const days: Date[] = [];
  const today = new Date();
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const columns: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.grid}>
        {columns.map((col, ci) => (
          <View key={ci} style={styles.column}>
            {col.map((d, di) => (
              <View
                key={di}
                style={[styles.cell, { backgroundColor: colorForCount(heatmap[toDateStr(d)] ?? 0) }]}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginVertical: 12 },
  grid: { flexDirection: 'row' },
  column: { marginRight: 4 },
  cell: { width: 13, height: 13, borderRadius: 4, marginBottom: 4 },
});
