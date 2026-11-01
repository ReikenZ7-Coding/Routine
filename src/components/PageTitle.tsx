import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles } from '../theme';

/** A screen's title on its backdrop: on the page looks a hub header with a subtitle and a count badge. */
export function PageTitle({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { marginTop: insets.top }]}>
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
}

const makeStyles = ({ type, colors, fonts, name }: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 4 },
    flex: { flex: 1 },
    title: type.title,
    subtitle: {
      fontFamily: fonts.body,
      fontSize: name === 'stone' ? 15 : 14,
      lineHeight: name === 'stone' ? 20 : 19,
      color: colors.muted,
      marginTop: name === 'stone' ? 4 : 2,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      minHeight: name === 'paper' ? 32 : 30,
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    badgeText: { ...type.badge, ...(name === 'paper' ? { fontSize: 13 } : null), color: colors.text, fontVariant: ['tabular-nums'] },
  });
