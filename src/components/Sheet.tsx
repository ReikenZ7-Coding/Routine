// The bottom sheet every panel and form uses: thick sheet glass lying on the dimmed world, rising on the UI
// thread and leaving the same way before it unmounts.
//
// - One sheet at a time. When one panel hands over to another (Add -> New routine, Settings -> Backup), the next
//   waits until the first has left, and the dim stays up between them, so two Android dialog windows never
//   animate at once and the world never flashes undimmed.
// - The lens follows the sheet: its resting top comes from onLayout and its motion (the slide, a drag, the
//   keyboard lift) is fed to the glass as scroll, so the blurred world inside lines up at every frame.
// - The keyboard: the sheet lifts by as much as there is room above it, and the rest shrinks the scroll.
// - Reduced motion: the sheet fades in and out instead of sliding; the dim always fades.
import { type ComponentRef, createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Glass, GlassScrollContext } from './Glass';
import { useKeyboardHeight } from './glass/keyboard';
import { EASE_OUT, FADE, useReduceMotion } from './Motion';

const SHEET_IN = { duration: 320, easing: Easing.bezier(0.32, 0.72, 0, 1) };
const SHEET_OUT = { duration: 220, easing: EASE_OUT };
const DIM = { duration: 200, easing: EASE_OUT, ...FADE };
/** How far a drag on the grip has to travel (or how fast) to dismiss. */
const DISMISS_DRAG = 96;
const DISMISS_VELOCITY = 0.9;

// The host: which sheet is on screen, and who waits for it to leave.
type Start = (handoff: boolean) => void;
const host = {
  active: null as number | null,
  queue: [] as { id: number; start: Start }[],
  request(id: number, start: Start) {
    if (host.active === null) {
      host.active = id;
      start(false);
    } else if (host.active !== id && !host.queue.some((q) => q.id === id)) host.queue.push({ id, start });
  },
  cancel(id: number) {
    host.queue = host.queue.filter((q) => q.id !== id);
  },
  waiting: () => host.queue.length > 0,
  release(id: number) {
    if (host.active !== id) return;
    host.active = null;
    const next = host.queue.shift();
    if (next) {
      host.active = next.id;
      next.start(true);
    }
  },
};
let nextId = 0;

type Phase = 'hidden' | 'waiting' | 'shown' | 'closing';

interface SheetControls {
  /** Scrolls so `node` sits near the top of the sheet (an inline error); several calls in one tick go to the
   *  highest of them. */
  reveal: (node: ComponentRef<typeof View> | null) => void;
  /** Scrolls to the end (a confirm that opened under the fold). */
  revealEnd: () => void;
}
const SheetContext = createContext<SheetControls | null>(null);
/** The sheet a field sits in, if any. */
export const useSheet = () => useContext(SheetContext);
/** Room left above a revealed node, so its label and input show too. */
const REVEAL_MARGIN = 96;

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet for panels and forms. Children stay mounted while it leaves. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const id = useRef(0);
  if (!id.current) id.current = ++nextId;
  const phase = useRef<Phase>('hidden');
  const [shown, setShown] = useState<{ handoff: boolean } | null>(null);
  const [closing, setClosing] = useState<{ handoff: boolean } | null>(null);

  useEffect(() => {
    const me = id.current;
    if (visible) {
      if (phase.current === 'closing') {
        phase.current = 'shown';
        setClosing(null);
      } else if (phase.current === 'hidden') {
        phase.current = 'waiting';
        host.request(me, (handoff) => {
          phase.current = 'shown';
          setClosing(null);
          setShown({ handoff });
        });
      }
    } else if (phase.current === 'waiting') {
      host.cancel(me);
      phase.current = 'hidden';
    } else if (phase.current === 'shown') {
      phase.current = 'closing';
      // The panel that replaces this one asks for the host in the same commit; wait for its effect to run.
      queueMicrotask(() => {
        if (phase.current === 'closing') setClosing({ handoff: host.waiting() });
      });
    }
  }, [visible]);

  useEffect(
    () => () => {
      host.cancel(id.current);
      host.release(id.current);
    },
    [],
  );

  const onExited = useCallback(() => {
    if (phase.current !== 'closing') return;
    phase.current = 'hidden';
    setShown(null);
    setClosing(null);
    host.release(id.current);
  }, []);

  if (!shown) return null;
  return (
    <SheetPanel title={title} onClose={onClose} handoff={shown.handoff} closing={closing} onExited={onExited}>
      {children}
    </SheetPanel>
  );
}

function SheetPanel({
  title,
  onClose,
  handoff,
  closing,
  onExited,
  children,
}: {
  title: string;
  onClose: () => void;
  handoff: boolean;
  closing: { handoff: boolean } | null;
  onExited: () => void;
  children: ReactNode;
}) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const reduced = useReduceMotion();

  const dim = useSharedValue(handoff ? 1 : 0);
  /** The slide: how far below its resting place the sheet is. */
  const travel = useSharedValue(windowH);
  /** A drag on the grip. */
  const drag = useSharedValue(0);
  const fade = useSharedValue(reduced ? 0 : 1);
  const restX = useSharedValue(0);
  const restY = useSharedValue(windowH);
  /** Room above the resting sheet, which the keyboard lift may use. */
  const room = useSharedValue(0);
  const zero = useSharedValue(0);
  const height = useRef(0);
  const entered = useRef(false);
  const keyboard = useKeyboardHeight();

  const lift = useDerivedValue(() => Math.min(keyboard.get(), room.get()));
  const offset = useDerivedValue(() => travel.get() + drag.get() - lift.get());
  // Glass reads scroll as "content moved up by"; the sheet moving down by `offset` is a scroll of -offset.
  const lensScroll = useDerivedValue(() => -offset.get());
  const scroll = useMemo(() => ({ scrollX: zero, scrollY: lensScroll }), [zero, lensScroll]);
  const anchor = useMemo(() => ({ x: restX, y: restY }), [restX, restY]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const contentRef = useRef<ComponentRef<typeof View>>(null);
  const pendingTop = useRef<number | null>(null);
  const controls = useMemo<SheetControls>(
    () => ({
      reveal: (node) => {
        const content = contentRef.current;
        if (!node || !content) return;
        node.measureLayout(
          content,
          (_x: number, y: number) => {
            const top = Math.max(0, y - REVEAL_MARGIN);
            const first = pendingTop.current === null;
            pendingTop.current = first ? top : Math.min(pendingTop.current!, top);
            if (first)
              setTimeout(() => {
                if (pendingTop.current !== null) scrollRef.current?.scrollTo({ y: pendingTop.current, animated: !reduced });
                pendingTop.current = null;
              }, 0);
          },
          () => {},
        );
      },
      revealEnd: () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !reduced }), 60),
    }),
    [reduced],
  );

  const enter = useCallback(() => {
    dim.set(withTiming(1, DIM));
    if (reduced) {
      travel.set(0);
      fade.set(withTiming(1, DIM));
    } else {
      fade.set(1);
      travel.set(withTiming(0, SHEET_IN));
    }
  }, [reduced, dim, travel, fade]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    height.current = h;
    restY.set(y);
    room.set(Math.max(0, y - insets.top - 12));
    if (entered.current) return;
    entered.current = true;
    if (reduced) return enter();
    dim.set(withTiming(1, DIM));
    // Start exactly one sheet-height down, so the slide covers only the distance it shows.
    scheduleOnUI(() => {
      'worklet';
      travel.set(h + 24);
      travel.set(withTiming(0, SHEET_IN));
    });
  };

  useEffect(() => {
    if (!closing) {
      // Reopened while leaving: come back from wherever it is.
      if (entered.current) enter();
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onExited);
    };
    dim.set(withTiming(closing.handoff ? 1 : 0, DIM));
    if (reduced) {
      fade.set(withTiming(0, DIM, done));
      return;
    }
    const away = height.current + 24;
    scheduleOnUI(() => {
      'worklet';
      travel.set(travel.get() + drag.get());
      drag.set(0);
      travel.set(withTiming(away, SHEET_OUT, done));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => drag.set(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DRAG || g.vy > DISMISS_VELOCITY) closeRef.current();
          else drag.set(withTiming(0, SHEET_OUT));
        },
        onPanResponderTerminate: () => drag.set(withTiming(0, SHEET_OUT)),
      }),
    [drag],
  );

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));
  const panelStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: offset.get() }] }));
  const spacer = useAnimatedStyle(() => ({ height: Math.max(0, keyboard.get() - room.get()) }));

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          onLayout={onLayout}
          accessibilityViewIsModal
          style={[styles.panel, { maxHeight: windowH - insets.top - 12 }, panelStyle]}
        >
          <GlassScrollContext.Provider value={scroll}>
            <Glass tier="sheet" anchor={anchor} style={styles.sheet}>
              <View {...pan.panHandlers} style={styles.handle}>
                <View style={styles.grip} />
              </View>
              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]}
              >
                <View ref={contentRef}>
                  <Text style={[type.sheetTitle, styles.heading]} accessibilityRole="header">
                    {title}
                  </Text>
                  <SheetContext.Provider value={controls}>{children}</SheetContext.Provider>
                </View>
              </ScrollView>
              <Animated.View style={spacer} />
            </Glass>
          </GlassScrollContext.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ASK_IN = FadeIn.duration(200).easing(EASE_OUT);
const ASK_OUT = FadeOut.duration(140).easing(EASE_OUT);
const GROW = LinearTransition.duration(240).easing(EASE_OUT);

/**
 * A destructive action that asks inside the sheet before it acts: the button gives way to the question and
 * two 48-tall answers, keep or delete. Nothing is deleted on the first tap, and no system dialog breaks the look.
 */
export function ConfirmDelete({
  label,
  question,
  confirmLabel = 'Delete',
  onConfirm,
}: {
  label: string;
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const styles = useStyles(makeStyles);
  const sheet = useSheet();
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (asking) sheet?.revealEnd();
  }, [asking, sheet]);
  return (
    <Animated.View layout={GROW} style={styles.confirm}>
      {asking ? (
        <Animated.View key="ask" entering={ASK_IN} exiting={ASK_OUT} style={styles.ask}>
          <Text style={styles.question} accessibilityLiveRegion="polite">
            {question}
          </Text>
          <View style={styles.answers}>
            <Button label="Keep it" variant="secondary" onPress={() => setAsking(false)} style={styles.answer} />
            <Button label={confirmLabel} variant="danger" icon="trash-outline" onPress={onConfirm} style={styles.answer} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="idle" entering={ASK_IN} exiting={ASK_OUT}>
          <Button
            label={label}
            variant="plain"
            destructive
            icon="trash-outline"
            onPress={() => setAsking(true)}
            accessibilityHint="Asks before deleting"
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    dim: { backgroundColor: colors.backdrop },
    panel: { flexShrink: 1 },
    sheet: { flexShrink: 1 },
    handle: { alignItems: 'center', justifyContent: 'center', height: 24 },
    grip: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.material.sheet.grip },
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { paddingHorizontal: 20 },
    heading: { marginBottom: 4 },
    confirm: { marginTop: 8 },
    ask: { gap: 12, paddingVertical: 8 },
    question: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
    answers: { flexDirection: 'row', gap: 10 },
    answer: { flex: 1 },
  });
