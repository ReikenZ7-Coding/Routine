// Popovers and menus on the desktop: sheet glass with every corner rounded, the float shadow, opening with a
// 160 ms fade and a 4 dp rise and closing in 120 ms (fade only under reduced motion). A click outside closes it;
// Esc closes it and hands focus back to whatever opened it; Up and Down move between its items, Home and End jump.
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
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

/** Keyboard focus that came in from outside, to hand back on close. */
export function useReturnFocus(open: boolean) {
  const opener = useRef<El | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (open) opener.current = document.activeElement as unknown as El;
    else if (opener.current) {
      const el = opener.current;
      opener.current = null;
      setTimeout(() => el.focus?.(), 0);
    }
  }, [open]);
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
      <Pressable style={styles.catcher} onPress={onClose} accessible={false} focusable={false} />
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
