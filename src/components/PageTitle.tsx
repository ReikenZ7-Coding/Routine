import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../theme';
import { CANOPY_GAP, Canopy } from './Canopy';

/** The title starts this far below the scroll content's top padding and the safe area, in every look. */
const TOP = 4;
/** Space under the header inside Pine's slab; with the slab's own gap under its foot it is the space between the
 *  header and what follows it, the same in every look. */
const FOOT = 8;
/** The slab's 1px rim along its foot, which takes its share of that space. */
const SLAB_RIM = 1;
/** Space between the title block and anything passed as children (Library's segmented switch). */
const GAP = 16;

/**
 * A screen's title, the same in every look: the title, a subtitle under it and an optional count badge on the
 * right, then anything passed as children (Library's segmented switch). On Pine the canopy slab is drawn behind
 * it as header art; its padding takes the place of the margins, so everything lands in the same place.
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
  /** The scroll content's padding above the title (the slab covers it, to start flush with the top). */
  bleed?: number;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const head = (
    <View style={styles.wrap}>
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
      <Canopy bleed={bleed} style={[styles.box, { paddingTop: bleed + insets.top + TOP, paddingBottom: FOOT - SLAB_RIM }]}>
        {head}
        {children}
      </Canopy>
    );
  }
  return (
    <View style={[styles.box, styles.bare, { marginTop: insets.top + TOP }]}>
      {head}
      {children}
    </View>
  );
}

const makeStyles = ({ type, colors, fonts }: Theme) => {
  const canopy = colors.material.canopy;
  return StyleSheet.create({
    box: { gap: GAP },
    bare: { marginBottom: FOOT + CANOPY_GAP },
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    flex: { flex: 1 },
    title: type.title,
    // On the canopy slab secondary text is onSlabMuted (plain muted fails on the slab's teal); elsewhere they match.
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.onSlabMuted, marginTop: 2 },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      minHeight: 30,
      justifyContent: 'center',
      borderWidth: 1,
      // On the slab: a dark pill with a mint rim. Elsewhere: an inset of the look's glass.
      backgroundColor: canopy ? canopy.badge : colors.material.inset.fill,
      borderColor: canopy ? colors.litRim : colors.material.inset.border,
      borderTopColor: canopy ? colors.litRim : colors.material.inset.borderTop,
    },
    badgeText: { ...type.badge, fontSize: 13, color: canopy ? colors.accent : colors.text, fontVariant: ['tabular-nums'] },
  });
};
