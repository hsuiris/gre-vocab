// A muted dopamine palette: red, blue and yellow carry the interface, sitting
// on warm cream rather than cold white. Every hue is pulled down in saturation
// and deep enough to take white text at 4.5:1, so nothing here is decoration
// that a label then has to fight.
export const colors = {
  ink: '#453e37',
  muted: '#75695c',
  line: '#e9e0d4',
  surface: '#ffffff',
  page: '#faf5ee',
  tint: '#fdf1dc',

  blue: '#41649f',
  blueSoft: '#e6ecf8',

  red: '#af4a43',
  redSoft: '#fdf1ef',

  yellow: '#e0ab3c',
  yellowSoft: '#fbf1d8',
  // Solid yellow is too light to read white text on, so yellow *text* needs its
  // own darker value.
  yellowInk: '#8a6414',

  // Kept for one job only — "you got it right". Everything decorative that used
  // to be green is now blue or yellow.
  green: '#3c7852',
  greenSoft: '#eff7f1',
};

// Duolingo's signature button: a flat slab with a darker lip along the bottom
// edge, so it reads as a physical key rather than a rectangle.
export const slabEdge = {
  blue: '#2f4c7c',
  red: '#8b3a34',
  yellow: '#b7862c',
  green: '#2d5c3e',
  line: '#ddd2c2',
};

export const slab = (edge: string) => ({ borderBottomWidth: 4, borderBottomColor: edge });

export const shadow = {
  shadowColor: '#c4b49c',
  shadowOpacity: 0.22,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

// ponytail: browsers are wide, phones aren't. One max-width clamp beats per-screen breakpoints.
export const centered = { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const };
