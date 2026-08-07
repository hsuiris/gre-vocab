import { colors } from '../src/theme';

// A low-saturation palette is one bad hex away from unreadable, and nothing in
// a render test would catch it. These are the pairs the screens actually put
// together; every one must clear WCAG AA for normal text.
const AA = 4.5; // WCAG AA for normal text
const AA_UI = 3.0; // WCAG AA for a control's own shape, which carries no text

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
  ['muted', 'surface'],
  ['muted', 'page'],
  ['muted', 'tint'],
  ['surface', 'blue'],
  ['surface', 'red'],
  ['surface', 'green'],
  ['blue', 'surface'],
  ['blue', 'blueSoft'],
  ['blue', 'tint'],
  ['red', 'redSoft'],
  ['red', 'surface'],
  ['yellowInk', 'surface'],
  ['yellowInk', 'page'],
  ['surface', 'yellowInk'], // the only yellow that may sit behind text
];

describe('palette contrast', () => {
  it.each(PAIRS)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA);
  });

  // greenSoft is only ever a switch track, so it holds no text — the bar is
  // the one for a control's own shape. Putting green text on it would need a
  // greenSoft indistinguishable from white, since green sits right at the AA
  // line against white already.
  it('the green switch thumb stays visible on its track', () => {
    expect(contrast(colors.green, colors.greenSoft)).toBeGreaterThanOrEqual(AA_UI);
  });

  // Bright yellow is unreadable under white text and too close to the page
  // under dark text, which is why nothing fills a surface with it. If a future
  // edit reaches for `colors.yellow` as a background, this is the reminder.
  it('bright yellow is unusable as a surface, in either direction', () => {
    expect(contrast(colors.surface, colors.yellow)).toBeLessThan(AA);
  });
});
