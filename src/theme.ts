// Visual identity: a quiet planner page. Cool paper, ink-black type and controls,
// and one small colour per kind of routine so a day reads at a glance.
import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#F2F3F1', // paper
  card: '#FFFFFF',
  text: '#141716', // ink
  muted: '#6E7570',
  faint: '#A9AEAA',
  border: '#E1E4E0',
  primary: '#141716', // controls are ink, not a brand colour
  primarySoft: '#E7E9E6',
  danger: '#C42B1C',
};

/** One colour per kind of thing in a day. */
export const kinds = {
  routines: { color: '#2F54EB', soft: '#E5EAFD', label: 'Routines' },
  gym: { color: '#EE5A24', soft: '#FDE9E0', label: 'Gym' },
  chinese: { color: '#D7263D', soft: '#FBE4E7', label: 'Chinese' },
  groceries: { color: '#1F9D63', soft: '#E1F3EA', label: 'Groceries' },
  calendar: { color: '#6E7570', soft: '#ECEEEB', label: 'Calendar' },
} as const;

export type Kind = keyof typeof kinds;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
};

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 58, color: colors.text, letterSpacing: -1.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, color: colors.text, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 19, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  num: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text },
  button: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
  link: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, textDecorationLine: 'underline' },
} satisfies Record<string, TextStyle>;

export const radius = 16;
