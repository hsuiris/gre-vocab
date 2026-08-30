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
  getNotes,
  saveNote,
  deleteNote,
} from '../src/lib/storage';

const note = (id: string, text: string) => ({
  id,
  date: id.slice(0, 10),
  mode: '英選中',
  total: 40,
  wrongCount: 6,
  text,
});

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

test('getNotes returns empty array when nothing saved', async () => {
  expect(await getNotes()).toEqual([]);
});

test('saveNote puts the newest note first', async () => {
  await saveNote(note('2026-08-06-1', '舊的'));
  await saveNote(note('2026-08-07-1', '新的'));
  expect((await getNotes()).map((n) => n.text)).toEqual(['新的', '舊的']);
});

test('saveNote with an existing id edits in place instead of duplicating', async () => {
  await saveNote(note('2026-08-07-1', '第一版'));
  await saveNote(note('2026-08-07-1', '改過的'));
  const notes = await getNotes();
  expect(notes).toHaveLength(1);
  expect(notes[0].text).toBe('改過的');
});

test('deleteNote removes only the named note', async () => {
  await saveNote(note('2026-08-06-1', '留下'));
  await saveNote(note('2026-08-07-1', '刪掉'));
  await deleteNote('2026-08-07-1');
  expect((await getNotes()).map((n) => n.text)).toEqual(['留下']);
});

test('resetAllProgress spares notes — they are written by the user, not progress', async () => {
  await saveNote(note('2026-08-07-1', '手寫的筆記'));
  await saveWordProgress('abate', { box: 2, nextReviewDate: '2026-07-20' });
  await resetAllProgress();
  expect(await getAllProgress()).toEqual({});
  expect(await getNotes()).toHaveLength(1);
});

test('getSettings returns defaults when nothing saved', async () => {
  expect(await getSettings()).toEqual(defaultSettings);
});

test('saveSettings persists settings', async () => {
  const settings = {
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
