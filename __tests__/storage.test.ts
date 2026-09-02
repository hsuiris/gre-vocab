import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllProgress,
  saveWordProgress,
  removeWordProgress,
  getHeatmap,
  incrementHeatmapToday,
  resetAllProgress,
  getExcludedWords,
  excludeWord,
  restoreWord,
  getWrongWords,
  addWrongWord,
  removeWrongWord,
  defaultSettings,
  getSettings,
  saveSettings,
} from '../src/lib/storage';


beforeEach(async () => {
  await AsyncStorage.clear();
});

test('getAllProgress returns empty object when nothing saved', async () => {
  expect(await getAllProgress()).toEqual({});
});

test('saveWordProgress persists and getAllProgress reads it back', async () => {
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  const all = await getAllProgress();
  expect(all.abate).toEqual({ box: 2, nextReviewDate: '2026-07-20' });
});

test('removeWordProgress deletes one saved progress entry', async () => {
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  await removeWordProgress('abate');
  expect(await getAllProgress()).toEqual({});
});

test('incrementHeatmapToday accumulates counts per date', async () => {
  await incrementHeatmapToday('2026-07-18');
  await incrementHeatmapToday('2026-07-18');
  const heat = await getHeatmap();
  expect(heat['2026-07-18']).toBe(2);
});

test('resetAllProgress clears progress, heatmap, and excluded words', async () => {
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  await incrementHeatmapToday('2026-07-18');
  await excludeWord('abate');
  await addWrongWord('abate');
  await resetAllProgress();
  expect(await getAllProgress()).toEqual({});
  expect(await getHeatmap()).toEqual({});
  expect(await getExcludedWords()).toEqual([]);
  expect(await getWrongWords()).toEqual([]);
});

test('getExcludedWords returns empty array when nothing saved', async () => {
  expect(await getExcludedWords()).toEqual([]);
});

test('excludeWord adds a word so getExcludedWords includes it', async () => {
  await excludeWord('abate');
  expect(await getExcludedWords()).toEqual(['abate']);
});

test('excludeWord is idempotent and does not create duplicate entries', async () => {
  await excludeWord('abate');
  await excludeWord('abate');
  expect(await getExcludedWords()).toEqual(['abate']);
});

test('restoreWord removes a previously excluded word', async () => {
  await excludeWord('abate');
  await excludeWord('cogent');
  await restoreWord('abate');
  const excluded = await getExcludedWords();
  expect(excluded).not.toContain('abate');
  expect(excluded).toContain('cogent');
});

test('wrong words can be added idempotently and removed', async () => {
  await addWrongWord('abate');
  await addWrongWord('abate');
  expect(await getWrongWords()).toEqual(['abate']);
  await removeWrongWord('abate');
  expect(await getWrongWords()).toEqual([]);
});


test('getSettings returns defaults when nothing saved', async () => {
  expect(await getSettings()).toEqual(defaultSettings);
});

test('saveSettings persists settings', async () => {
  // Spread over the defaults rather than spelled out in full: every new
  // setting would otherwise break this test without saying anything about
  // saving.
  const settings = {
    ...defaultSettings,
    displayName: 'Iris',
    accountEmail: 'iris@example.com',
    avatarUri: 'file:///avatar.jpg',
    personalGoal: '2 週背 300 個單字',
    goalUnit: 'week' as const,
    goalPeriod: 2,
    goalWordCount: 300,
    googleLinked: true,
    autoShowChoiceAnswers: false,
    autoSpeakAfterAnswer: false,
    confirmBeforeBin: false,
    playExample: false,
    playChinese: true,
    playRepeat: 3,
    reviewNotifications: true,
    streakNotifications: false,
  };
  await saveSettings(settings);
  expect(await getSettings()).toEqual(settings);
});
