// Neutral greys carry the interface; colour appears only where it means
// something — right, wrong, unsure, primary action. Nothing is tinted for
// decoration, which is what keeps a screen full of words calm.
//
// Every hue comes as a pair: a pastel that fills a shape, and the ink that goes
// on top of it. Nothing is a saturated block lettered in white — at this
// lightness white text washes out. __tests__/theme.test.ts pins every pairing.
export const colors = {
  ink: '#2f3538',
  muted: '#666e72',
  line: '#e7eaeb',
  surface: '#ffffff',
  page: '#f7f8f9',
  // Recessed areas inside a white card — option buttons, text fields, list
  // rows. These cannot use `page`: on a near-white page that would make them
  // invisible against the card they sit in.
  inset: '#f0f3f4',
  // The one tinted surface, for the hero and the question card.
  tint: '#eaf1f5',

  blue: '#d6e6f3',
  blueInk: '#2c6489',

  yellow: '#f7e7c2',
  yellowInk: '#836012',

  // Kept for one job only — "you got it right".
  green: '#d6e9d2',
  greenInk: '#2f6535',

  red: '#f5dbd8',
  redInk: '#9d3d36',
};

// A slab is a flat fill with a slightly deeper lip along its bottom edge, so a
// button reads as pressable without needing a shadow or an outline.
export const slabEdge = {
  blue: '#a9c7de',
  yellow: '#e4cc93',
  green: '#a8cea0',
  red: '#e6b5ae',
  line: '#dbe0e2',
};

export const slab = (edge: string) => ({ borderBottomWidth: 4, borderBottomColor: edge });

// Pair with slab(): pressing squashes the lip and drops the face onto it, which
// is what makes the button feel like a real key going down.
export const slabPressed = { transform: [{ translateY: 2 }], borderBottomWidth: 2 };

export const shadow = {
  shadowColor: '#8b969c',
  shadowOpacity: 0.13,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

// ponytail: browsers are wide, phones aren't. One max-width clamp beats per-screen breakpoints.
export const centered = { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const };
