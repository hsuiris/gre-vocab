// A macaron palette on a pink page. Every hue comes as a pair: a pastel that
// fills a shape, and the ink that goes on top of it. Nothing is filled with a
// strong colour and lettered in white — at this lightness white text washes out,
// so the pastel carries its own deep tone instead.
// __tests__/theme.test.ts pins all 27 pairings at AA.
export const colors = {
  ink: '#5c4a51',
  muted: '#756068',
  line: '#f2e2e7',
  surface: '#ffffff',
  page: '#fdf3f6',
  // A deeper pink for the hero and the question card, so they lift off the page.
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
