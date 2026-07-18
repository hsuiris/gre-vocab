import * as Speech from 'expo-speech';

export function speakWord(word: string): void {
  Speech.speak(word, { language: 'en-US' });
}
