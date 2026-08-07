// Clean white base, cool neutrals, three low-saturation accents. Nothing here
// fills an area with yellow — yellow appears only as text, a border or a small
// mark, because a yellow surface is the one thing this palette must not do.
// Every hue is deep enough to take white text at 4.5:1; __tests__/theme.test.ts
// pins that.
export const colors = {
  ink: '#33404a',
  muted: '#5d6b74',
  line: '#e2e9ec',
  surface: '#ffffff',
  page: '#f5f8f9',
  // The one tinted surface: a soft sky blue, for the hero and the question card.
  tint: '#e8f2f8',

  blue: '#28679a',
  blueSoft: '#e3f0f8',

  red: '#b04a44',
  redSoft: '#fceeed',

  // Accent only — an outline or a glyph, never a fill behind content.
  yellow: '#e0ab3c',
  yellowInk: '#8a6414',

  // Kept for one job only — "you got it right". Everything decorative that used
  // to be green is now blue.
  green: '#35754a',
  greenSoft: '#ecf6ef',
};

// Duolingo's signature button: a flat slab with a darker lip along the bottom
// edge, so it reads as a physical key rather than a rectangle.
export const slabEdge = {
  blue: '#1c4a70',
  red: '#853632',
  green: '#255338',
  line: '#cfd9de',
};

export const slab = (edge: string) => ({ borderBottomWidth: 4, borderBottomColor: edge });

// Pair with slab(): pressing squashes the lip and drops the face onto it, which
// is what makes the button feel like a real key going down.
export const slabPressed = { transform: [{ translateY: 2 }], borderBottomWidth: 2 };

export const shadow = {
  shadowColor: '#8fa4ae',
  shadowOpacity: 0.18,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

// ponytail: browsers are wide, phones aren't. One max-width clamp beats per-screen breakpoints.
export const centered = { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const };
