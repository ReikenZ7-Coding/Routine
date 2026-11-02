// Visual identity. Four looks, each its own world:
// - Lavender: lit white-violet frost over a luminous lilac world, pink bloom, white type.
// - Stone: matte smoked glass in quiet window light, thin editorial type, champagne for what matters.
// - Paper: milk glass on morning mist, ink type, colour only where it carries meaning.
// - Pine: smoked green glass under a night canopy, mint edge light, sporty bold type.
// The four looks are skins of one app: every screen has one layout, and a look differs only in its colours, its
// glass material (`colors.material`), its backdrop and header art, its typeface and weights, and the small radius
// and rim details carried here.
// Screens read the active look with useTheme() / useStyles(makeStyles).
import type { BlurTint } from 'expo-blur';
import { createContext, useContext, useMemo } from 'react';
import type { TextStyle } from 'react-native';

export type ThemeName = 'lavender' | 'stone' | 'paper' | 'pine';

/** The look's glass: one layer stack for every surface, tuned per look. Colours are CSS colour strings,
 *  shadows are CSS box-shadow lists, gradient positions are CSS radial-gradient arguments. */
export interface GlassMaterial {
  /** Live blur, used only by chrome that floats over scrolling content (tab bar, mini player). */
  live: { tint: BlurTint; intensity: number; reduction: number; webBlur: number; webSaturate: number };
  /** A tint laid over chrome's live blur (tab bar, mini player), for its labels. */
  chromeTint: string;
  /** Saturation baked into the look's pre-blurred lens image (informational; set in assets/art/looks.json). */
  lensSaturation: number;
  /** Solid legibility tint laid straight over the lens. */
  base: string;
  /** The body: a linear gradient over the base. */
  body: [string, string];
  bodyAngle: number;
  /** Edge light picked up from the world, as two radial gradients. */
  caustic: string;
  causticAt: string;
  causticSize: string;
  caustic2: string;
  caustic2At: string;
  caustic2Size: string;
  /** A fixed-height highlight band along the inside top edge. */
  topGlow: string;
  topGlowPx: number;
  /** Per-side rim colours of the 1px shell border. */
  rimTop: string;
  rimLeft: string;
  rimRight: string;
  rimBottom: string;
  /** Inner 1px lines just inside the rim, and an optional inner glow (inset box-shadows). */
  innerTop: string;
  innerBottom: string;
  innerGlow?: string;
  /** Stone: a specular hairline across the top edge (a CSS linear-gradient). */
  hairline?: string;
  /** Stone: opacity of the tiled satin grain (assets/art/glass-grain.png). */
  grain?: number;
  /** Peak colour of the diagonal sheen band that follows scroll. */
  sheen: string;
  shadowFloat: string;
  shadowPane: string;
  shadowHero: string;
  /** Press light: the body lift and the brightened rim while touched (and while focused). */
  pressFill: string;
  pressRim: string;
  /** Header buttons, search pills and segmented troughs: a brighter frost. */
  control: { body: [string, string]; shadow: string };
  /** Anything nested in glass: no lens, no shadow. */
  inset: { fill: string; border: string; borderTop: string };
  /** Done and skipped rows sink back into the world. */
  receded: { body: [string, string]; shadow: string };
  /** Bottom sheets: thick glass, with an optional top light band [colour, height in px]. */
  sheet: { body: [string, string]; rimTop: string; band?: [string, number]; grip: string };
  /** The tab bar's drop (the glass under the current tab): its fill top to bottom, its top rim and side rims,
   *  an optional offset shadow, and the ink of the current tab's icon and label. */
  drop: { fill: [string, string]; rim: string; rimSide: string; shadow?: string; ink: string };
  /** The moving light: one clock period, the layers it moves (named in assets/art/looks.json), and how
   *  strongly glass catches it as it passes behind. */
  light: { period: number; layers: string[]; catch: number };
  /** Lavender and Pine hero cards: a radial light inside the glass. */
  bloom?: string;
  /** Sheets: an extra radial light in the body (Pine's moon orb in the top right corner). */
  sheetOrb?: string;
  /** Pine: the lit teal slab drawn behind each screen's header as header art (the header is the same as every
   *  look's, in the same place). Its gradient top to bottom, the 1px rim along its rounded foot, its offset shadow,
   *  the opacity of its art, the moon glow behind its top-right buttons, and the trough that glass laid on the slab
   *  becomes (darker than the slab, lit along its lower lip). */
  canopy?: {
    gradient: [string, string, string];
    rim: string;
    shadow: string;
    art: number;
    /** The art is drawn at the slab's height, up to this many dp. */
    maxArt: number;
    moon: string;
    /** The count badge on the slab: a dark pill (litRim edge, accent count). */
    badge: string;
    inset: { fill: string; border: string; borderTop: string };
  };
  /** Pine: filter chips are a dark fill with a mint edge (colour only; the chip and its place are shared). */
  outlineChips?: boolean;
  /** Pine: the sheen that crosses glass as it scrolls rises from the lower edge (the light is below, on the night
   *  floor) instead of falling from the top. Light only. */
  sheenFromBelow?: boolean;
  /** Pine: a selected row inside glass (the playing sound or song) is outlined in this lit rim. */
  selectRim?: string;
}

export interface Palette {
  /** Background gradient, top to bottom (painted under the backdrop image). */
  gradient: [string, string, string];
  bg: string;
  text: string;
  muted: string;
  faint: string;
  /** Small labels and captions (type.label). */
  label: string;
  /** Text buttons and links that carry the look's accent; text-safe on glass. */
  link: string;
  border: string;
  /** Solid primary fill (buttons) and its ink. */
  primary: string;
  onPrimary: string;
  /** The primary action's fill, top to bottom; onPrimary is its ink. */
  primaryGradient: [string, string];
  /** Glyphs and numbers drawn on a kind's colour fill. */
  onKind: string;
  /** A ticked control (a row's done check, the chosen mood), top to bottom, and its ink. */
  doneFill: [string, string];
  onDone: string;
  /** The shadow under the screen's one primary action (Lavender's play disc and floating button). */
  actionGlow: string;
  /** Unchecked outlines (checkboxes, rings, set bubbles): at least 3:1 on glass. */
  controlBorder: string;
  /** Progress tracks. */
  track: string;
  danger: string;
  /** Dims the world under a sheet. */
  backdrop: string;
  statusBar: 'light' | 'dark';
  /** Scroll edges: content fades under the status bar (top) and before the tab bar (bottom). */
  edgeTop: [string, string];
  edgeBottom: [string, string];
  /** Progress bars, sliders and other small bright accents. */
  accent: string;
  /** The streak flame. */
  streak: string;
  /** The filled trail node (done, and the ring and dot of the lit one) and the count badge, and their ink. */
  node: string;
  onNode: string;
  /** Today's trail, the same object in every look: the walked part of the dotted path and the way ahead (each
   *  with its own alpha), a waypoint ahead (its ring and its fill, which hides the path behind it), and the fill
   *  inside the lit node's ring. */
  trailWalked: string;
  trailAhead: string;
  nodeAhead: string;
  nodeAheadFill: string;
  nodeCurrentFill: string;
  /** The warm wash behind a lit streak flame. */
  warmTile: string;
  /** Secondary text on Pine's canopy slab (equals muted elsewhere). */
  onSlabMuted: string;
  /** The lit (up-next or selected) rim and its glow. */
  litRim: string;
  litGlow: string;
  material: GlassMaterial;
}

interface KindStyle {
  /** Fill colour: rings, progress, tiles. */
  color: string;
  soft: string;
  /** Text-safe ink of the kind (kindText): at least 4.5:1 on glass. */
  text: string;
  label: string;
}

export type Kind = 'routines' | 'gym' | 'chinese' | 'groceries' | 'calendar' | 'inbox';

export interface Radii {
  hero: number;
  pane: number;
  row: number;
  control: number;
  inset: number;
  pill: number;
}

const LAVENDER_FLOAT = '0px 18px 40px -8px rgba(22,24,112,0.50), 0px 2px 6px rgba(22,24,112,0.24)';
const STONE_FLOAT = '6px 20px 44px -12px rgba(14,13,8,0.40), 1px 2px 6px rgba(14,13,8,0.20)';
const STONE_PANE = '4px 14px 30px -10px rgba(14,13,8,0.34), 0px 1px 2px rgba(14,13,8,0.18)';
const PAPER_FLOAT =
  '0px 0px 0px 0.5px rgba(30,34,28,0.07), 0px 1px 1px rgba(30,34,28,0.05), 0px 10px 28px -6px rgba(46,52,40,0.16), 0px 26px 52px -20px rgba(46,52,40,0.14)';
const PINE_FLOAT = '0px 18px 36px -6px rgba(0,8,6,0.60), 0px 2px 6px rgba(0,8,6,0.35), 0px 14px 30px -14px rgba(124,227,188,0.12)';
const PINE_PANE = '0px 10px 24px -6px rgba(0,8,6,0.50), 0px 1px 2px rgba(0,8,6,0.30)';

const PALETTES: Record<ThemeName, { colors: Palette; kinds: Record<Kind, KindStyle>; radii: Radii }> = {
  lavender: {
    colors: {
      gradient: ['#6470CC', '#5563C2', '#3D48A4'],
      bg: '#5563C2',
      text: '#FFFFFF',
      muted: '#FBFAFF',
      faint: '#FAF9FF',
      label: '#FBFAFF',
      link: '#FFFFFF',
      border: 'rgba(255,255,255,0.28)',
      primary: '#5638CC',
      onPrimary: '#FFFFFF',
      primaryGradient: ['#7458E8', '#5638CC'],
      onKind: '#2A1A78',
      doneFill: ['#FFC4EE', '#FFA6DF'],
      onDone: '#2A1A78',
      actionGlow: '0px 10px 26px -6px rgba(255,120,210,0.60), 0px 2px 6px rgba(22,24,112,0.30)',
      controlBorder: 'rgba(255,255,255,0.70)',
      track: 'rgba(18,20,88,0.32)',
      danger: '#FFF8FA',
      backdrop: 'rgba(20,24,96,0.45)',
      statusBar: 'light',
      edgeTop: ['rgba(65,73,171,0.92)', 'rgba(65,73,171,0)'],
      edgeBottom: ['rgba(48,46,150,0)', 'rgba(48,46,150,0.85)'],
      accent: '#FFB3E6',
      streak: '#FFB3E6',
      node: '#FFFFFF',
      onNode: '#4A35C8',
      trailWalked: 'rgba(255,255,255,0.90)',
      trailAhead: 'rgba(255,255,255,0.50)',
      nodeAhead: 'rgba(255,255,255,0.80)',
      nodeAheadFill: 'rgba(58,66,166,0.92)',
      nodeCurrentFill: 'rgba(74,53,200,0.92)',
      warmTile: 'rgba(255,179,230,0.30)',
      onSlabMuted: '#FBFAFF',
      litRim: 'rgba(255,255,255,0.85)',
      litGlow: '0px 6px 18px rgba(190,150,255,0.45)',
      material: {
        live: { tint: 'default', intensity: 8, reduction: 0.33, webBlur: 24, webSaturate: 1.6 },
        chromeTint: 'rgba(40,46,158,0.30)',
        lensSaturation: 1.0,
        base: 'rgba(48,54,168,0.10)',
        body: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)'],
        bodyAngle: 160,
        caustic: 'rgba(255,150,220,0.24)',
        causticAt: '90% 115%',
        causticSize: '70% 55%',
        caustic2: 'rgba(170,190,255,0.10)',
        caustic2At: '0% 0%',
        caustic2Size: '60% 50%',
        topGlow: 'rgba(255,255,255,0.16)',
        topGlowPx: 20,
        rimTop: 'rgba(255,255,255,0.80)',
        rimLeft: 'rgba(255,255,255,0.40)',
        rimRight: 'rgba(255,255,255,0.22)',
        rimBottom: 'rgba(255,170,230,0.40)',
        innerTop: 'rgba(255,255,255,0.55)',
        innerBottom: 'rgba(255,150,220,0.28)',
        innerGlow: 'inset 0px 0px 20px rgba(220,200,255,0.14)',
        sheen: 'rgba(255,255,255,0.03)',
        shadowFloat: LAVENDER_FLOAT,
        shadowPane: '0px 12px 28px -6px rgba(22,24,112,0.45), 0px 1px 3px rgba(22,24,112,0.20)',
        shadowHero: `${LAVENDER_FLOAT}, 0px 22px 50px -6px rgba(255,120,210,0.34)`,
        pressFill: 'rgba(255,255,255,0.12)',
        pressRim: 'rgba(255,255,255,0.95)',
        control: { body: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)'], shadow: '0px 8px 18px -6px rgba(22,24,112,0.50)' },
        inset: { fill: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.16)', borderTop: 'rgba(255,255,255,0.34)' },
        receded: { body: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)'], shadow: '0px 4px 12px -4px rgba(26,28,124,0.24)' },
        sheet: {
          body: ['rgba(62,68,190,0.84)', 'rgba(34,36,128,0.93)'],
          rimTop: 'rgba(255,255,255,0.60)',
          band: ['rgba(255,255,255,0.14)', 120],
          grip: 'rgba(255,255,255,0.50)',
        },
        drop: {
          fill: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.14)'],
          rim: 'rgba(255,255,255,0.70)',
          rimSide: 'rgba(255,255,255,0.22)',
          shadow: '0px 4px 12px -2px rgba(26,28,124,0.40)',
          ink: '#FFFFFF',
        },
        light: { period: 90000, layers: ['lavender-orb-pink', 'lavender-orb-blue'], catch: 0.36 },
        bloom: 'radial-gradient(60% 60% at 30% 20%, rgba(200,206,255,0.06), transparent 70%)',
      },
    },
    kinds: {
      routines: { color: '#C9A8FF', soft: 'rgba(201,168,255,0.22)', text: '#FFFFFF', label: 'Routines' },
      gym: { color: '#FFC9A8', soft: 'rgba(255,201,168,0.22)', text: '#FFFFFF', label: 'Gym' },
      chinese: { color: '#FFB3E6', soft: 'rgba(255,179,230,0.22)', text: '#FFFFFF', label: 'Language' },
      groceries: { color: '#9FF0D0', soft: 'rgba(159,240,208,0.20)', text: '#FFFFFF', label: 'Groceries' },
      calendar: { color: '#E9E5FF', soft: 'rgba(255,255,255,0.20)', text: '#FFFFFF', label: 'Calendar' },
      inbox: { color: '#B9C8FF', soft: 'rgba(185,200,255,0.22)', text: '#FFFFFF', label: 'Inbox' },
    },
    radii: { hero: 28, pane: 22, row: 20, control: 26, inset: 16, pill: 999 },
  },
  stone: {
    colors: {
      gradient: ['#6E6C5A', '#4F4E43', '#36362D'],
      bg: '#4F4E43',
      text: '#FFFBE9',
      muted: '#F1ECE0',
      faint: '#EFE9DC',
      label: '#F3E9D3',
      link: '#F5EDDA',
      border: 'rgba(242,238,227,0.14)',
      primary: '#E6D6B3',
      onPrimary: '#2E2D24',
      primaryGradient: ['#F3E9D2', '#D3C39F'],
      onKind: '#2E2D24',
      doneFill: ['#F3E9D2', '#D3C39F'],
      onDone: '#2E2D24',
      actionGlow: STONE_PANE,
      controlBorder: 'rgba(255,247,228,0.62)',
      track: 'rgba(16,16,10,0.34)',
      danger: '#FAE7E1',
      backdrop: 'rgba(14,13,8,0.50)',
      statusBar: 'light',
      edgeTop: ['rgba(40,40,30,0.55)', 'rgba(40,40,30,0)'],
      edgeBottom: ['rgba(36,36,28,0)', 'rgba(36,36,28,0.55)'],
      accent: '#E6D6B3',
      streak: '#E6D6B3',
      node: '#E6D6B3',
      onNode: '#2E2D24',
      trailWalked: 'rgba(230,214,179,0.85)',
      trailAhead: 'rgba(239,233,220,0.50)',
      nodeAhead: 'rgba(255,247,228,0.70)',
      nodeAheadFill: 'rgba(58,57,47,0.92)',
      nodeCurrentFill: 'rgba(46,45,36,0.92)',
      warmTile: 'rgba(230,214,179,0.30)',
      onSlabMuted: '#F1ECE0',
      litRim: 'rgba(230,214,179,0.90)',
      litGlow: '0px 8px 22px rgba(230,208,160,0.30)',
      material: {
        live: { tint: 'systemUltraThinMaterialDark', intensity: 10, reduction: 0.42, webBlur: 28, webSaturate: 1.1 },
        chromeTint: 'rgba(24,24,18,0.36)',
        lensSaturation: 1.0,
        // A warm mid-olive smoke rather than a dark one: over the shadowed room the glass reads a touch lighter than
        // what is behind it, over the sun shafts a touch darker, so ivory type holds everywhere (scripts/check-contrast.py).
        base: 'rgba(52,51,42,0.56)',
        body: ['rgba(255,246,226,0.03)', 'rgba(20,20,14,0.24)'],
        bodyAngle: 160,
        caustic: 'rgba(255,236,196,0.10)',
        causticAt: '0% 0%',
        causticSize: '80% 70%',
        caustic2: 'rgba(10,10,6,0.20)',
        caustic2At: '100% 110%',
        caustic2Size: '70% 60%',
        topGlow: 'rgba(255,244,220,0.07)',
        topGlowPx: 20,
        rimTop: 'rgba(255,247,228,0.42)',
        rimLeft: 'rgba(255,247,228,0.22)',
        rimRight: 'rgba(255,247,228,0.07)',
        rimBottom: 'rgba(0,0,0,0.28)',
        innerTop: 'rgba(255,250,236,0.12)',
        innerBottom: 'rgba(0,0,0,0.25)',
        innerGlow: 'inset 0px -12px 20px rgba(10,10,6,0.20)',
        hairline: 'linear-gradient(90deg, transparent, rgba(255,250,236,0.60) 30%, transparent)',
        grain: 0.04,
        sheen: 'rgba(255,240,205,0.02)',
        shadowFloat: STONE_FLOAT,
        shadowPane: STONE_PANE,
        shadowHero: STONE_FLOAT,
        pressFill: 'rgba(255,236,196,0.06)',
        pressRim: 'rgba(255,246,224,0.55)',
        control: { body: ['rgba(255,246,226,0.06)', 'rgba(30,29,22,0.50)'], shadow: STONE_PANE },
        inset: { fill: 'rgba(255,246,226,0.04)', border: 'rgba(255,247,228,0.10)', borderTop: 'rgba(255,247,228,0.22)' },
        receded: { body: ['rgba(40,38,29,0.30)', 'rgba(18,18,13,0.40)'], shadow: '0px 1px 2px rgba(14,13,8,0.14)' },
        sheet: { body: ['rgba(58,57,48,0.90)', 'rgba(38,38,31,0.96)'], rimTop: 'rgba(255,247,228,0.40)', grip: 'rgba(255,247,228,0.32)' },
        drop: {
          fill: ['rgba(255,246,226,0.14)', 'rgba(255,246,226,0.08)'],
          rim: 'rgba(255,247,228,0.45)',
          rimSide: 'rgba(255,247,228,0.08)',
          shadow: '2px 6px 14px -6px rgba(14,13,8,0.45)',
          ink: '#FFFBE9',
        },
        light: { period: 22000, layers: ['stone-light-beam'], catch: 0.4 },
      },
    },
    kinds: {
      routines: { color: '#E6D6B3', soft: 'rgba(230,214,179,0.16)', text: '#F3E9D3', label: 'Routines' },
      gym: { color: '#CDB083', soft: 'rgba(205,176,131,0.16)', text: '#F2E6CD', label: 'Gym' },
      chinese: { color: '#D6AF99', soft: 'rgba(214,175,153,0.16)', text: '#F7E8E0', label: 'Language' },
      groceries: { color: '#B7BF98', soft: 'rgba(183,191,152,0.16)', text: '#E6EAD5', label: 'Groceries' },
      calendar: { color: '#B8AF9B', soft: 'rgba(184,175,155,0.16)', text: '#ECE8DE', label: 'Calendar' },
      inbox: { color: '#EDE3CC', soft: 'rgba(237,227,204,0.16)', text: '#F3EBD8', label: 'Inbox' },
    },
    radii: { hero: 28, pane: 24, row: 20, control: 22, inset: 14, pill: 999 },
  },
  paper: {
    colors: {
      gradient: ['#F8F7F3', '#EEEFEA', '#E4E7E1'],
      bg: '#F1F1EC',
      text: '#131512',
      muted: '#4F5550',
      faint: '#5C625D',
      label: '#4F5550',
      link: '#131512',
      border: '#E9E9E4',
      primary: '#1A1C19',
      onPrimary: '#FFFFFF',
      primaryGradient: ['rgba(26,28,25,0.86)', 'rgba(26,28,25,0.94)'],
      onKind: '#FFFFFF',
      doneFill: ['rgba(26,28,25,0.86)', 'rgba(26,28,25,0.94)'],
      onDone: '#FFFFFF',
      actionGlow: '0px 6px 16px -4px rgba(46,52,40,0.18)',
      controlBorder: 'rgba(30,34,28,0.50)',
      track: 'rgba(30,34,28,0.08)',
      danger: '#B8281A',
      backdrop: 'rgba(24,28,22,0.22)',
      statusBar: 'dark',
      edgeTop: ['rgba(248,247,243,0.92)', 'rgba(248,247,243,0)'],
      edgeBottom: ['rgba(228,231,225,0)', 'rgba(228,231,225,0.9)'],
      accent: '#1A1C19',
      streak: '#E0601F',
      node: '#2F3A33',
      onNode: '#FFFFFF',
      trailWalked: 'rgba(47,58,51,0.85)',
      trailAhead: 'rgba(92,98,93,0.55)',
      nodeAhead: 'rgba(30,34,28,0.56)',
      nodeAheadFill: 'rgba(255,255,255,0.65)',
      nodeCurrentFill: 'rgba(255,255,255,0.80)',
      warmTile: '#FFE2C8',
      onSlabMuted: '#4F5550',
      litRim: '#131512',
      litGlow: '0px 10px 24px -6px rgba(26,28,25,0.32)',
      material: {
        live: { tint: 'light', intensity: 8, reduction: 0.33, webBlur: 22, webSaturate: 1.2 },
        chromeTint: 'rgba(255,255,255,0.62)',
        lensSaturation: 1.1,
        base: 'rgba(255,255,255,0)',
        body: ['rgba(255,255,255,0.84)', 'rgba(255,255,255,0.70)'],
        bodyAngle: 170,
        caustic: 'rgba(255,214,186,0.22)',
        causticAt: '100% 0%',
        causticSize: '70% 60%',
        caustic2: 'rgba(214,224,210,0.28)',
        caustic2At: '50% 120%',
        caustic2Size: '90% 50%',
        topGlow: 'rgba(255,255,255,0.90)',
        topGlowPx: 14,
        rimTop: '#FFFFFF',
        rimLeft: 'rgba(255,255,255,0.98)',
        rimRight: 'rgba(255,255,255,0.55)',
        rimBottom: 'rgba(20,22,18,0.10)',
        innerTop: '#FFFFFF',
        innerBottom: 'rgba(20,22,18,0.05)',
        sheen: 'rgba(255,250,240,0.55)',
        shadowFloat: PAPER_FLOAT,
        shadowPane: '0px 0px 0px 0.5px rgba(30,34,28,0.07), 0px 1px 2px rgba(20,22,18,0.05), 0px 8px 22px -6px rgba(40,46,38,0.12)',
        shadowHero: PAPER_FLOAT,
        pressFill: 'rgba(20,22,18,0.04)',
        pressRim: '#FFFFFF',
        control: { body: ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.60)'], shadow: '0px 6px 16px -4px rgba(46,52,40,0.18)' },
        inset: { fill: 'rgba(255,255,255,0.65)', border: 'rgba(20,22,18,0.06)', borderTop: '#FFFFFF' },
        receded: { body: ['rgba(255,255,255,0.46)', 'rgba(255,255,255,0.34)'], shadow: '0px 0px 0px 0.5px rgba(30,34,28,0.07)' },
        sheet: {
          body: ['rgba(252,252,249,0.96)', 'rgba(246,246,242,0.98)'],
          rimTop: '#FFFFFF',
          band: ['rgba(255,255,255,0.9)', 80],
          grip: 'rgba(20,22,18,0.18)',
        },
        drop: {
          fill: ['rgba(26,28,25,0.08)', 'rgba(26,28,25,0.06)'],
          rim: 'rgba(255,255,255,0.90)',
          rimSide: 'rgba(26,28,25,0.05)',
          ink: '#131512',
        },
        light: { period: 30000, layers: ['paper-light-sun', 'paper-mist'], catch: 0.5 },
      },
    },
    kinds: {
      routines: { color: '#2F54EB', soft: '#E5EAFD', text: '#2A4BD6', label: 'Routines' },
      gym: { color: '#C2410C', soft: '#FDE9E0', text: '#AD390D', label: 'Gym' },
      chinese: { color: '#D7263D', soft: '#FBE4E7', text: '#BE1E34', label: 'Language' },
      groceries: { color: '#14814F', soft: '#E1F3EA', text: '#126E44', label: 'Groceries' },
      calendar: { color: '#6E7570', soft: '#ECEEEB', text: '#5A615C', label: 'Calendar' },
      inbox: { color: '#7A5AF8', soft: '#EEE9FE', text: '#6440EC', label: 'Inbox' },
    },
    radii: { hero: 24, pane: 22, row: 22, control: 23, inset: 16, pill: 999 },
  },
  pine: {
    colors: {
      gradient: ['#0B2A24', '#071D19', '#03110E'],
      bg: '#071D19',
      text: '#F1F7F3',
      muted: '#C4DBD1',
      faint: '#C0D8CE',
      label: '#C4DBD1',
      link: '#84E5C0',
      border: 'rgba(214,240,228,0.12)',
      primary: '#7CE3BC',
      onPrimary: '#06201A',
      primaryGradient: ['#A3F0D3', '#7CE3BC'],
      onKind: '#06201A',
      doneFill: ['#A3F0D3', '#7CE3BC'],
      onDone: '#06201A',
      actionGlow: '0px 10px 26px -6px rgba(124,227,188,0.42), 0px 2px 6px rgba(0,8,6,0.40)',
      controlBorder: 'rgba(214,240,228,0.58)',
      track: 'rgba(214,240,228,0.08)',
      danger: '#F7C8C0',
      backdrop: 'rgba(0,10,8,0.55)',
      statusBar: 'light',
      // The status bar sits on the canopy slab, so the top edge fades in the slab's own teal: invisible over the
      // slab at rest, a teal band over content once the slab has scrolled away.
      edgeTop: ['rgba(31,99,82,0.94)', 'rgba(31,99,82,0)'],
      edgeBottom: ['rgba(3,17,14,0)', 'rgba(3,17,14,0.90)'],
      accent: '#7CE3BC',
      streak: '#7CE3BC',
      node: '#7CE3BC',
      onNode: '#06201A',
      trailWalked: 'rgba(124,227,188,0.85)',
      trailAhead: 'rgba(192,216,206,0.60)',
      nodeAhead: 'rgba(214,240,228,0.58)',
      nodeAheadFill: '#071D19',
      nodeCurrentFill: '#071D19',
      warmTile: 'rgba(124,227,188,0.16)',
      onSlabMuted: '#D8EBE3',
      litRim: 'rgba(124,227,188,0.60)',
      // moonlight spilling from under the lit card onto the floor (offset, never a flat halo)
      litGlow: '0px 12px 28px -10px rgba(124,227,188,0.38)',
      material: {
        selectRim: 'rgba(124,227,188,0.60)',
        live: { tint: 'systemUltraThinMaterialDark', intensity: 10, reduction: 0.42, webBlur: 24, webSaturate: 1.3 },
        chromeTint: 'rgba(4,18,15,0.55)',
        lensSaturation: 1.15,
        base: 'rgba(6,26,22,0.30)',
        body: ['rgba(26,80,66,0.40)', 'rgba(6,26,22,0.66)'],
        bodyAngle: 165,
        caustic: 'rgba(124,227,188,0.12)',
        causticAt: '100% 120%',
        causticSize: '70% 60%',
        caustic2: 'rgba(124,227,188,0.09)',
        caustic2At: '100% 0%',
        caustic2Size: '75% 75%',
        topGlow: 'rgba(200,255,232,0.10)',
        topGlowPx: 20,
        rimTop: 'rgba(168,240,212,0.28)',
        rimLeft: 'rgba(168,240,212,0.18)',
        rimRight: 'rgba(124,227,188,0.08)',
        rimBottom: 'rgba(124,227,188,0.22)',
        innerTop: 'rgba(200,255,232,0.16)',
        innerBottom: 'rgba(124,227,188,0.20)',
        innerGlow: 'inset 0px 0px 16px rgba(124,227,188,0.06)',
        sheen: 'rgba(160,255,215,0.035)',
        sheenFromBelow: true,
        shadowFloat: PINE_FLOAT,
        shadowPane: PINE_PANE,
        shadowHero: PINE_FLOAT,
        pressFill: 'rgba(124,227,188,0.06)',
        pressRim: 'rgba(124,227,188,0.55)',
        control: { body: ['rgba(30,88,74,0.44)', 'rgba(8,32,26,0.70)'], shadow: PINE_PANE },
        inset: { fill: 'rgba(214,240,228,0.05)', border: 'rgba(214,240,228,0.10)', borderTop: 'rgba(214,240,228,0.18)' },
        receded: { body: ['rgba(26,80,66,0.30)', 'rgba(6,26,22,0.46)'], shadow: 'none' },
        sheet: { body: ['rgba(20,66,58,0.94)', 'rgba(10,38,33,0.97)'], rimTop: 'rgba(168,240,212,0.24)', grip: 'rgba(124,227,188,0.45)' },
        drop: {
          fill: ['rgba(124,227,188,0.18)', 'rgba(124,227,188,0.12)'],
          rim: 'rgba(124,227,188,0.50)',
          rimSide: 'rgba(124,227,188,0.22)',
          ink: '#7CE3BC',
        },
        light: { period: 16000, layers: ['pine-light-moon'], catch: 0.6 },
        bloom: 'radial-gradient(60% 60% at 70% 100%, rgba(124,227,188,0.1), transparent 70%)',
        sheetOrb: 'radial-gradient(60% 50% at 100% 0%, rgba(124,227,188,0.10), rgba(124,227,188,0) 70%)',
        outlineChips: true,
        canopy: {
          gradient: ['#1F6352', '#164D41', '#113D34'],
          rim: 'rgba(168,240,212,0.18)',
          shadow: '0px 16px 32px -10px rgba(0,8,6,0.55), 0px 2px 6px rgba(0,8,6,0.30)',
          art: 0.6,
          maxArt: 180,
          moon: 'rgba(124,227,188,0.30)',
          badge: 'rgba(4,14,12,0.55)',
          inset: { fill: 'rgba(4,14,12,0.30)', border: 'rgba(168,240,212,0.16)', borderTop: 'rgba(4,14,12,0.40)' },
        },
      },
    },
    kinds: {
      routines: { color: '#7CE3BC', soft: 'rgba(124,227,188,0.14)', text: '#84E5C0', label: 'Routines' },
      gym: { color: '#F2B061', soft: 'rgba(242,176,97,0.14)', text: '#F6CB98', label: 'Gym' },
      chinese: { color: '#F4A08F', soft: 'rgba(244,160,143,0.14)', text: '#F8C7BE', label: 'Language' },
      groceries: { color: '#E8DDB5', soft: 'rgba(232,221,181,0.14)', text: '#E8DDB5', label: 'Groceries' },
      calendar: { color: '#B7C9C2', soft: 'rgba(183,201,194,0.14)', text: '#C8D5D0', label: 'Calendar' },
      inbox: { color: '#9CCBF2', soft: 'rgba(156,203,242,0.14)', text: '#B3D7F5', label: 'Inbox' },
    },
    radii: { hero: 24, pane: 20, row: 16, control: 22, inset: 12, pill: 999 },
  },
};

export const THEME_OPTIONS: { name: ThemeName; label: string; description: string }[] = [
  { name: 'lavender', label: 'Lavender', description: 'Periwinkle glass lit with rose light' },
  { name: 'stone', label: 'Stone', description: 'Smoked glass in quiet sunlight' },
  { name: 'paper', label: 'Paper', description: 'Bright frosted glass in morning mist' },
  { name: 'pine', label: 'Pine', description: 'Smoked green glass under a night canopy' },
];

const FONTS = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  /** The face for numbers (weights, sets, dates, counts), always set with tabular figures. A sans in every look;
   *  the names are kept from when one look set numbers in a monospace. */
  mono: 'DMSans_500Medium',
  monoMedium: 'DMSans_700Bold',
  /** A real monospace, for text that must line up character by character (the backup code), in every look. */
  code: 'DMMono_400Regular',
  /** The word on a language flashcard. */
  word: 'DMSans_400Regular',
};

// Per-look faces. Every look sets numbers in DM Sans with tabular figures (no mono anywhere but the backup code).
// Stone has no bold (its "bold" is DM Sans 500) and sets titles, numerals and the flashcard word in DM Sans
// Light; Paper is Bricolage display over DM Sans; Lavender and Pine are DM Sans throughout.
const LOOK_FONTS: Record<ThemeName, Partial<typeof FONTS> & { display: string; displayMedium: string; numeral: string }> = {
  lavender: {
    display: 'DMSans_700Bold',
    displayMedium: 'DMSans_700Bold',
    numeral: 'DMSans_300Light',
  },
  stone: {
    display: 'DMSans_300Light',
    displayMedium: 'DMSans_400Regular',
    numeral: 'DMSans_300Light',
    bodyBold: 'DMSans_500Medium',
    mono: 'DMSans_400Regular',
    monoMedium: 'DMSans_500Medium',
    word: 'DMSans_300Light',
  },
  paper: {
    display: 'BricolageGrotesque_700Bold',
    displayMedium: 'BricolageGrotesque_500Medium',
    numeral: 'DMSans_500Medium',
  },
  pine: { display: 'DMSans_700Bold', displayMedium: 'DMSans_500Medium', numeral: 'DMSans_500Medium' },
};

/** `numeral` is the face of a big clock or count (the focus timer): a sans with tabular figures, never mono. */
export type Fonts = typeof FONTS & { display: string; displayMedium: string; numeral: string };

const TABULAR: TextStyle['fontVariant'] = ['tabular-nums'];

function makeType(name: ThemeName, colors: Palette, fonts: Fonts) {
  const base = {
    hero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: colors.text, letterSpacing: -1.5 },
    heading: { fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 24, color: colors.text },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
    bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.text },
    /** Secondary lines. Nothing secondary goes below 14 except captions. */
    small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
    /** Captions only (chart axes, tab labels). */
    caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.muted },
    button: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.link, textDecorationLine: 'underline' },
  } satisfies Record<string, TextStyle>;

  // Sizes and faces vary by look; line heights do not, so every header, section and sheet lays out to the same
  // heights in every look.
  const perLook = {
    lavender: {
      title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.6 },
      sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 26, color: colors.text },
      sheetTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: colors.text, letterSpacing: -0.4 },
      label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.4, textTransform: 'none', color: colors.label },
      badge: { fontFamily: fonts.bodyMedium, fontSize: 13, letterSpacing: 0.4, textTransform: 'none', color: colors.label },
      num: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text, fontVariant: TABULAR },
    },
    stone: {
      title: { fontFamily: 'DMSans_300Light', fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.2 },
      sectionTitle: { fontFamily: 'DMSans_400Regular', fontSize: 18, lineHeight: 26, color: colors.text, letterSpacing: 0.1 },
      sheetTitle: { fontFamily: 'DMSans_300Light', fontSize: 28, lineHeight: 34, color: colors.text },
      label: {
        fontFamily: 'DMSans_500Medium',
        fontSize: 13,
        lineHeight: 18,
        letterSpacing: 0.4,
        textTransform: 'none',
        color: colors.label,
      },
      badge: { fontFamily: 'DMSans_500Medium', fontSize: 13, letterSpacing: 0.4, textTransform: 'none', color: colors.label },
      num: { fontFamily: 'DMSans_500Medium', fontSize: 16, color: colors.text, fontVariant: TABULAR },
    },
    paper: {
      title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.6 },
      sectionTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.text, letterSpacing: -0.3 },
      sheetTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 34, color: colors.text, letterSpacing: -0.3 },
      label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 18, textTransform: 'none', color: colors.label },
      badge: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.2, textTransform: 'none', color: colors.label },
      num: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, fontVariant: TABULAR },
    },
    pine: {
      title: { fontFamily: 'DMSans_700Bold', fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.8 },
      sectionTitle: { fontFamily: 'DMSans_700Bold', fontSize: 21, lineHeight: 26, color: colors.text, letterSpacing: -0.4 },
      sheetTitle: { fontFamily: 'DMSans_700Bold', fontSize: 24, lineHeight: 34, color: colors.text, letterSpacing: -0.4 },
      label: { fontFamily: 'DMSans_700Bold', fontSize: 13, lineHeight: 18, letterSpacing: 0.2, textTransform: 'none', color: colors.label },
      badge: { fontFamily: 'DMSans_700Bold', fontSize: 13, letterSpacing: 0.2, textTransform: 'none', color: colors.text },
      num: { fontFamily: fonts.mono, fontSize: 15, color: colors.text, fontVariant: TABULAR },
    },
  } satisfies Record<ThemeName, Record<string, TextStyle>>;

  return { ...base, ...perLook[name] };
}

export interface Theme {
  name: ThemeName;
  colors: Palette;
  kinds: Record<Kind, KindStyle>;
  fonts: Fonts;
  type: ReturnType<typeof makeType>;
  radii: Radii;
  /** The pane radius (kept for older call sites; prefer radii). */
  radius: number;
}

export function buildTheme(name: ThemeName): Theme {
  const look = PALETTES[name] ? name : 'lavender';
  const { colors, kinds, radii } = PALETTES[look];
  const fonts: Fonts = { ...FONTS, ...LOOK_FONTS[look] };
  return {
    name: look,
    colors,
    kinds,
    fonts,
    type: makeType(look, colors, fonts),
    radii,
    radius: radii.pane,
  };
}

const THEMES: Record<ThemeName, Theme> = {
  lavender: buildTheme('lavender'),
  stone: buildTheme('stone'),
  paper: buildTheme('paper'),
  pine: buildTheme('pine'),
};

export function themeFor(name: ThemeName | undefined): Theme {
  return THEMES[name ?? 'lavender'] ?? THEMES.lavender;
}

export const ThemeContext = createContext<Theme>(THEMES.lavender);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Styles that depend on the active look, built once per look. */
export function useStyles<T>(make: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => make(theme), [make, theme]);
}
