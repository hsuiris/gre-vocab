import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordProgress } from './leitner';

const PROGRESS_KEY = 'gre-vocab:progress';
const HEATMAP_KEY = 'gre-vocab:heatmap';
const EXCLUDED_KEY = 'gre-vocab:excluded';
const SETTINGS_KEY = 'gre-vocab:settings';
const WRONG_KEY = 'gre-vocab:wrong';

type ProgressMap = Record<string, WordProgress>;
type HeatmapMap = Record<string, number>;
export type AppSettings = {
  displayName: string;
  accountEmail: string;
  avatarUri: string | null;
  personalGoal: string;
  goalUnit: 'day' | 'week';
  goalPeriod: number;
  goalWordCount: number;
  googleLinked: boolean;
  autoShowDetails: boolean;
  autoShowChoiceAnswers: boolean;
  reviewNotifications: boolean;
  streakNotifications: boolean;
};

export const defaultSettings: AppSettings = {
  displayName: '本機學習者',
  accountEmail: '',
  avatarUri: null,
  personalGoal: '1 天背 20 個單字',
  goalUnit: 'day',
  goalPeriod: 1,
  goalWordCount: 20,
  googleLinked: false,
  autoShowDetails: false,
  autoShowChoiceAnswers: true,
  reviewNotifications: false,
  streakNotifications: false,
};

export async function getAllProgress(): Promise<ProgressMap> {
  const raw = await AsyncStorage.getItem(PROGRESS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function saveWordProgress(word: string, progress: WordProgress): Promise<void> {
  const all = await getAllProgress();
  all[word] = progress;
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
}

export async function removeWordProgress(word: string): Promise<void> {
  const all = await getAllProgress();
  delete all[word];
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

export async function getWrongWords(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(WRONG_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addWrongWord(word: string): Promise<void> {
  const wrong = await getWrongWords();
  if (!wrong.includes(word)) {
    wrong.push(word);
    await AsyncStorage.setItem(WRONG_KEY, JSON.stringify(wrong));
  }
}

export async function removeWrongWord(word: string): Promise<void> {
  const wrong = await getWrongWords();
  await AsyncStorage.setItem(WRONG_KEY, JSON.stringify(wrong.filter((w) => w !== word)));
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  const saved = raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  return { ...saved, personalGoal: formatGoal(saved.goalUnit, saved.goalPeriod, saved.goalWordCount) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const next = { ...settings, personalGoal: formatGoal(settings.goalUnit, settings.goalPeriod, settings.goalWordCount) };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

export function formatGoal(unit: AppSettings['goalUnit'], period: number, wordCount: number): string {
  return `${period} ${unit === 'week' ? '週' : '天'}背 ${wordCount} 個單字`;
}

export async function resetAllProgress(): Promise<void> {
  // "reset all progress" means a fresh start end-to-end, so excluded words
  // (a rotation preference, not Leitner state) are cleared too.
  await AsyncStorage.multiRemove([PROGRESS_KEY, HEATMAP_KEY, EXCLUDED_KEY, WRONG_KEY]);
}
