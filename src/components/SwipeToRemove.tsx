import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  onRemove: () => void;
  children: React.ReactNode;
};

const TRIGGER = 110; // how far left the card must travel to count as a swipe

// Built on PanResponder, which ships with React Native, rather than pulling in
// a gesture library for two screens.
export function SwipeToRemove({ label, onRemove, children }: Props) {
  const shift = useRef(new Animated.Value(0)).current;

  const responder = useRef(
    PanResponder.create({
      // Claim the gesture only once it is clearly leftward, so the list can
      // still be scrolled vertically through the card — and so a right-edge
      // swipe stays available for the browser's back gesture.
      onMoveShouldSetPanResponder: (_, { dx, dy }) => dx < -12 && Math.abs(dy) < Math.abs(dx),
      onPanResponderMove: (_, { dx }) => shift.setValue(Math.min(0, dx)),
      onPanResponderRelease: (_, { dx }) => {
        if (dx > -TRIGGER) {
          Animated.spring(shift, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
          return;
        }
        // Finish the card off the left edge, then hand over — removing it
        // mid-slide makes the row vanish under the finger.
        Animated.timing(shift, { toValue: -600, duration: 180, useNativeDriver: true }).start(onRemove);
      },
      onPanResponderTerminate: () => {
        Animated.spring(shift, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  // Only shows once the card has moved far enough to reveal it.
  const hintOpacity = shift.interpolate({
    inputRange: [-TRIGGER, -40, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  return (
    <View>
      <Animated.View style={[styles.hint, { opacity: hintOpacity }]} pointerEvents="none">
        <Text style={styles.hintText}>{label}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: shift }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.red,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'flex-end', // the card slides left, so the hint waits on the right
    paddingRight: 24,
  },
  hintText: { color: colors.redInk, fontWeight: '900', fontSize: 15 },
});
