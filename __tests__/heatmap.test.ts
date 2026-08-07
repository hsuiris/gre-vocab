import { colorForCount } from '../src/components/Heatmap';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

test('zero count is the empty color', () => {
  expect(colorForCount(0)).toBe('#f7e9ed');
});

// The old version of this test only counted distinct colours, and so it kept
// passing when a palette change made one step LIGHTER than the step below it.
// A heatmap whose ramp does not descend is not a heatmap.
test('every step of the ramp is darker than the one before', () => {
  const steps = [0, 1, 10, 20, 50].map(colorForCount);
  expect(new Set(steps).size).toBe(5); // 五種不同深淺
  const levels = steps.map(luminance);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i]).toBeLessThan(levels[i - 1]);
  }
});
