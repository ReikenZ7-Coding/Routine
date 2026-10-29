import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  done: boolean;
  /** Colour of the tick box when done. */
  tint?: string;
  /** Right-aligned detail, e.g. a time. */
  meta?: string;
  disabled?: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}

export function CheckRow({ title, subtitle, done, tint = colors.text, meta, disabled, onToggle, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
    >
      <View
        style={[
          styles.box,
          done && { backgroundColor: tint, borderColor: tint },
          disabled && !done && styles.boxDisabled,
        ]}
      >
        {done && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      <View style={styles.text}>
        <Text style={[type.bodyMedium, done && styles.doneTitle]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  pressed: { backgroundColor: colors.primarySoft },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDisabled: { borderStyle: 'dashed' },
  text: { flex: 1, gap: 1 },
  doneTitle: { color: colors.faint, textDecorationLine: 'line-through' },
  meta: { ...type.small, fontFamily: type.num.fontFamily },
});
