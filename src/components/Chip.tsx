import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && !active && styles.pressed]}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontSize: 14, fontFamily: fonts.bodyMedium },
  chipTextActive: { color: '#fff' },
});
