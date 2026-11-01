import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Glass } from './Glass';
import { Enter } from './Motion';

interface Props {
  title: string;
  /** Small colour marker before the title, for the kind of thing in this section. */
  dot?: string;
  right?: ReactNode;
  /** A how-to line at the foot of the card, on the glass rather than the bare world. */
  footer?: string;
  /** Its place in the screen's first-mount entrance (none: no entrance). */
  enter?: number;
  children: ReactNode;
}

export function Section({ title, dot, right, footer, enter, children }: Props) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  const body = (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
          <Text style={[type.sectionTitle, styles.title]} accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right}
      </View>
      <Glass>
        {children}
        {footer ? (
          <View style={styles.footer}>
            <Text style={type.hint}>{footer}</Text>
          </View>
        ) : null}
      </Glass>
    </View>
  );
  return enter === undefined ? body : <Enter index={enter}>{body}</Enter>;
}

/** A how-to line on its own small pane, for screens whose content is not one card. */
export function HintPane({ children }: { children: string }) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Glass style={styles.pane}>
      <Text style={type.hint}>{children}</Text>
    </Glass>
  );
}

/** What a search shows when nothing matches: says so, quotes the search, and offers to clear it. */
export function NoMatch({ query, onClear }: { query: string; onClear?: () => void }) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Glass style={styles.noMatch}>
      <Ionicons name="search-outline" size={28} color={colors.muted} />
      <Text style={[type.body, styles.noMatchText]}>Nothing matches “{query.trim()}”</Text>
      {onClear ? <Button label="Clear search" variant="plain" onPress={onClear} /> : null}
    </Glass>
  );
}

export function Divider({ inset = 52 }: { inset?: number }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrap: { marginTop: 28 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
      marginBottom: 6,
      paddingHorizontal: 2,
      gap: 12,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
    title: { flexShrink: 1 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pane: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 12 },
    noMatch: { marginTop: 16, alignItems: 'center', paddingTop: 24, paddingBottom: 8, paddingHorizontal: 16, gap: 8 },
    noMatchText: { textAlign: 'center' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  });
