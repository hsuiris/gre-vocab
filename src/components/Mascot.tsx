import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { GIRL } from './mascots';
import { colors } from '../theme';

export type Mood = 'idle' | 'happy' | 'sad';

type Props = {
  mood?: Mood;
  message?: string;
  size?: number;
  style?: ViewStyle;
};

// A drawn pose per mood, plus motion on top of it: the hop lands with the
// arms-up artwork and the shake runs under the worried one, so the drawing and
// the animation say the same thing.
export function Mascot({ mood = 'idle', message, size = 128, style }: Props) {
  // Only reacts. An idle loop is movement in the corner of the eye while
  // someone is trying to read a word, which is the last thing this screen needs.
  const react = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mood === 'idle') return;
    react.setValue(0);
    Animated.timing(react, {
      toValue: 1,
      duration: mood === 'happy' ? 700 : 520,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [mood, react]);

  const hop = react.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -30, -2, -10, 0] });
  const shake = react.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -9, 9, -6, 3, 0] });
  // Sparks fly out on a hop and are gone by the time the character lands.
  const sparkScale = react.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.2, 1.4, 1.7] });
  const sparkFade = react.interpolate({ inputRange: [0, 0.25, 0.8], outputRange: [0, 1, 0], extrapolate: 'clamp' });

  const transform =
    mood === 'happy' ? [{ translateY: hop }] : mood === 'sad' ? [{ translateX: shake }] : [];

  return (
    <View style={[styles.wrap, style]}>
      {message && (
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{message}</Text>
          <View style={styles.bubbleTail} />
        </View>
      )}
      <View>
        {mood === 'happy' && (
          <Animated.View
            style={[styles.sparks, { opacity: sparkFade, transform: [{ scale: sparkScale }] }]}
            pointerEvents="none"
          >
            <View style={[styles.spark, styles.sparkTop]} />
            <View style={[styles.spark, styles.sparkLeft]} />
            <View style={[styles.spark, styles.sparkRight]} />
          </Animated.View>
        )}
        <Animated.Image
          source={GIRL[mood]}
          style={[{ width: size, height: size }, { transform }]}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
    maxWidth: 190,
  },
  bubbleText: { color: colors.ink, fontSize: 12, fontWeight: '900', lineHeight: 17, textAlign: 'center' },
  // A little notch under the bubble, rotated so it points at the character.
  bubbleTail: {
    position: 'absolute',
    bottom: -5,
    alignSelf: 'center',
    width: 10,
    height: 10,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    transform: [{ rotate: '45deg' }],
  },
  sparks: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: colors.yellow },
  sparkTop: { top: '6%' },
  sparkLeft: { left: '4%', top: '32%', backgroundColor: colors.blue },
  sparkRight: { right: '4%', top: '26%', backgroundColor: colors.red },
});
