import AsyncStorage from '@react-native-async-storage/async-storage';
import { WordProgress } from './leitner';
import type { PracticeOrder } from './practiceQueue';

const PROGRESS_KEY = 'gre-vocab:progress';
const HEATMAP_KEY = 'gre-vocab:heatmap';
const EXCLUDED_KEY = 'gre-vocab:excluded';
const SETTINGS_KEY = 'gre-vocab:settings';
const WRONG_KEY = 'gre-vocab:wrong';
const NOTES_KEY = 'gre-vocab:notes';
const LAST_QUIZ_KEY = 'gre-vocab:lastQuiz';

type ProgressMap = Record<string, WordProgress>;

// What the home screen needs to put you straight back into the quiz you did
// last. The label rides along so the card can name it without the screen
// re-deriving "英文選中文意思" from direction + mode.
// The range and order picked on the setup screen ride along too, so "接著上次"
// can replay the exact same session without stopping at that screen again.
// Both are optional: a quiz saved before this existed simply means "everything,
// A-Z".
export type LastQuiz = {
  direction: 'en-zh' | 'zh-en';
  mode: 'choice' | 'cloze' | 'typing';
  wrongOnly?: boolean;
  label: string;
  order?: PracticeOrder;
  letters?: string[];
  limit?: number;
};
type HeatmapMap = Record<string, number>;

// One note per practice session, not per word: a session is what the user
// actually sits down and finishes, so that's the unit worth filing.
export type StudyNote = {
  id: string;
  date: string;
  mode: string;
  total: number;
  wrongCount: number;
  text: string;
};
export type AppSettings = {
  displayName: string;
  accountEmail: string;
  avatarUri: string | null;
  personalGoal: string;
  goalUnit: 'day' | 'week';
  goalPeriod: number;
  goalWordCount: number;
  googleLinked: boolean;
  autoShowChoiceAnswers: boolean;
  autoSpeakAfterAnswer: boolean;
  // Off means a cross bins the word straight away; the confirm sheet is where
  // it gets turned off.
  confirmBeforeBin: boolean;
  // How the word-list player reads: which parts it says, and how it walks the
  // list. The loop's range is not here — it counts positions in whatever the
  // search and the letter rail have left on screen, so it dies with the screen.
  playExample: boolean;
  playChinese: boolean;
  playRepeat: number;
  playLoop: boolean;
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
  autoShowChoiceAnswers: true,
  autoSpeakAfterAnswer: true,
  confirmBeforeBin: true,
  playExample: true,
  playChinese: false,
  playRepeat: 1,
  playLoop: false,
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

export async function getNotes(): Promise<StudyNote[]> {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveNote(note: StudyNote): Promise<void> {
  const notes = await getNotes();
  const at = notes.findIndex((n) => n.id === note.id);
  if (at >= 0) notes[at] = note;
  else notes.unshift(note); // newest first, so the list needs no sorting
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export async function deleteNote(id: string): Promise<void> {
  const notes = await getNotes();
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes.filter((n) => n.id !== id)));
}

export async function getLastQuiz(): Promise<LastQuiz | null> {
  const raw = await AsyncStorage.getItem(LAST_QUIZ_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveLastQuiz(quiz: LastQuiz): Promise<void> {
  await AsyncStorage.setItem(LAST_QUIZ_KEY, JSON.stringify(quiz));
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
