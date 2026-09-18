jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// expo-audio has no native module under jest, and the generated recordings map
// would drag 3192 asset modules into every suite. Both are stubbed here so a
// screen test can call speakWord without either cost; speech.test.ts replaces
// them with versions it can inspect.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    playbackRate: 1,
    addListener: () => {},
    play: () => {},
    remove: () => {},
  }),
}));

jest.mock('./src/lib/recordings', () => ({ recordings: {} }));
