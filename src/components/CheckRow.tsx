import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

interface Props {
  title: string;
  subtitle?: string;
  done: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}

export function CheckRow({ title, subtitle, done, onToggle, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
    >
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={26}
        color={done ? colors.primary : colors.muted}
      />
      <View style={styles.text}>
        <Text style={[styles.title, done && styles.doneTitle]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { backgroundColor: colors.primarySoft },
  text: { flex: 1 },
  title: { fontSize: 16, color: colors.text, fontWeight: '500' },
  doneTitle: { color: colors.muted, textDecorationLine: 'line-through' },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
