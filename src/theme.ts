// Visual identity. Three looks share one layout:
// - Lavender: soft violet glass, white type, bright accents.
// - Stone: warm olive and stone glass, cream type, earthy accents.
// - Paper: the original quiet planner page, ink on cool paper.
// Screens read the active look with useTheme() / useStyles(makeStyles).
import { createContext, useContext, useMemo } from 'react';
import type { TextStyle } from 'react-native';

export type ThemeName = 'lavender' | 'stone' | 'paper';

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
      gradient: ['#B4A8EE', '#8494E3', '#3D5FB9'],
      bg: '#8494E3',
      card: 'rgba(40,70,160,0.32)',
      cardBorder: 'rgba(255,255,255,0.24)',
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
      tabBar: 'rgba(104,112,224,0.55)',
      statusBar: 'light',
      glassFill: ['rgba(96,102,226,0.55)', 'rgba(58,70,192,0.62)'],
      blurTint: 'default',
      glow: '#CD94E6',
      rim: 'rgba(255,255,255,0.4)',
      accent: '#F270C8',
      selected: '#6E5FD3',
      onSelected: '#FFFFFF',
      shadow: '0px 10px 30px rgba(35,58,140,0.35)',
      shine: 'rgba(255,255,255,0.12)',
      edgeGlow: 'rgba(205,148,230,0.22)',
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
      cardBorder: 'rgba(255,250,235,0.14)',
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
      tabBar: 'rgba(40,40,32,0.45)',
      statusBar: 'light',
      glassFill: ['rgba(255,250,235,0.10)', 'rgba(255,250,235,0.04)'],
      blurTint: 'dark',
      glow: '#E6D6B3',
      rim: '#93917C',
      accent: '#E6D6B3',
      selected: '#E6D6B3',
      onSelected: '#2E2D24',
      shadow: '0px 6px 18px rgba(0,0,0,0.18)',
      shine: 'rgba(255,248,230,0.08)',
      edgeGlow: 'rgba(230,214,179,0.06)',
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
      gradient: ['#F2F3F1', '#F2F3F1', '#F2F3F1'],
      bg: '#F2F3F1',
      card: '#FFFFFF',
      cardBorder: '#E1E4E0',
      sheet: '#F7F8F6',
      input: '#FFFFFF',
      text: '#141716',
      muted: '#5F6661',
      faint: '#7D837E',
      border: '#E1E4E0',
      primary: '#141716',
      onPrimary: '#FFFFFF',
      primarySoft: '#E7E9E6',
      danger: '#C42B1C',
      backdrop: 'rgba(0,0,0,0.35)',
      tabBar: '#F2F3F1',
      statusBar: 'dark',
      glassFill: ['#FFFFFF', '#FFFFFF'],
      blurTint: 'light',
      glow: 'transparent',
      rim: '#E1E4E0',
      accent: '#141716',
      selected: '#141716',
      onSelected: '#FFFFFF',
      shadow: '0px 1px 2px rgba(0,0,0,0.04)',
      shine: 'transparent',
      edgeGlow: 'transparent',
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
};

export const THEME_OPTIONS: { name: ThemeName; label: string; description: string }[] = [
  { name: 'lavender', label: 'Lavender', description: 'Soft violet glass, bright and playful' },
  { name: 'stone', label: 'Stone', description: 'Warm olive and stone, calm and grounded' },
  { name: 'paper', label: 'Paper', description: 'The original: ink on a clean page' },
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
};

export type Fonts = typeof FONTS & { display: string; displayMedium: string };

function makeType(colors: Palette, fonts: Fonts, glass: boolean) {
  return {
    sectionTitle: glass
      ? { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text }
      : { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
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
}

export function buildTheme(name: ThemeName): Theme {
  const { colors, kinds } = PALETTES[name] ?? PALETTES.lavender;
  const fonts = { ...FONTS, ...DISPLAY[name] };
  return { name, colors, kinds, fonts, type: makeType(colors, fonts, name !== 'paper'), radius: name === 'paper' ? 16 : 22, glass: name !== 'paper' };
}

const THEMES: Record<ThemeName, Theme> = {
  lavender: buildTheme('lavender'),
  stone: buildTheme('stone'),
  paper: buildTheme('paper'),
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
