import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import type { Theme } from '../theme';
import { useStyles, useTheme } from '../lib/useTheme';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type Props = {
  // Letter to the row index it starts at. Only used to tell which letters have
  // any words at all: a missing letter is dimmed and inert.
  starts: Record<string, number>;
  // The letter currently being shown, so the rail stays marked after release.
  selected: string | null;
  onPick: (letter: string) => void;
};

/** Build the letter map once from any list already sorted A-Z. */
export function letterStarts<T>(rows: T[], wordOf: (row: T) => string): Record<string, number> {
  const starts: Record<string, number> = {};
  rows.forEach((row, index) => {
    const letter = wordOf(row)[0]?.toUpperCase();
    if (letter && starts[letter] === undefined) starts[letter] = index;
  });
  return starts;
}

// A rail you can tap or drag a finger down, with the current letter shown in a
// bubble beside your thumb — dragging is the point, since 26 tap targets down
// the edge of a phone are each about 20pt tall.
export function AlphabetIndex({ starts, selected, onPick }: Props) {
  const styles = useStyles(makeStyles);
  const [active, setActive] = useState<{ letter: string; y: number } | null>(null);
  const heightRef = useRef(0);

  function scrub(event: GestureResponderEvent) {
    const y = event.nativeEvent.locationY;
    if (heightRef.current <= 0) return;
    const slot = Math.floor((y / heightRef.current) * ALPHABET.length);
    const letter = ALPHABET[Math.min(ALPHABET.length - 1, Math.max(0, slot))];
    if (!letter || letter === active?.letter) return;
    setActive({ letter, y });
    if (starts[letter] !== undefined) onPick(letter);
  }

  return (
    <View
      style={styles.strip}
      onLayout={(event: LayoutChangeEvent) => {
        heightRef.current = event.nativeEvent.layout.height;
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={scrub}
      onResponderMove={scrub}
      onResponderRelease={() => setActive(null)}
      onResponderTerminate={() => setActive(null)}
    >
      {active && (
        <View style={[styles.bubble, { top: Math.max(0, active.y - 22) }]} pointerEvents="none">
          <Text style={styles.bubbleText}>{active.letter}</Text>
        </View>
      )}
      {ALPHABET.map((letter) => (
        <Text
          key={letter}
          style={
            starts[letter] === undefined
              ? styles.letterOff
              : letter === (active?.letter ?? selected)
                ? styles.letterOn
                : styles.letter
          }
        >
          {letter}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // space-evenly, so a finger's position down the rail maps to a letter.
  strip: { width: 22, justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: 6 },
  letter: { color: t.colors.blueInk, fontSize: 10, fontWeight: '900' },
  letterOn: { color: t.colors.blueInk, fontSize: 13, fontWeight: '900' },
  letterOff: { color: t.colors.line, fontSize: 10, fontWeight: '900' },
  bubble: {
    position: 'absolute',
    right: 26,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.colors.blueInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: { color: t.colors.surface, fontSize: 20, fontWeight: '900' },
});
