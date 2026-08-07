import { colors } from '../src/theme';

// A low-saturation palette is one bad hex away from unreadable, and nothing in
// a render test would catch it. These are the pairs the screens actually put
// together; every one must clear WCAG AA for normal text.
const AA = 4.5;

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const PAIRS: [keyof typeof colors, keyof typeof colors][] = [
  ['ink', 'page'],
  ['ink', 'surface'],
  ['ink', 'tint'],
  ['ink', 'yellow'], // solid yellow only ever carries ink, never white
  ['muted', 'surface'],
  ['muted', 'page'],
  ['surface', 'blue'],
  ['surface', 'red'],
  ['surface', 'green'],
  ['blue', 'surface'],
  ['blue', 'blueSoft'],
  ['red', 'redSoft'],
  ['red', 'surface'],
  ['green', 'greenSoft'],
  ['yellowInk', 'surface'],
  ['yellowInk', 'yellowSoft'],
  ['yellowInk', 'tint'],
];

describe('palette contrast', () => {
  it.each(PAIRS)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA);
  });

  it('never puts white on yellow — that pair is the classic failure', () => {
    expect(contrast(colors.surface, colors.yellow)).toBeLessThan(AA);
  });
});
