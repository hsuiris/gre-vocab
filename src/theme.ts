// A macaron palette. Every hue comes as a pair: a pastel that fills a shape,
// and the ink that goes on top of it. Nothing is filled with a strong colour
// and lettered in white — at this lightness white text washes out, which is
// what made a saturated palette feel hard.
// __tests__/theme.test.ts pins every pairing at AA.
export const colors = {
  ink: '#5c4a51',
  muted: '#756068',
  line: '#f0e2e6',
  surface: '#ffffff',
  // Barely off-white, with just enough warmth to keep the pink accents at home.
  // White cards still read as raised because `line` and the shadow are pinker
  // than the page is.
  page: '#faf7f8',
  // Recessed areas inside a white card — option buttons, text fields, list
  // rows. These cannot use `page`: on a near-white page that would make them
  // invisible against the card they sit in.
  inset: '#f6eef1',
  // Pink for the hero and the question card, so they lift off the page.
  tint: '#fce6ec',

  pink: '#f9d4dd',
  pinkInk: '#993a54',

  blue: '#cbe0f5',
  blueInk: '#2c6489',

  yellow: '#fbe8b4',
  yellowInk: '#836012',

  // Kept for one job only — "you got it right".
  green: '#cfe9c8',
  greenInk: '#2f6535',

  red: '#f9d3cf',
  redInk: '#9d3d36',
};

// Duolingo's signature button: a flat slab with a darker lip along the bottom
// edge, so it reads as a physical key rather than a rectangle. On pastels the
// lip is a deepening of the same hue, not a hard outline.
export const slabEdge = {
  pink: '#e39fb2',
  blue: '#99bcdf',
  yellow: '#e7c46c',
  green: '#9bcc90',
  red: '#eba49b',
  line: '#e6d2d9',
};

export const slab = (edge: string) => ({ borderBottomWidth: 4, borderBottomColor: edge });

// Pair with slab(): pressing squashes the lip and drops the face onto it, which
// is what makes the button feel like a real key going down.
export const slabPressed = { transform: [{ translateY: 2 }], borderBottomWidth: 2 };

export const shadow = {
  shadowColor: '#d8aebd',
  shadowOpacity: 0.3,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

// ponytail: browsers are wide, phones aren't. One max-width clamp beats per-screen breakpoints.
export const centered = { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const };
