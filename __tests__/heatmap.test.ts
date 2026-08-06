import { colorForCount } from '../src/components/Heatmap';

test('zero count is the empty color', () => {
  expect(colorForCount(0)).toBe('#d9e9ec');
});

test('higher counts map to darker greens', () => {
  const colors = [colorForCount(1), colorForCount(10), colorForCount(20), colorForCount(50)];
  expect(new Set(colors).size).toBe(4); // 四種不同深淺
});
