// The command palette (Ctrl+K): one sheet-glass dialog, 640 wide and 15% from the top, over the look's dim. A
// labelled field over a list of commands in groups: Go to, Add, Your things (while typing), Look and Do. Up and
// Down move the highlight, Enter runs it, Esc closes and hands focus back. The field is a combobox over the list
// (aria-activedescendant), so focus never leaves it and Tab stays inside the dialog.
import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, type Role, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type Theme, useStyles, useTheme } from '../../theme';
import { Glass } from '../Glass';
import { EASE_OUT, FADE, useReduceMotion } from '../Motion';
import { Catcher, useFocusBack } from './Popover';

const IN = { duration: 180, easing: EASE_OUT, ...FADE };
const OUT = { duration: 140, easing: EASE_OUT, ...FADE };
const ROW = 44;

export type CommandGroup = 'Go to' | 'Add' | 'Your things' | 'Look' | 'Do';
const ORDER: CommandGroup[] = ['Go to', 'Add', 'Your things', 'Look', 'Do'];

export interface Command {
  id: string;
  group: CommandGroup;
  icon: string;
  title: string;
  meta?: string;
  /** A shortcut shown on the right ("Ctrl 1"). */
  hint?: string;
  /** The current look. */
  checked?: boolean;
  /** Extra words the search matches ("home" for Overview). */
  words?: string;
  run: () => void;
}

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** A command matches when every word typed starts a word of its title, meta or extra words, or sits in the title. */
function matches(c: Command, q: string): boolean {
  const hay = norm(`${c.title} ${c.meta ?? ''} ${c.words ?? ''}`);
  const words = hay.split(/[^\p{L}\p{N}]+/u);
  return norm(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => words.some((w) => w.startsWith(t)) || norm(c.title).includes(t));
}

export function Palette({
  visible,
  onClose,
  commands,
  things,
  onInbox,
}: {
  visible: boolean;
  onClose: () => void;
  /** Go to, Add, Look and Do: shown before anything is typed. */
  commands: Command[];
  /** Your things: searched only while typing. */
  things: Command[];
  /** No match: put what was typed in the inbox. */
  onInbox: (text: string) => void;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const window = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const v = useSharedValue(0);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  useFocusBack(mounted);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setQuery('');
      setActive(0);
      v.set(withTiming(1, IN));
      const t = setTimeout(() => input.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    v.set(
      withTiming(0, OUT, (done) => {
        'worklet';
        if (done) scheduleOnRN(setMounted, false);
      }),
    );
  }, [visible, v]);

  const q = query.trim();
  const shown = useMemo(() => {
    const list = q ? [...commands, ...things].filter((c) => matches(c, q)) : commands;
    // Your things are capped so a long library never pushes the rest out of reach.
    let mine = 0;
    return ORDER.flatMap((g) => list.filter((c) => c.group === g)).filter((c) => c.group !== 'Your things' || ++mine <= 8);
  }, [q, commands, things]);
  const none = q.length > 0 && shown.length === 0;
  const rows: Command[] = none
    ? [{ id: 'inbox', group: 'Add', icon: 'file-tray-outline', title: `Add “${q}” to the inbox`, run: () => onInbox(q) }]
    : shown;
  const at = Math.min(active, Math.max(0, rows.length - 1));

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.getElementById(`cmd-${rows[at]?.id}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [at, rows]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    // Let the dialog start closing (and focus go back) before the command opens something of its own.
    setTimeout(c.run, 0);
  };

  const onKey = (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault?.();
      const n = rows.length;
      if (n) setActive((a) => (Math.min(a, n - 1) + (key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (key === 'Home' && !q) setActive(0);
    else if (key === 'End' && !q) setActive(rows.length - 1);
    else if (key === 'Enter') {
      e.preventDefault?.();
      run(rows[at]);
    }
  };

  const dim = useAnimatedStyle(() => ({ opacity: v.get() }));
  const box = useAnimatedStyle(() => ({ opacity: v.get(), transform: [{ scale: reduced ? 1 : 0.98 + 0.02 * v.get() }] }));
  if (!mounted) return null;
  const width = Math.min(640, window.width - 32);
  const listMax = Math.max(220, Math.min(440, window.height * 0.85 - window.height * 0.15 - 120));

  let last: CommandGroup | undefined;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }, dim]}>
          <Catcher style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          role="dialog"
          aria-modal
          aria-label="Search or jump to"
          style={[styles.box, { width, top: Math.round(window.height * 0.15) }, box]}
        >
          <Glass tier="sheet" topOnly={false} radius={radii.hero} style={[styles.glass, { boxShadow: colors.material.shadowFloat }]}>
            <Text nativeID="cmd-label" style={styles.label}>
              Search or jump to
            </Text>
            <View style={styles.field} {...({ dataSet: { ring: 'field' } } as object)}>
              <Ionicons name="search" size={20} color={colors.muted} />
              <TextInput
                ref={input}
                value={query}
                onChangeText={setQuery}
                onKeyPress={onKey as never}
                placeholder="A page, a routine, a word…"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCorrect={false}
                autoCapitalize="none"
                role={'combobox' as Role}
                aria-labelledby="cmd-label"
                aria-expanded
                aria-controls="cmd-list"
                aria-autocomplete="list"
                aria-activedescendant={rows[at] ? `cmd-${rows[at].id}` : undefined}
              />
            </View>
            <ScrollView style={{ maxHeight: listMax }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
              {none ? <Text style={styles.none}>Nothing matches “{q}”.</Text> : null}
              <View nativeID="cmd-list" role={'listbox' as Role} aria-label="Commands">
                {rows.map((c, i) => {
                  const head = !none && c.group !== last;
                  last = c.group;
                  const on = i === at;
                  return (
                    <View key={c.id}>
                      {head ? (
                        <Text style={styles.group} role={'presentation' as Role}>
                          {c.group}
                        </Text>
                      ) : null}
                      <Pressable
                        nativeID={`cmd-${c.id}`}
                        role={'option' as Role}
                        aria-selected={on}
                        focusable={false}
                        onHoverIn={() => setActive(i)}
                        onPress={() => run(c)}
                        style={[styles.row, on && styles.rowOn]}
                        accessibilityLabel={[c.title, c.meta, c.checked ? 'current' : undefined].filter(Boolean).join(', ')}
                      >
                        <View style={styles.pebble}>
                          <Ionicons name={c.icon as 'add'} size={18} color={colors.text} />
                        </View>
                        <Text style={styles.title} numberOfLines={1}>
                          {c.title}
                        </Text>
                        {c.meta ? (
                          <Text style={styles.meta} numberOfLines={1}>
                            {c.meta}
                          </Text>
                        ) : (
                          <View style={styles.flex} />
                        )}
                        {c.checked ? <Ionicons name="checkmark" size={18} color={colors.text} /> : null}
                        {c.hint ? (
                          <View style={styles.kbd}>
                            <Text style={styles.kbdText}>{c.hint}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={styles.foot}>↑ ↓ to move · Enter to run · Esc to close</Text>
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1 },
    box: { position: 'absolute', alignSelf: 'center' },
    glass: { paddingTop: 14, paddingBottom: 10 },
    label: { ...type.label, paddingHorizontal: 20, marginBottom: 8 },
    field: {
      marginHorizontal: 12,
      height: 48,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      ...insetBox,
    },
    input: { flex: 1, height: 46, fontFamily: fonts.body, fontSize: 17, color: colors.text, outlineStyle: 'none' } as never,
    list: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
    none: { ...type.body, color: colors.muted, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
    group: { ...type.label, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
    row: {
      height: ROW,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    rowOn: { backgroundColor: colors.material.hover.fill, borderColor: colors.material.hover.rim },
    pebble: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...insetBox },
    title: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text, flexShrink: 1 },
    meta: { ...type.small, flex: 1, textAlign: 'right' },
    kbd: { height: 24, paddingHorizontal: 7, borderRadius: 7, justifyContent: 'center', ...insetBox },
    kbdText: { ...type.label, fontSize: 13, lineHeight: 16, color: colors.text },
    foot: { ...type.caption, paddingHorizontal: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4 },
  });
};
