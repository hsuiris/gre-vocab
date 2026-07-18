import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordProgress } from './leitner';

const PROGRESS_KEY = 'gre-vocab:progress';
const HEATMAP_KEY = 'gre-vocab:heatmap';
const EXCLUDED_KEY = 'gre-vocab:excluded';

type ProgressMap = Record<string, WordProgress>;
type HeatmapMap = Record<string, number>;

export async function getAllProgress(): Promise<ProgressMap> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveWordProgress(word: string, progress: WordProgress): Promise<void> {
  const all = await getAllProgress();
  all[word] = progress;
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export async function getHeatmap(): Promise<HeatmapMap> {
  const raw = await AsyncStorage.getItem(HEATMAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function incrementHeatmapToday(today: string): Promise<void> {
  const map = await getHeatmap();
  map[today] = (map[today] ?? 0) + 1;
  await AsyncStorage.setItem(HEATMAP_KEY, JSON.stringify(map));
}

export async function getExcludedWords(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(EXCLUDED_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function excludeWord(word: string): Promise<void> {
  const excluded = await getExcludedWords();
  if (!excluded.includes(word)) {
    excluded.push(word);
    await AsyncStorage.setItem(EXCLUDED_KEY, JSON.stringify(excluded));
  }
}

export async function restoreWord(word: string): Promise<void> {
  const excluded = await getExcludedWords();
  const filtered = excluded.filter((w) => w !== word);
  await AsyncStorage.setItem(EXCLUDED_KEY, JSON.stringify(filtered));
}

export async function resetAllProgress(): Promise<void> {
  // "reset all progress" means a fresh start end-to-end, so excluded words
  // (a rotation preference, not Leitner state) are cleared too.
  await AsyncStorage.multiRemove([PROGRESS_KEY, HEATMAP_KEY, EXCLUDED_KEY]);
}
