import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllProgress,
  saveWordProgress,
  getHeatmap,
  incrementHeatmapToday,
  resetAllProgress,
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

test('incrementHeatmapToday accumulates counts per date', async () => {
  await incrementHeatmapToday('2026-07-18');
  await incrementHeatmapToday('2026-07-18');
  const heat = await getHeatmap();
  expect(heat['2026-07-18']).toBe(2);
});

test('resetAllProgress clears both progress and heatmap', async () => {
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  await incrementHeatmapToday('2026-07-18');
  await resetAllProgress();
  expect(await getAllProgress()).toEqual({});
  expect(await getHeatmap()).toEqual({});
});
