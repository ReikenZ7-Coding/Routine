import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  done: boolean;
  /** Colour of the tick box when done. */
  tint?: string;
  /** Right-aligned detail, e.g. a time. */
  meta?: string;
  disabled?: boolean;
  /** Counter progress, shown in the box until the target is reached. */
  count?: { value: number; target: number };
  /** Deliberately skipped today. */
  skipped?: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}

export function CheckRow({ title, subtitle, done, tint: tintProp, meta, disabled, count, skipped, onToggle, onLongPress }: Props) {
  const { colors, type } = useTheme();
  const tint = tintProp ?? colors.text;
  const styles = useStyles(makeStyles);
  const partial = !done && !!count && count.value > 0;
  const press = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    onToggle();
  };
  return (
    <Pressable
      onPress={press}
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
          partial && { borderColor: tint },
          (skipped || (disabled && !done)) && styles.boxDisabled,
        ]}
      >
        {done && <Ionicons name="checkmark" size={16} color="#fff" />}
        {partial && <Text style={[styles.count, { color: tint }]}>{count.value}</Text>}
        {skipped && <Ionicons name="remove" size={14} color={colors.faint} />}
      </View>
      <View style={styles.text}>
        <Text style={[type.bodyMedium, (done || skipped) && styles.doneTitle, skipped && styles.skippedTitle]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {count && !skipped ? (
        <Text style={styles.meta}>
          {Math.min(count.value, count.target)}/{count.target}
        </Text>
      ) : meta ? (
        <Text style={styles.meta}>{meta}</Text>
      ) : null}
    </Pressable>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
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
  skippedTitle: { textDecorationLine: 'none' },
  count: { fontFamily: fonts.monoMedium, fontSize: 12 },
  meta: { ...type.small, fontFamily: type.num.fontFamily },
});
