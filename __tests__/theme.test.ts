import { colors, slabEdge } from '../src/theme';

// A pastel palette is one bad hex away from unreadable, and nothing in a render
// test would catch it. These are the pairs the screens actually put together;
// every one must clear WCAG AA for normal text.
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

type Token = keyof typeof colors;

// Body text and headings, wherever they land.
const NEUTRAL: [Token, Token][] = [
  ['ink', 'page'],
  ['ink', 'surface'],
  ['ink', 'tint'],
  ['muted', 'page'],
  ['muted', 'surface'],
  ['muted', 'tint'],
];

// Each pastel carries its own ink; nothing here is lettered in white, because
// at this lightness white text washes out.
const HUES = ['pink', 'blue', 'yellow', 'green', 'red'] as const;

describe('palette contrast', () => {
  it.each(NEUTRAL)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA);
  });

  it.each(HUES)('%sInk is readable on its own pastel, on white and on the page', (hue) => {
    const ink = colors[`${hue}Ink` as Token];
    expect(contrast(ink, colors[hue])).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink, colors.surface)).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink, colors.page)).toBeGreaterThanOrEqual(AA);
  });

  it.each(HUES)('body ink still reads on a %s fill', (hue) => {
    expect(contrast(colors.ink, colors[hue])).toBeGreaterThanOrEqual(AA);
  });

  // The lip is what makes a button look pressable. Too close to its own fill
  // and the slab flattens into a plain rectangle.
  it.each(HUES)('the %s slab lip is distinguishable from its fill', (hue) => {
    expect(contrast(colors[hue], slabEdge[hue])).toBeGreaterThanOrEqual(1.2);
  });

  // White text is the failure mode this palette is built to avoid. If a future
  // edit letters a pastel button in white, this is the reminder why not.
  it.each(HUES)('white text on a %s fill would fail, which is why none exists', (hue) => {
    expect(contrast(colors.surface, colors[hue])).toBeLessThan(AA);
  });

  // greenSoft is gone; the switch track is the pastel itself. It holds no text,
  // so the bar is the one for a control's own shape.
  it('the green switch thumb stays visible on its track', () => {
    expect(contrast(colors.greenInk, colors.green)).toBeGreaterThanOrEqual(AA_UI);
  });
});
