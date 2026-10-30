import { Pressable, StyleSheet, Text } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && styles.pressed]}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.selected, borderColor: colors.selected },
  pressed: { backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  chipTextActive: { color: colors.onSelected },
});
