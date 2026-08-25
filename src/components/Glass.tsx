import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../lib/useTheme';

// Drop this in as the first child of any container styled with pane(): it fills
// the container with a real blur plus a milky tint, and the container's own
// children draw on top of it. Kept as a fill rather than a wrapper so a
// Pressable can stay a Pressable.
//
// `fill` defaults to the active theme's own, which is why it is resolved here
// rather than in the parameter list.
export function GlassFill({ intensity = 50, fill }: { intensity?: number; fill?: string }) {
  const theme = useTheme();
  return (
    <>
      <BlurView
        intensity={Math.round(intensity * theme.blurScale)}
        tint="light"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: fill ?? theme.glass.fill }]}
        pointerEvents="none"
      />
    </>
  );
}

// Where each light sits, as a fraction of the window, and how wide it spreads.
// Two lights across a diagonal, both hung half off an edge — the page reads as
// one lit surface. Three discs sitting fully on screen read as three stickers,
// which is the thing this replaced.
const SPOTS = [
  { x: 0.04, y: -0.04, size: 1.45 },
  { x: 1.02, y: 0.74, size: 1.2 },
  { x: 0.35, y: 1.12, size: 1.0 },
];

// A plain View has a hard edge, and a hard-edged disc of saturated colour is a
// sticker, not light. Stacking rings of one colour at a fraction of its alpha
// fakes the falloff a real glow has: every ring piles up at the centre, only
// the widest reaches the rim, and nowhere is there an edge to see.
const RINGS = 7;

export function Backdrop() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const base = Math.max(width, height * 0.55);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {theme.backdrop.map((color, i) => {
        const spot = SPOTS[i % SPOTS.length];
        return Array.from({ length: RINGS }, (_, ring) => {
          const d = base * spot.size * (0.28 + (0.72 * (ring + 1)) / RINGS);
          return (
            <View
              key={`${i}-${ring}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: width * spot.x - d / 2,
                top: height * spot.y - d / 2,
                width: d,
                height: d,
                borderRadius: d / 2,
                backgroundColor: color,
                opacity: theme.blobOpacity / RINGS,
              }}
            />
          );
        });
      })}
    </View>
  );
}
