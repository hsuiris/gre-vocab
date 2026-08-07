import { colorForCount } from '../src/components/Heatmap';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// Pinning the exact hex only broke on every palette change without catching
// anything. What matters is that an empty day reads as empty: barely darker
// than the card it sits on.
test('an empty day is the lightest step and nearly disappears', () => {
  const empty = luminance(colorForCount(0));
  expect(empty).toBeGreaterThan(luminance(colorForCount(1)));
  expect(empty).toBeGreaterThan(0.8); // white is 1.0
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
