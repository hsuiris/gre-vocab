import { initialProgress, reviewWord, isDue, addDays } from '../src/lib/leitner';

test('initialProgress starts at box 1, due today', () => {
  const p = initialProgress('2026-07-18');
  expect(p).toEqual({ box: 1, nextReviewDate: '2026-07-18' });
});

test('reviewWord: knowing it advances one box and extends interval', () => {
  const p = reviewWord({ box: 1, nextReviewDate: '2026-07-18' }, true, '2026-07-18');
  expect(p.box).toBe(2);
  expect(p.nextReviewDate).toBe('2026-07-20'); // box 2 = 2 天
});

test('reviewWord: box caps at 5', () => {
  const p = reviewWord({ box: 5, nextReviewDate: '2026-07-18' }, true, '2026-07-18');
  expect(p.box).toBe(5);
  expect(p.nextReviewDate).toBe('2026-08-01'); // box 5 = 14 天
});

test('reviewWord: not knowing it resets to box 1', () => {
  const p = reviewWord({ box: 4, nextReviewDate: '2026-07-18' }, false, '2026-07-18');
  expect(p.box).toBe(1);
  expect(p.nextReviewDate).toBe('2026-07-19'); // box 1 = 1 天
});

test('isDue: true when nextReviewDate is today or earlier', () => {
  expect(isDue({ box: 1, nextReviewDate: '2026-07-18' }, '2026-07-18')).toBe(true);
  expect(isDue({ box: 1, nextReviewDate: '2026-07-17' }, '2026-07-18')).toBe(true);
});

test('isDue: false when nextReviewDate is in the future', () => {
  expect(isDue({ box: 1, nextReviewDate: '2026-07-19' }, '2026-07-18')).toBe(false);
});

test('addDays handles month rollover', () => {
  expect(addDays('2026-07-31', 2)).toBe('2026-08-02');
});
