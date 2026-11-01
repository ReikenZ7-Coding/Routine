import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Press } from './Motion';

interface Props {
  label: string;
  onPress: () => void;
  /** primary: the filled pill for the one main action. secondary: a glass pill. plain: a text button.
   *  danger: a glass pill in the danger ink, for destructive confirms. */
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  icon?: string;
  /** Draws the label in the danger ink (a plain "Delete" that asks before it acts). */
  destructive?: boolean;
  /** Shows a spinner in place of the icon and ignores presses while work is under way. */
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

/** The look's buttons: 48 tall, a press squeeze and a fading press light, never an instant swap. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  destructive,
  busy,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const ink =
    variant === 'primary'
      ? colors.onPrimary
      : variant === 'danger' || destructive
        ? colors.danger
        : variant === 'plain'
          ? colors.link
          : colors.text;
  const box = variant === 'primary' ? styles.primary : variant === 'plain' ? styles.plain : styles.glass;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || busy}
      outerStyle={style}
      style={[box, (disabled || busy) && styles.dim]}
      overlay={variant === 'plain' ? undefined : colors.material.pressFill}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={busy ? { busy: true } : undefined}
    >
      <View style={styles.row}>
        {busy ? <ActivityIndicator size="small" color={ink} /> : icon ? <Ionicons name={icon as 'add'} size={18} color={ink} /> : null}
        <Text style={[styles.text, { color: ink }]}>{label}</Text>
      </View>
    </Press>
  );
}

const makeStyles = ({ colors, fonts, radii }: Theme) =>
  StyleSheet.create({
    primary: {
      minHeight: 48,
      borderRadius: radii.pill,
      paddingHorizontal: 24,
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    glass: {
      minHeight: 48,
      borderRadius: radii.pill,
      paddingHorizontal: 20,
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    plain: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radii.pill },
    dim: { opacity: 0.6 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    text: { fontFamily: fonts.bodyBold, fontSize: 16 },
  });
