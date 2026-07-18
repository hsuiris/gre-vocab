export type WordProgress = {
  box: number; // 1-5
  nextReviewDate: string; // YYYY-MM-DD
};

export const INTERVAL_DAYS = [1, 2, 4, 7, 14];

export function initialProgress(today: string): WordProgress {
  return { box: 1, nextReviewDate: today };
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function reviewWord(
  progress: WordProgress,
  knewIt: boolean,
  today: string
): WordProgress {
  const box = knewIt ? Math.min(progress.box + 1, 5) : 1;
  return { box, nextReviewDate: addDays(today, INTERVAL_DAYS[box - 1]) };
}

export function isDue(progress: WordProgress, today: string): boolean {
  return progress.nextReviewDate <= today;
}
