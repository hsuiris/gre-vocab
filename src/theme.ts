// One look, read through useStyles() by every screen: neutral greys carrying
// the interface, colour only where it means something, glass panes over a soft
// wash. There was a second, louder palette here once; it is gone, and the
// token shape it shared is kept because the screens are written against it.
//
// Every hue comes as a pair: a fill and the ink that goes on top of it. Nothing
// is a saturated block lettered in white — at these lightnesses white text
// washes out. __tests__/theme.test.ts pins every pairing, so a new palette
// cannot ship unreadable.

export type ThemeName = 'calm';

export type Palette = {
  ink: string;
  muted: string;
  line: string;
  surface: string;
  page: string;
  inset: string;
  tint: string;
  blue: string;
  blueInk: string;
  yellow: string;
  yellowInk: string;
  green: string;
  greenInk: string;
  red: string;
  redInk: string;
};

export type SlabEdge = { blue: string; yellow: string; green: string; red: string; line: string };
export type Glass = { fill: string; pane: string; solid: string; fillThin: string; edge: string };
type Shadow = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
};

export type Theme = {
  name: ThemeName;
  label: string;
  blurb: string;
  colors: Palette;
  slabEdge: SlabEdge;
  glass: Glass;
  shadow: Shadow;
  softShadow: Shadow;
  glassShadow: Shadow;
  slab: (edge: string) => { borderBottomWidth: number; borderBottomColor: string };
  slabPressed: { transform: { translateY: number }[]; borderBottomWidth: number };
  pane: (radius: number) => {
    borderRadius: number;
    overflow: 'hidden';
    borderWidth: number;
    borderColor: string;
    backgroundColor: 'transparent';
  };
  // The heatmap's five steps, lightest (an empty day) to darkest. Each must be
  // darker than the one before it or the grid stops reading as a scale;
  // __tests__/heatmap.test.ts pins that for every theme.
  heat: [string, string, string, string, string];
  // The lights painted behind every screen, and how strong each one burns at
  // its centre. Two entries is the designed number: Backdrop turns each into a
  // soft radial glow, and two glows across a diagonal read as lit air where
  // three discs read as confetti.
  backdrop: string[];
  blobOpacity: number;
  // How much real blur a GlassFill lays down.
  blurScale: number;
};

// ponytail: browsers are wide, phones aren't. One max-width clamp beats
// per-screen breakpoints. Layout, not colour, so it is the same in both themes.
export const centered = { width: '100%' as const, maxWidth: 720, alignSelf: 'center' as const };

const calmGlass: Glass = {
  // Painted over a blur, so these are thinner than they look: the BlurView
  // underneath already lays down a wash of its own.
  fill: 'rgba(255,255,255,0.40)',
  pane: 'rgba(255,255,255,0.55)',
  // No blur underneath. List rows get this: one BlurView per row is a real cost
  // on a long list, and text still has to hold its contrast.
  solid: 'rgba(255,255,255,0.78)',
  fillThin: 'rgba(255,255,255,0.22)',
  edge: 'rgba(255,255,255,0.75)',
};

export const calm: Theme = {
  name: 'calm',
  label: '柔和玻璃',
  blurb: '奶油白底、霧面玻璃、低飽和粉彩。看久了不累。',
  colors: {
    ink: '#2f3538',
    muted: '#656a6b',
    line: '#eae4dd',
    surface: '#ffffff',
    page: '#faf7f3',
    // Recessed areas inside a card — option buttons, text fields, list rows.
    // These cannot use `page`: on a near-white page that would make them
    // invisible against the card they sit in.
    inset: '#f2efea',
    tint: '#eaf1f5',
    blue: '#d6e6f3',
    blueInk: '#2c6489',
    yellow: '#f7e7c2',
    yellowInk: '#836012',
    green: '#d6e9d2',
    greenInk: '#2f6535',
    red: '#f5dbd8',
    redInk: '#9d3d36',
  },
  slabEdge: { blue: '#a9c7de', yellow: '#e4cc93', green: '#a8cea0', red: '#e6b5ae', line: '#dbe0e2' },
  glass: calmGlass,
  shadow: {
    shadowColor: '#9a8d80',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  softShadow: {
    shadowColor: '#9a8d80',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  // Glass has no drop shadow in iOS — it has a soft, wide halo that separates
  // the pane from whatever colour is behind it.
  glassShadow: {
    shadowColor: '#8a7f74',
    shadowOpacity: 0.11,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  slab: (edge) => ({ borderBottomWidth: 3, borderBottomColor: edge }),
  slabPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  pane: (radius) => ({
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: calmGlass.edge,
    backgroundColor: 'transparent',
  }),
  heat: ['#eef1f2', '#d6e6f3', '#a8c9e2', '#7aa9cd', '#4a7fa8'],
  backdrop: ['#cfe2f1', '#fbe4d3'],
  blobOpacity: 0.45,
  blurScale: 1,
};

export const themes: Record<ThemeName, Theme> = { calm };
export const themeList: Theme[] = [calm];
