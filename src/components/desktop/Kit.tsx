// Small pieces every desktop page shares: the 40 dp inset pebble, the tick ring in its 40 dp target, round icon
// buttons, inline pill actions, group headers, filter chips at desktop size, the labelled search field and the
// page-level keyboard shortcuts. Each pressable is a Hover (the hover light under the pointer and under keyboard
// focus, the global focus ring on top), and each draws only from the look's tokens.
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { type Theme, useStyles, useTheme } from '../../theme';
import { Glass, OnCanopy } from '../Glass';
import { EASE_OUT, FADE, FadeSwap, Pop, SelectFade } from '../Motion';
import { Hover } from './Hover';
import { dialogOpen } from './Popover';

/**
 * A tooltip's or hover light's life: `value` fades in over 120 ms; when it turns to null, the last value stays
 * drawn while it fades out over 160 ms, then goes. Returns what to draw (null once gone) and its opacity style.
 * Pass a string (an id or the label itself), so a re-render with the same value changes nothing.
 */
export function useFade(value: string | null) {
  const v = useSharedValue(value ? 1 : 0);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (value) {
      setShown(value);
      v.set(withTiming(1, { duration: 120, easing: EASE_OUT, ...FADE }));
    } else
      v.set(
        withTiming(0, { duration: 160, easing: EASE_OUT, ...FADE }, (done) => {
          'worklet';
          if (done) scheduleOnRN(setShown, null);
        }),
      );
  }, [v, value]);
  const style = useAnimatedStyle(() => ({ opacity: v.get() }));
  return [shown, style] as const;
}

type IconName = keyof typeof Ionicons.glyphMap;

/** The kind's glyph in a 40 dp inset tile. */
export function Pebble({ icon, ink, dim, dashed }: { icon: string; ink: string; dim?: boolean; dashed?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.pebble, dim && styles.dim, dashed && styles.dashed]}>
      <Ionicons name={icon as IconName} size={20} color={ink} />
    </View>
  );
}

/**
 * The tick ring: 26 dp in a 40 dp target. Done fills it with the kind's colour and a check; a counter shows a plus
 * (or its count) until it reaches its target. A checkbox to assistive tech, a button when it counts up.
 */
export function Tick({
  done,
  color,
  label,
  onPress,
  disabled,
  adds,
  square,
}: {
  done: boolean;
  color: string;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** A counter that adds one per press: a plus until done. */
  adds?: boolean;
  /** The inbox and shopping list's square box instead of the ring. */
  square?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const r = square ? 8 : 13;
  return (
    <Hover
      onPress={onPress}
      disabled={disabled}
      style={styles.tickHit}
      radius={20}
      role={adds ? 'button' : 'checkbox'}
      aria={adds ? undefined : { 'aria-checked': done }}
      accessibilityLabel={label}
    >
      <Pop done={done} style={[styles.tick, { borderRadius: r }, square && styles.box, disabled && styles.dashed]}>
        <SelectFade on={done} color={color} radius={r} bleed={2} />
        <FadeSwap
          on={done}
          off={adds ? <Ionicons name="add" size={16} color={colors.text} /> : null}
          onContent={<Ionicons name="checkmark" size={15} color={colors.onKind} />}
        />
      </Pop>
    </Hover>
  );
}

/** A round 40 dp (or 36) inset button with one glyph, labelled for assistive tech. */
export function IconButton({
  icon,
  label,
  onPress,
  size = 40,
  bare,
  disabled,
  aria,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  size?: number;
  /** No inset disc: a bare glyph that lights up under the pointer (row "more" buttons). */
  bare?: boolean;
  disabled?: boolean;
  aria?: Record<string, string | boolean | undefined>;
  color?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  // On Pine's slab (a page header's actions) the disc is a slab trough, like the glass buttons beside it.
  const slab = useContext(OnCanopy) ? colors.material.canopy?.inset : undefined;
  const disc = slab
    ? { backgroundColor: slab.fill, borderWidth: 1, borderColor: slab.border, borderTopColor: slab.borderTop }
    : styles.insetBox;
  return (
    <Hover
      onPress={onPress}
      disabled={disabled}
      squeeze={!bare}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2 }, !bare && disc, disabled && styles.off]}
      accessibilityLabel={label}
      aria={aria}
    >
      <Ionicons name={icon as IconName} size={18} color={color ?? colors.text} />
    </Hover>
  );
}

/** A 36 dp inset pill: inline actions under a row ("Today", "Tomorrow", "Rename"), chips that act. */
export function Pill({
  label,
  icon,
  onPress,
  active,
  danger,
  accessibilityLabel,
  role,
  aria,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  /** The chosen one of a set: filled with the primary, like the phone's chips. */
  active?: boolean;
  danger?: boolean;
  accessibilityLabel?: string;
  role?: 'button' | 'radio' | 'menuitem' | 'link';
  aria?: Record<string, string | boolean | undefined>;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const ink = active ? colors.onPrimary : danger ? colors.danger : colors.text;
  return (
    <Hover
      onPress={onPress}
      squeeze
      style={[styles.pill, styles.insetBox]}
      radius={18}
      role={role}
      aria={role === 'radio' ? { 'aria-checked': !!active, ...aria } : aria}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <SelectFade on={!!active} radius={radii.pill} bleed={1} style={styles.chosen} />
      {icon ? (
        <Ionicons name={icon as IconName} size={16} color={active ? colors.onPrimary : danger ? colors.danger : colors.link} />
      ) : null}
      <Text style={[styles.pillText, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </Hover>
  );
}

/** A row of choice chips with a caption (When, Repeat): the phone's filter row at desktop size, as a radio group. */
export function ChipRow<K extends string>({
  caption,
  options,
  value,
  onChange,
}: {
  caption: string;
  options: { key: K; label: string; icon?: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.chipRow} role="radiogroup" aria-label={caption}>
      <Text style={styles.caption}>{caption}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Pill key={o.key} label={o.label} icon={o.icon} active={o.key === value} onPress={() => onChange(o.key)} role="radio" />
        ))}
      </View>
    </View>
  );
}

/** A group header inside a panel: the label face on the left, a quiet summary on the right. 36 dp tall. */
export function GroupHead({ label, right, first }: { label: string; right?: string; first?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.group, first && styles.groupFirst]}>
      <Text style={styles.groupLabel} role="heading" aria-level={3}>
        {label}
      </Text>
      {right ? <Text style={styles.groupRight}>{right}</Text> : null}
    </View>
  );
}

/** A panel's honest empty line. */
export function Empty({ children }: { children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.empty}>{children}</Text>;
}

/** A labelled search field in control glass (the label is visible above it; the placeholder is only an example). */
export function SearchField({
  id,
  label,
  value,
  onChange,
  placeholder,
  width = 360,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  /** 360 dp in a toolbar; '100%' inside a panel. */
  width?: number | '100%';
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={{ width }}>
      <Text style={styles.caption} nativeID={`${id}-label`}>
        {label}
      </Text>
      <Glass tier="control" radius={radii.pill} style={styles.search}>
        <View style={styles.searchRing} {...({ dataSet: { ring: 'field' } } as object)}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            selectionColor={colors.link}
            cursorColor={colors.text}
            returnKeyType="search"
            accessibilityLabel={label}
            accessibilityLabelledBy={`${id}-label`}
          />
          {value ? <IconButton icon="close" label="Clear search" onPress={() => onChange('')} size={32} bare /> : null}
        </View>
      </Glass>
    </View>
  );
}

/**
 * Keyboard shortcuts that belong to one page (Ctrl+[ and Ctrl+] for the previous and next day or week), live only
 * while the page is the one on screen. Never a single letter, so nothing fires while typing.
 */
export function usePageKeys(keys: Record<string, () => void>) {
  const focused = useIsFocused();
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    if (!focused || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || dialogOpen()) return;
      const run = latest.current[e.key];
      if (run) {
        e.preventDefault();
        run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focused]);
}

/** Shared text styles for desktop rows. */
export const useRowText = () => useStyles(makeStyles);

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    insetBox,
    off: { opacity: 0.45 },
    pebble: { width: 40, height: 40, borderRadius: radii.inset, alignItems: 'center', justifyContent: 'center', ...insetBox },
    dim: { opacity: 0.6 },
    dashed: { borderStyle: 'dashed', borderColor: colors.controlBorder },
    tickHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    tick: { width: 26, height: 26, borderWidth: 2, borderColor: colors.controlBorder, alignItems: 'center', justifyContent: 'center' },
    box: { width: 24, height: 24, borderWidth: 1.75 },
    round: { alignItems: 'center', justifyContent: 'center' },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18 },
    pillText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
    chosen: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    chipRow: { gap: 8 },
    caption: { ...type.label, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    group: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, marginTop: 12, gap: 12 },
    groupFirst: { marginTop: 0 },
    groupLabel: { ...type.label },
    groupRight: { ...type.caption, color: colors.muted, fontVariant: ['tabular-nums'] },
    empty: { ...type.body, color: colors.muted },
    search: { height: 44, justifyContent: 'center' },
    searchRing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 6, height: 42, borderRadius: 22 },
    searchInput: { flex: 1, position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, height: 40 },
    // Row text, shared by every page.
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowMeta: { ...type.small },
    struck: { textDecorationLine: 'line-through', color: colors.faint },
  });
};
