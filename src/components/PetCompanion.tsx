import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

type Props = {
  message: string;
};

export function PetCompanion({ message }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText}>{message}</Text>
      </View>
      <Image source={require('../../assets/pet-companion.png')} style={styles.pet} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: -8, top: 46, alignItems: 'center' },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 4,
  },
  bubbleText: { color: colors.ink, fontSize: 12, fontWeight: '900', lineHeight: 17, textAlign: 'center' },
  pet: { width: 128, height: 128 },
});
