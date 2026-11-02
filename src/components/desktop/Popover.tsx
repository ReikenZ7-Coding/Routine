// Popovers and menus on the desktop: sheet glass with every corner rounded, the float shadow, opening with a
// 160 ms fade and a 4 dp rise and closing in 120 ms (fade only under reduced motion). A click outside closes it;
// Esc closes it and hands focus back to whatever opened it; Up and Down move between its items, Home and End jump.
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../../theme';
import { Glass } from '../Glass';
import { EASE_OUT, FADE, useReduceMotion } from '../Motion';

const OPEN = { duration: 160, easing: EASE_OUT, ...FADE };
const CLOSE = { duration: 120, easing: EASE_OUT, ...FADE };

/** The items a keyboard moves between inside a popover or the palette. */
const ITEMS = '[role="menuitem"],[role="menuitemradio"],[role="option"],[role="button"],[role="link"],[role="checkbox"]';

type El = { focus: () => void; contains: (n: unknown) => boolean; querySelectorAll: (q: string) => ArrayLike<El> } & Record<
  string,
  unknown
>;

/** Inside a menu, the palette or a side panel: focus there is never the place to come back to. */
const OVERLAY = '[role="menu"],[role="dialog"],[aria-modal="true"]';

type Focusable = { focus: () => void; isConnected?: boolean; closest?: (q: string) => unknown };

/** The last control focused outside every menu and dialog, kept up to date from the moment the shell mounts. */
let outside: Focusable | null = null;
let tracking = false;

export function trackFocus() {
  if (tracking || Platform.OS !== 'web' || typeof document === 'undefined') return;
  tracking = true;
  document.addEventListener(
    'focusin',
    (e) => {
      const t = e.target as unknown as Focusable | null;
      if (t && (t as unknown) !== document.body && !t.closest?.(OVERLAY)) outside = t;
    },
    true,
  );
}

/** A dialog (the palette, a side panel, a page's form) is on screen: the page's shortcuts wait until it closes. */
export function dialogOpen(): boolean {
  return typeof document !== 'undefined' && !!document.querySelector('[aria-modal="true"]');
}

/** Where focus was before an overlay opened: the focused control, or (when that is an item in a menu that is
 *  about to close) the control that opened the menu. */
function opener(): Focusable | null {
  const a = document.activeElement as unknown as Focusable | null;
  return a && (a as unknown) !== document.body && !a.closest?.(OVERLAY) ? a : outside;
}

/** Focus goes back to `el` once the overlay closing now has gone, if focus went with it (it is on <body> or still
 *  in a closing overlay). Not when Tab or a click already moved it on, and not while a dialog is open (a menu item
 *  or a palette command that opened a side panel): that dialog keeps focus and hands it back when it closes. */
function giveBack(el: Focusable | null) {
  setTimeout(() => {
    const a = document.activeElement as unknown as Focusable | null;
    const lost = !a || (a as unknown) === document.body || !!a.closest?.(OVERLAY);
    if (lost && el && !dialogOpen() && el.isConnected !== false) el.focus();
  }, 0);
}

/** A popover: its opener gets focus back when it closes. */
export function useReturnFocus(open: boolean) {
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    trackFocus();
    const el = opener();
    return () => giveBack(el);
  }, [open]);
}

/**
 * A dialog in a Modal (the palette, a side panel): pass true from open until the fade-out ends, or mount it with
 * the dialog. Focus goes back once the dialog has left the page, to the control focused before it opened. Done any
 * earlier, the Modal's focus trap pulls it back in and then drops it on <body>, so the next Tab would start at the
 * top of the window.
 */
export function useFocusBack(mounted = true) {
  useEffect(() => {
    if (!mounted || Platform.OS !== 'web' || typeof document === 'undefined') return;
    trackFocus();
    const el = opener();
    return () => giveBack(el);
  }, [mounted]);
}

/**
 * The click-catcher behind a menu or dialog. It has no tabindex at all, not even -1: a Modal's focus trap calls
 * focus() on each node in turn, and a node with tabindex -1 would take it, so the trap would land here instead of
 * on the dialog's first field. Esc and the dialog's own Close button do the same job from the keyboard.
 */
export function Catcher({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return <Pressable style={style} onPress={onPress} {...({ tabIndex: null, 'aria-hidden': true } as object)} />;
}

/** Up/Down/Home/End move focus between the items inside `root` (a web DOM node). */
export function moveFocus(root: El | null, key: string): boolean {
  if (!root || typeof document === 'undefined') return false;
  const items = Array.from(root.querySelectorAll(ITEMS)).filter((n) => !(n as { ariaDisabled?: string }).ariaDisabled);
  if (!items.length) return false;
  const at = items.findIndex((n) => n === (document.activeElement as unknown));
  const next =
    key === 'ArrowDown'
      ? (at + 1) % items.length
      : key === 'ArrowUp'
        ? (at - 1 + items.length) % items.length
        : key === 'Home'
          ? 0
          : key === 'End'
            ? items.length - 1
            : -1;
  if (next < 0) return false;
  items[next].focus();
  return true;
}

export function Popover({
  visible,
  onClose,
  label,
  style,
  width,
  role = 'menu',
  children,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  /** Where it sits in the shell (top and left or right). */
  style: ViewStyle;
  width: number;
  role?: 'menu' | 'dialog';
  children: ReactNode;
}) {
  const { radii, colors } = useTheme();
  const reduced = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  const v = useSharedValue(0);
  const ref = useRef<ComponentRef<typeof View>>(null);
  useReturnFocus(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      v.set(withTiming(1, OPEN));
    } else {
      v.set(
        withTiming(0, CLOSE, (done) => {
          'worklet';
          if (done) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, v]);

  // Focus the first item once it is on screen, so the keyboard can carry on from the opener.
  useEffect(() => {
    if (!visible || !mounted || Platform.OS !== 'web') return;
    const t = setTimeout(() => moveFocus(ref.current as unknown as El, 'Home'), 30);
    return () => clearTimeout(t);
  }, [visible, mounted]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        if (moveFocus(ref.current as unknown as El, e.key)) e.preventDefault();
      } else if (e.key === 'Tab') {
        // Tab leaves the menu and closes it, as a menu does.
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [visible, onClose]);

  const anim = useAnimatedStyle(() => ({
    opacity: v.get(),
    transform: [{ translateY: reduced ? 0 : (1 - v.get()) * 4 }],
  }));
  if (!mounted) return null;
  return (
    <>
      <Catcher style={styles.catcher} onPress={onClose} />
      <Animated.View ref={ref} role={role} aria-label={label} style={[styles.pop, style, { width }, anim]}>
        <Glass tier="sheet" topOnly={false} radius={radii.pane} style={[styles.glass, { boxShadow: colors.material.shadowFloat }]}>
          {children}
        </Glass>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  catcher: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, cursor: 'auto' } as ViewStyle,
  pop: { position: 'absolute', zIndex: 41 },
  glass: { padding: 8 },
});
