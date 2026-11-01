import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../theme';
import { Canopy } from './Canopy';

/**
 * A screen's title: on the page looks a hub header with a subtitle and a count badge. On Pine it sits on the
 * canopy slab, with anything passed as children (Library's segmented switch) on the slab under it.
 */
export function PageTitle({
  title,
  subtitle,
  badge,
  bleed = 16,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  /** Pine: the scroll content's padding above the title, which the canopy slab covers. */
  bleed?: number;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const head = (
    <View style={[styles.wrap, !colors.material.canopy && { marginTop: insets.top }]}>
      <View style={styles.flex}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
  if (colors.material.canopy) {
    return (
      <Canopy bleed={bleed} style={styles.slab}>
        {head}
        {children}
      </Canopy>
    );
  }
  return (
    <>
      {head}
      {children}
    </>
  );
}

const makeStyles = ({ type, colors, fonts, name }: Theme) => {
  const canopy = colors.material.canopy;
  return StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: canopy ? 0 : 16, marginTop: canopy ? 0 : 4 },
    slab: { gap: 16 },
    flex: { flex: 1 },
    title: type.title,
    subtitle: {
      fontFamily: fonts.body,
      fontSize: name === 'stone' ? 15 : 14,
      lineHeight: name === 'stone' ? 20 : 19,
      // On the canopy slab secondary text is onSlabMuted (plain muted fails on the slab's teal).
      color: colors.onSlabMuted,
      marginTop: name === 'stone' ? 4 : 2,
    },
    badge: canopy
      ? {
          // a dark pill with a mint rim on the slab, its count in mint
          borderRadius: 999,
          paddingHorizontal: 12,
          minHeight: 30,
          justifyContent: 'center',
          backgroundColor: canopy.badge,
          borderWidth: 1,
          borderColor: colors.litRim,
        }
      : {
          borderRadius: 999,
          paddingHorizontal: 12,
          minHeight: name === 'paper' ? 32 : 30,
          justifyContent: 'center',
          backgroundColor: colors.material.inset.fill,
          borderWidth: 1,
          borderColor: colors.material.inset.border,
          borderTopColor: colors.material.inset.borderTop,
        },
    badgeText: {
      ...type.badge,
      ...(name === 'paper' ? { fontSize: 13 } : null),
      color: canopy ? colors.accent : colors.text,
      fontVariant: ['tabular-nums'],
    },
  });
};
