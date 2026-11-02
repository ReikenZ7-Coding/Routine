// A desktop page: the header (title, a sentence of facts, secondary actions on the right) over a 12-column grid,
// in one scroll that the glass inside follows. Panels are pane glass with a header row; a panel narrower than
// 280 dp takes the whole row. The first six panels rise in on arrival, 40 ms apart, once per visit.
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, createContext, useContext, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { type Theme, useStyles, useTheme } from '../../theme';
import { Glass, GlassScroll } from '../Glass';
import { Enter } from '../Motion';
import { Hover } from './Hover';
import { SHELL, useShellMetrics } from './layout';

/** The grid's measure: its width and the gutter, for spans. */
const GridContext = createContext<{ width: number; gutter: number }>({ width: 0, gutter: 20 });

/** The width of a span of the 12-column grid; a span under 280 dp takes the whole row. */
export function useSpan(span: number): number {
  const { width, gutter } = useContext(GridContext);
  if (!width) return 0;
  const col = (width - 11 * gutter) / 12;
  const w = span * col + (span - 1) * gutter;
  return w < 280 ? width : w;
}

export function Page({
  title,
  subtitle,
  actions,
  label,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
  /** The page's name for assistive tech, when the title is a greeting. */
  label?: string;
  children: ReactNode;
}) {
  const m = useShellMetrics();
  const styles = useStyles(makeStyles);
  const { type } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth((was) => (Math.abs(was - w) < 1 ? was : w));
  };
  return (
    <GlassScroll style={styles.flex} contentContainerStyle={[styles.scroll, { paddingHorizontal: m.pad, paddingTop: 12 }]}>
      <View style={[styles.measure, { maxWidth: SHELL.contentMax }]} onLayout={onLayout} aria-label={label}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text role="heading" aria-level={1} style={[type.title, { fontSize: m.titleSize, lineHeight: m.titleLine }]} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        <GridContext.Provider value={{ width, gutter: m.gutter }}>
          <View style={{ gap: m.gutter }}>{width ? children : null}</View>
        </GridContext.Provider>
      </View>
    </GlassScroll>
  );
}

/** One row of the grid: its panels' tops line up; with `match`, they share the tallest one's height. */
export function Row({ match, children }: { match?: boolean; children: ReactNode }) {
  const m = useShellMetrics();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: m.gutter, alignItems: match ? 'stretch' : 'flex-start' }}>{children}</View>
  );
}

/** A figure inside a subtitle: body medium in the text ink. */
export function Fig({ children }: { children: ReactNode }) {
  const { fonts, colors } = useTheme();
  return <Text style={{ fontFamily: fonts.bodyMedium, color: colors.text }}>{children}</Text>;
}

export function Panel({
  span,
  index,
  title,
  subtitle,
  right,
  tier = 'pane',
  bloom,
  style,
  children,
}: {
  span: number;
  /** Arrival order on the page. */
  index: number;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  tier?: 'pane' | 'hero';
  bloom?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const width = useSpan(span);
  const m = useShellMetrics();
  const styles = useStyles(makeStyles);
  const { type } = useTheme();
  return (
    <Enter index={index} style={{ width }}>
      <Glass tier={tier} bloom={bloom} style={[{ padding: m.panelPad, flexGrow: 1 }, style]}>
        {title ? (
          <View style={styles.panelHead}>
            <View style={styles.flex}>
              <Text role="heading" aria-level={2} style={type.sectionTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={type.small} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {right}
          </View>
        ) : null}
        {children}
      </Glass>
    </Enter>
  );
}

/** A 40 dp glass button for page and panel actions (secondary: the top bar's New is the primary action). */
export function GlassButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Glass tier="control" radius={radii.pill} onPress={onPress} style={styles.button} accessibilityLabel={accessibilityLabel ?? label}>
      {icon ? <Ionicons name={icon as 'add'} size={18} color={colors.text} /> : null}
      <Text style={styles.buttonText}>{label}</Text>
    </Glass>
  );
}

/** A 36 dp round "open" button on a panel's header ("Open Gym"). */
export function OpenButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Hover onPress={onPress} squeeze style={styles.open} accessibilityLabel={label}>
      <Ionicons name="arrow-forward" size={18} color={colors.text} />
    </Hover>
  );
}

/** A text link at the foot of a panel ("Open today · 5 more"). */
export function FootLink({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Hover onPress={onPress} role="link" style={styles.foot} radius={10} accessibilityLabel={accessibilityLabel ?? label}>
      <Text style={styles.footText}>{label}</Text>
      <Ionicons name="arrow-forward" size={16} color={colors.link} />
    </Hover>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    scroll: { paddingBottom: 40, alignItems: 'center' },
    measure: { width: '100%' },
    header: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 24 },
    subtitle: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.onSlabMuted, marginTop: 6 },
    actions: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, minHeight: 36 },
    button: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
    buttonText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    open: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    foot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 8,
      marginLeft: -8,
      marginTop: 8,
    },
    footText: { ...type.link, textDecorationLine: 'none', fontSize: 15 },
  });
};
