// Visual identity. Three looks share one layout:
// - Lavender: soft violet glass, white type, bright accents.
// - Stone: warm olive and stone glass, cream type, earthy accents.
// - Paper: a bright trail page, ink on warm paper, a misty mountain header.
// - Pine: a dark evergreen training hub, mint accents, uppercase micro labels.
// Screens read the active look with useTheme() / useStyles(makeStyles).
import { createContext, useContext, useMemo } from 'react';
import type { TextStyle } from 'react-native';

export type ThemeName = 'lavender' | 'stone' | 'paper' | 'pine';

export interface Palette {
  /** Background gradient, top to bottom. */
  gradient: [string, string, string];
  bg: string;
  card: string;
  cardBorder: string;
  /** Solid surface for bottom sheets and forms. */
  sheet: string;
  input: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  /** Main buttons and the selected chip. */
  primary: string;
  onPrimary: string;
  /** Pressed rows, tracks, unselected fills. */
  primarySoft: string;
  danger: string;
  backdrop: string;
  tabBar: string;
  statusBar: 'light' | 'dark';
  /** Frosted glass: a diagonal fill laid over the blur, brighter at the top-left edge. */
  glassFill: [string, string];
  blurTint: 'light' | 'dark' | 'default';
  /** Coloured glow under the main buttons. */
  glow: string;
  /** Liquid glass light: the bright top rim, the specular shine, and the colour caught along the bottom edge. */
  rim: string;
  /** Progress bars, sliders and other small bright accents. */
  accent: string;
  /** Selected pills and chips, and their label colour. */
  selected: string;
  onSelected: string;
  /** Deep, soft drop shadow that lifts glass off the backdrop (CSS box-shadow syntax). */
  shadow: string;
  shine: string;
  edgeGlow: string;
  /** Page looks: the light square behind a row's icon. */
  tile: string;
  /** Page looks: small pills and chips at rest (streak, filters). */
  chip: string;
  /** Page looks: the filled trail node and the count badge. */
  node: string;
  onNode: string;
}

interface KindStyle {
  color: string;
  soft: string;
  label: string;
}

export type Kind = 'routines' | 'gym' | 'chinese' | 'groceries' | 'calendar' | 'inbox';

const PALETTES: Record<ThemeName, { colors: Palette; kinds: Record<Kind, KindStyle> }> = {
  lavender: {
    colors: {
      gradient: ['#A3A6F2', '#5E5FD0', '#221A68'],
      bg: '#5E5FD0',
      card: 'rgba(40,70,160,0.32)',
      cardBorder: 'rgba(255,255,255,0.28)',
      sheet: '#5B6BBC',
      input: 'rgba(40,70,160,0.32)',
      text: '#FFFFFF',
      muted: 'rgba(255,255,255,0.92)',
      faint: 'rgba(255,255,255,0.74)',
      border: 'rgba(255,255,255,0.28)',
      primary: '#FFFFFF',
      onPrimary: '#4A55B8',
      primarySoft: 'rgba(147,141,238,0.6)',
      danger: '#FFD1DC',
      backdrop: 'rgba(20,30,80,0.4)',
      tabBar: 'rgba(255,255,255,0.12)',
      statusBar: 'light',
      glassFill: ['rgba(58,38,166,0.58)', 'rgba(30,16,116,0.64)'],
      blurTint: 'default',
      glow: '#CD94E6',
      rim: 'rgba(255,255,255,0.62)',
      accent: '#F270C8',
      selected: '#6E5FD3',
      onSelected: '#FFFFFF',
      shadow: '0px 14px 34px rgba(26,14,96,0.38), inset 0px 1px 1px rgba(255,255,255,0.45)',
      shine: 'rgba(255,255,255,0.14)',
      edgeGlow: 'rgba(255,143,208,0.2)',
      tile: 'rgba(255,255,255,0.18)',
      chip: 'rgba(255,255,255,0.14)',
      node: '#FFFFFF',
      onNode: '#4A55B8',
    },
    kinds: {
      routines: { color: '#5B43D6', soft: 'rgba(91,67,214,0.25)', label: 'Routines' },
      gym: { color: '#FF7A59', soft: 'rgba(255,122,89,0.25)', label: 'Gym' },
      chinese: { color: '#E8508A', soft: 'rgba(232,80,138,0.25)', label: 'Chinese' },
      groceries: { color: '#1FB386', soft: 'rgba(31,179,134,0.25)', label: 'Groceries' },
      calendar: { color: '#E9E5FF', soft: 'rgba(255,255,255,0.2)', label: 'Calendar' },
      inbox: { color: '#3F8CFF', soft: 'rgba(63,140,255,0.25)', label: 'Inbox' },
    },
  },
  stone: {
    colors: {
      gradient: ['#676755', '#4B4B44', '#31332B'],
      bg: '#4B4B44',
      card: 'rgba(255,250,235,0.08)',
      cardBorder: 'rgba(255,250,235,0.10)',
      sheet: '#3F403A',
      input: 'rgba(255,250,235,0.08)',
      text: '#FFFBE9',
      muted: '#D8D1C1',
      faint: 'rgba(255,251,233,0.6)',
      border: 'rgba(242,238,227,0.14)',
      primary: '#E6D6B3',
      onPrimary: '#2E2D24',
      primarySoft: 'rgba(255,251,233,0.12)',
      danger: '#E7A08F',
      backdrop: 'rgba(0,0,0,0.45)',
      tabBar: 'rgba(28,28,22,0.4)',
      statusBar: 'light',
      glassFill: ['rgba(40,39,30,0.30)', 'rgba(22,22,16,0.42)'],
      blurTint: 'dark',
      glow: '#E6D6B3',
      rim: 'rgba(255,248,230,0.24)',
      accent: '#E6D6B3',
      selected: '#E6D6B3',
      onSelected: '#2E2D24',
      shadow: '0px 12px 30px rgba(0,0,0,0.3), inset 0px 1px 0px rgba(255,248,230,0.12)',
      shine: 'rgba(255,248,230,0.07)',
      edgeGlow: 'rgba(230,214,179,0.06)',
      tile: 'rgba(255,250,235,0.1)',
      chip: 'rgba(255,250,235,0.1)',
      node: '#E6D6B3',
      onNode: '#2E2D24',
    },
    kinds: {
      routines: { color: '#A9B9D3', soft: 'rgba(169,185,211,0.18)', label: 'Routines' },
      gym: { color: '#D9A066', soft: 'rgba(217,160,102,0.2)', label: 'Gym' },
      chinese: { color: '#D98C7A', soft: 'rgba(217,140,122,0.2)', label: 'Chinese' },
      groceries: { color: '#A7C49A', soft: 'rgba(167,196,154,0.2)', label: 'Groceries' },
      calendar: { color: '#BDB8A6', soft: 'rgba(189,184,166,0.18)', label: 'Calendar' },
      inbox: { color: '#E4D6B4', soft: 'rgba(228,214,180,0.18)', label: 'Inbox' },
    },
  },
  paper: {
    colors: {
      gradient: ['#F5F5F2', '#F5F5F2', '#F5F5F2'],
      bg: '#F5F5F2',
      card: '#FFFFFF',
      cardBorder: '#E9E9E4',
      sheet: '#FAFAF7',
      input: '#FFFFFF',
      text: '#131512',
      muted: '#5C625D',
      faint: '#767C77',
      border: '#E9E9E4',
      primary: '#1A1C19',
      onPrimary: '#FFFFFF',
      primarySoft: '#ECECE7',
      danger: '#C42B1C',
      backdrop: 'rgba(0,0,0,0.35)',
      tabBar: '#FBFBF9',
      statusBar: 'dark',
      glassFill: ['#FFFFFF', '#FFFFFF'],
      blurTint: 'light',
      glow: 'transparent',
      rim: '#E9E9E4',
      accent: '#1A1C19',
      selected: '#1A1C19',
      onSelected: '#FFFFFF',
      shadow: '0px 1px 2px rgba(20,22,18,0.04), 0px 8px 24px rgba(20,22,18,0.06)',
      shine: 'transparent',
      edgeGlow: 'transparent',
      tile: '#F1F1ED',
      chip: '#ECECE7',
      node: '#4B4E3E',
      onNode: '#FFFFFF',
    },
    kinds: {
      routines: { color: '#2F54EB', soft: '#E5EAFD', label: 'Routines' },
      gym: { color: '#EE5A24', soft: '#FDE9E0', label: 'Gym' },
      chinese: { color: '#D7263D', soft: '#FBE4E7', label: 'Chinese' },
      groceries: { color: '#1F9D63', soft: '#E1F3EA', label: 'Groceries' },
      calendar: { color: '#6E7570', soft: '#ECEEEB', label: 'Calendar' },
      inbox: { color: '#7A5AF8', soft: '#EEE9FE', label: 'Inbox' },
    },
  },
  pine: {
    colors: {
      gradient: ['#0F3F36', '#0A2B25', '#061B17'],
      bg: '#0A2B25',
      card: '#11352E',
      cardBorder: 'rgba(214,240,228,0.1)',
      sheet: '#0F3129',
      input: 'rgba(6,27,23,0.6)',
      text: '#F1F7F3',
      muted: '#A6C4B9',
      faint: '#86A79B',
      border: 'rgba(214,240,228,0.12)',
      primary: '#7CE3BC',
      onPrimary: '#06201A',
      primarySoft: 'rgba(124,227,188,0.14)',
      danger: '#F0998A',
      backdrop: 'rgba(0,10,8,0.55)',
      tabBar: '#082520',
      statusBar: 'light',
      glassFill: ['#12382F', '#0D2C25'],
      blurTint: 'dark',
      glow: '#7CE3BC',
      rim: 'rgba(214,240,228,0.16)',
      accent: '#7CE3BC',
      selected: '#5ED0A8',
      onSelected: '#06201A',
      shadow: '0px 10px 28px rgba(0,8,6,0.4), inset 0px 1px 0px rgba(214,240,228,0.08)',
      shine: 'transparent',
      edgeGlow: 'transparent',
      tile: 'rgba(124,227,188,0.1)',
      chip: 'rgba(214,240,228,0.07)',
      node: '#7CE3BC',
      onNode: '#06201A',
    },
    kinds: {
      routines: { color: '#7CE3BC', soft: 'rgba(124,227,188,0.16)', label: 'Routines' },
      gym: { color: '#F2A65A', soft: 'rgba(242,166,90,0.16)', label: 'Gym' },
      chinese: { color: '#F08C7A', soft: 'rgba(240,140,122,0.16)', label: 'Chinese' },
      groceries: { color: '#B5E47F', soft: 'rgba(181,228,127,0.16)', label: 'Groceries' },
      calendar: { color: '#B7C9C2', soft: 'rgba(183,201,194,0.16)', label: 'Calendar' },
      inbox: { color: '#8FC7FF', soft: 'rgba(143,199,255,0.16)', label: 'Inbox' },
    },
  },
};

export const THEME_OPTIONS: { name: ThemeName; label: string; description: string }[] = [
  { name: 'lavender', label: 'Lavender', description: 'Soft violet glass, bright and playful' },
  { name: 'stone', label: 'Stone', description: 'Warm olive and stone, calm and grounded' },
  { name: 'paper', label: 'Paper', description: 'Bright and clear, a trail through your day' },
  { name: 'pine', label: 'Pine', description: 'Deep evergreen, a training hub at night' },
];

const FONTS = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
};

const DISPLAY: Record<ThemeName, { display: string; displayMedium: string }> = {
  lavender: { display: 'DMSans_700Bold', displayMedium: 'DMSans_700Bold' },
  stone: { display: 'DMSans_300Light', displayMedium: 'DMSans_400Regular' },
  paper: { display: 'BricolageGrotesque_700Bold', displayMedium: 'BricolageGrotesque_500Medium' },
  pine: { display: 'DMSans_700Bold', displayMedium: 'DMSans_500Medium' },
};

export type Fonts = typeof FONTS & { display: string; displayMedium: string };

function makeType(colors: Palette, fonts: Fonts, glass: boolean) {
  return {
    sectionTitle: glass
      ? { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text }
      : { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: colors.text, letterSpacing: -0.3 },
    hero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: colors.text, letterSpacing: -1.5 },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.text, letterSpacing: -0.4 },
    heading: { fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 24, color: colors.text },
    body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
    bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.text },
    small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
    label: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
    num: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text },
    button: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
  } satisfies Record<string, TextStyle>;
}

export interface Theme {
  name: ThemeName;
  colors: Palette;
  kinds: Record<Kind, KindStyle>;
  fonts: Fonts;
  type: ReturnType<typeof makeType>;
  radius: number;
  /** Glass looks use rounder, softer cards. */
  glass: boolean;
  /** Light type on a dark page. */
  dark: boolean;
}

export function buildTheme(name: ThemeName): Theme {
  const { colors, kinds } = PALETTES[name] ?? PALETTES.lavender;
  const fonts = { ...FONTS, ...DISPLAY[name] };
  const glass = name === 'lavender' || name === 'stone';
  return {
    name,
    colors,
    kinds,
    fonts,
    type: makeType(colors, fonts, glass),
    radius: glass ? 22 : 20,
    glass,
    dark: name !== 'paper',
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
