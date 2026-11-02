// The desktop shell's measurements: one shared object for every look (the looks differ in colour, glass, type and
// radii only). Comfortable windows (1280 and wider) and compact ones (1024 to 1279).
import { useWindowDimensions } from 'react-native';
import { isLight } from '../glass/colour';
import { useDesktop } from './context';

export const SHELL = {
  /** The labelled sidebar and the icon rail. */
  sidebar: 264,
  rail: 72,
  /** The sidebar's corner radius: the tab bar's. */
  radius: 30,
  /** Desktop controls (buttons, the search pill, sidebar items). */
  control: 40,
  /** Chips and segmented switches. */
  chip: 36,
  /** Rows: one line and two lines. */
  row: 44,
  row2: 56,
  /** The grid stops at this width and sits centred. */
  contentMax: 1440,
  /** A kind's translucent soft wash on desktop glass (calendar blocks, the gym's New best) is drawn at this share:
   *  the wide panes are clearer than the phone's cards, so the full wash would lift their text below 4.5:1. */
  wash: 0.4,
};

/** The primary pill's hover light (New, the first-run Restore): it deepens the fill under light ink and lifts it
 *  under dark ink, so the label only gains contrast (scripts/check-contrast.py checks onPrimary through it). */
export function primaryHover(onPrimary: string): string {
  return isLight(onPrimary) ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)';
}

export interface ShellMetrics {
  compact: boolean;
  /** Space between the window's edge and the sidebar. */
  inset: number;
  /** Space inside the content area's sides. */
  pad: number;
  gutter: number;
  panelPad: number;
  /** The top bar's controls: their top and the top of the page under them. */
  barTop: number;
  pageTop: number;
  titleSize: number;
  titleLine: number;
}

export function useShellMetrics(): ShellMetrics {
  const { compact } = useDesktop();
  return compact
    ? { compact, inset: 12, pad: 24, gutter: 16, panelPad: 16, barTop: 24, pageTop: 76, titleSize: 34, titleLine: 40 }
    : { compact, inset: 16, pad: 32, gutter: 20, panelPad: 20, barTop: 28, pageTop: 80, titleSize: 38, titleLine: 44 };
}

/** The window's size, for pages that lay their grid out in columns. */
export function useWindow() {
  return useWindowDimensions();
}
