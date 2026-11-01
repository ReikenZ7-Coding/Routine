import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { FadeSwap, Press, SelectFade } from './Motion';

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
  const mark = partial ? (
    <Text style={[styles.count, { color: tint }]}>{count.value}</Text>
  ) : skipped ? (
    <Ionicons name="remove" size={14} color={colors.faint} />
  ) : null;
  return (
    <Press
      onPress={onToggle}
      onLongPress={onLongPress}
      disabled={disabled}
      haptic
      overlay={colors.material.pressFill}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={title}
      accessibilityHint={onLongPress ? 'Long press to edit' : undefined}
    >
      <View style={[styles.box, partial && { borderColor: tint }, (skipped || (disabled && !done)) && styles.boxDisabled]}>
        <SelectFade on={done} color={tint} radius={7} bleed={1.5} />
        <FadeSwap
          on={done}
          style={StyleSheet.absoluteFill}
          off={mark}
          onContent={<Ionicons name="checkmark" size={16} color={colors.onKind} />}
        />
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
    </Press>
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
