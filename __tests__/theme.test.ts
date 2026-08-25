import { themeList, type Palette, type SlabEdge, type Theme } from '../src/theme';

// A pastel palette is one bad hex away from unreadable, and nothing in a render
// test would catch it. These are the pairs the screens actually put together;
// every one must clear WCAG AA for normal text — in EVERY theme, so a second
// look cannot ship worse than the first.
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

// Body text and headings, wherever they land.
const NEUTRAL: [keyof Palette, keyof Palette][] = [
  ['ink', 'page'],
  ['ink', 'surface'],
  ['ink', 'tint'],
  ['ink', 'inset'],
  ['muted', 'page'],
  ['muted', 'surface'],
  ['muted', 'tint'],
  ['muted', 'inset'],
];

// Each pastel carries its own ink; nothing here is lettered in white, because
// at these lightnesses white text washes out.
const HUES = ['blue', 'yellow', 'green', 'red'] as const;

describe.each(themeList.map((t) => [t.name, t] as [string, Theme]))('%s palette', (_name, theme) => {
  const colors = theme.colors;
  const slabEdge = theme.slabEdge;

  it.each(NEUTRAL)('%s on %s clears AA', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA);
  });

  it.each(HUES)('%sInk is readable on its own pastel, on white and on the page', (hue) => {
    const ink = colors[`${hue}Ink` as keyof Palette];
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
    expect(contrast(colors[hue], slabEdge[hue as keyof SlabEdge])).toBeGreaterThanOrEqual(1.2);
  });

  // White text is the failure mode this palette is built to avoid. If a future
  // edit letters a pastel button in white, this is the reminder why not.
  it.each(HUES)('white text on a %s fill would fail, which is why none exists', (hue) => {
    expect(contrast(colors.surface, colors[hue])).toBeLessThan(AA);
  });

  it('the green switch thumb stays visible on its track', () => {
    expect(contrast(colors.greenInk, colors.green)).toBeGreaterThanOrEqual(AA_UI);
  });

  // The page is light, so these three barely differ and it would be easy to
  // collapse them by accident. Each still has to be its own step: a recessed
  // field must show against the card it sits in, and a card against the page.
  it('page, card and recessed field stay three distinct surfaces', () => {
    const step = 1.05;
    expect(contrast(colors.inset, colors.surface)).toBeGreaterThanOrEqual(step);
    expect(contrast(colors.line, colors.page)).toBeGreaterThanOrEqual(step);
    expect(colors.page).not.toBe(colors.surface);
    expect(colors.page).not.toBe(colors.inset);
  });
});
