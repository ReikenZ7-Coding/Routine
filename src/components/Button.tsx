import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
}

/** Ink pill for the main action, plain text for secondary ones. */
export function Button({ label, onPress, variant = 'primary', style }: Props) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'primary' ? styles.primary : styles.plain,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={
          variant === 'primary' ? type.button : [styles.plainText, variant === 'danger' && { color: colors.danger }]
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button"
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityLabel={label}
    >
      <Ionicons name="add" size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  plain: { paddingVertical: 14, alignItems: 'center' },
  plainText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  pressed: { opacity: 0.75 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
