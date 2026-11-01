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

const makeStyles = ({ type, colors, fonts, glass }: Theme) =>
  StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 4 },
    flex: { flex: 1 },
    title: type.title,
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 2 },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 12,
      minHeight: 30,
      justifyContent: 'center',
      backgroundColor: glass ? colors.chip : colors.primarySoft,
      borderWidth: 1,
      borderColor: glass ? colors.cardBorder : colors.accent + '55',
    },
    badgeText: { fontFamily: fonts.monoMedium, fontSize: 13, color: glass ? colors.text : colors.accent },
  });
