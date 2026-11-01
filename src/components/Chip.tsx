import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { FadeSwap, Press, SelectFade } from './Motion';

/** A choice pill. Pressing fades in the press light; choosing it fades the selected fill in over 150ms. */
export function Chip({
  label,
  active,
  onPress,
  accessibilityLabel,
  outerStyle,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  outerStyle?: StyleProp<ViewStyle>;
}) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Press
      onPress={onPress}
      outerStyle={outerStyle}
      style={styles.chip}
      overlay={colors.material.pressFill}
      haptic
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
    >
      <SelectFade on={active} radius={radii.pill} bleed={1} style={styles.chosen} />
      <FadeSwap
        on={active}
        off={<Text style={styles.chipText}>{label}</Text>}
        onContent={<Text style={[styles.chipText, styles.chipTextActive]}>{label}</Text>}
      />
    </Press>
  );
}

/** A small action next to a section title ("Add word", "Share"): a 44-tall pill with an icon. */
export function ActionChip({
  icon,
  label,
  onPress,
  accessibilityLabel,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Press
      onPress={onPress}
      style={styles.chip}
      overlay={colors.material.pressFill}
      haptic
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <View style={styles.action}>
        <Ionicons name={icon as 'add'} size={16} color={colors.link} />
        <Text style={styles.chipText}>{label}</Text>
      </View>
    </Press>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    chip: {
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    chipText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
    chipTextActive: { color: colors.onPrimary },
    chosen: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  });
