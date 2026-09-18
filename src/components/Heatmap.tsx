import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { calm, type Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

type Props = { heatmap: Record<string, number>; weeks?: number };

// Deepening with the day's count. A plain function, not a hook: the ramp comes
// in as an argument so the ladder can be tested on its own.
export function colorForCount(count: number, heat: Theme['heat'] = calm.heat): string {
  if (count === 0) return heat[0];
  if (count < 5) return heat[1];
  if (count < 15) return heat[2];
  if (count < 30) return heat[3];
  return heat[4];
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Heatmap({ heatmap, weeks = 16 }: Props) {
  const styles = useStyles(makeStyles);
  const theme = useTheme();
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
                style={[styles.cell, { backgroundColor: colorForCount(heatmap[toDateStr(d)] ?? 0, theme.heat) }]}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  scroll: { marginVertical: 12 },
  grid: { flexDirection: 'row' },
  column: { marginRight: 4 },
  cell: { width: 13, height: 13, borderRadius: 4, marginBottom: 4 },
});
