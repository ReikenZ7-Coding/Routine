// Whether the app draws the desktop shell, and at which density. One switch for the whole app: below 1024 dp the
// phone app draws exactly as it always has; from 1024 the desktop shell (compact up to 1279, comfortable from
// 1280). Each line has a 24 dp band, so a window dragged across it never flickers between the two. The shell is
// drawn on the web (the browser and the Windows app) only: the Android app always draws the phone layout.
import { createContext, useContext, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_MIN = 1024;
export const COMFORTABLE_MIN = 1280;
/** How far below a line the window has to shrink before it switches back. */
const BAND = 24;

export interface DesktopInfo {
  /** The desktop shell is drawn. */
  on: boolean;
  /** 1024 to 1279: the sidebar starts as a rail and opens over the content. */
  compact: boolean;
}

const PHONE: DesktopInfo = { on: false, compact: false };

/** Set by the root layout; everything else reads it with useDesktop(). The default is the phone. */
export const DesktopContext = createContext<DesktopInfo>(PHONE);

export function useDesktop(): DesktopInfo {
  return useContext(DesktopContext);
}

/** Whether the first frame drew the desktop shell (null until the switch has run once). */
let started: boolean | null = null;

/** The app opened wide: its first frame was the desktop shell. */
export function startedWide(): boolean {
  return started === true;
}

/** The root's switch on the web, with its bands remembered between renders. */
function useWebSwitch(): DesktopInfo {
  const { width } = useWindowDimensions();
  const last = useRef<DesktopInfo>(PHONE);
  const was = last.current;
  const on = was.on ? width >= DESKTOP_MIN - BAND : width >= DESKTOP_MIN;
  const comfortable = !was.compact && was.on ? width >= COMFORTABLE_MIN - BAND : width >= COMFORTABLE_MIN;
  const next = on ? { on: true, compact: !comfortable } : PHONE;
  if (next.on !== was.on || next.compact !== was.compact) last.current = next;
  if (started === null) started = last.current.on;
  return last.current;
}

/** The root's switch. On Android and iOS it is always the phone, and it doesn't listen to the window's size, so
 *  a phone app never re-renders for a split screen or a fold. */
export const useDesktopSwitch: () => DesktopInfo = Platform.OS === 'web' ? useWebSwitch : () => PHONE;
