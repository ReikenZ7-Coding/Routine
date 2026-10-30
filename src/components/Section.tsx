import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';

interface Props {
  title: string;
  /** Small colour marker before the title, for the kind of thing in this section. */
  dot?: string;
  right?: ReactNode;
  children: ReactNode;
}

export function Section({ title, dot, right, children }: Props) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
          <Text style={type.sectionTitle}>{title}</Text>
        </View>
        {right}
      </View>
      <Glass style={styles.card}>{children}</Glass>
    </View>
  );
}

export function Divider({ inset = 52 }: { inset?: number }) {
  const styles = useStyles(makeStyles);
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
  wrap: { marginTop: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
