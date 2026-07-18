import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

type Props = { heatmap: Record<string, number>; weeks?: number };

export function colorForCount(count: number): string {
  if (count === 0) return '#ebedf0';
  if (count < 5) return '#c6e48b';
  if (count < 15) return '#7bc96f';
  if (count < 30) return '#239a3b';
  return '#196127';
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
  column: { marginRight: 3 },
  cell: { width: 12, height: 12, borderRadius: 2, marginBottom: 3 },
});
