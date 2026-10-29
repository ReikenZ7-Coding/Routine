import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '../lib/gym';
import { WEEKDAY_SHORT } from '../lib/schedule';
import { newId } from '../lib/store';
import { colors, radius } from '../theme';
import { Chip } from './Chip';

interface Props {
  visible: boolean;
  /** Session being edited, or undefined when adding a new one. */
  session?: Session;
  /** Weekdays already used by other sessions (one session per day). */
  takenDays: number[];
  onSave: (session: Session) => void;
  onDelete?: () => void;
  onClose: () => void;
}

interface Row {
  id: string;
  name: string;
  sets: string;
  reps: string;
  weight: string;
}

const blankRow = (): Row => ({ id: newId(), name: '', sets: '3', reps: '10', weight: '' });

export function SessionForm({ visible, session, takenDays, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName(session?.name ?? '');
    setDays(session?.days ?? []);
    setRows(
      session?.exercises.map((e) => ({
        id: e.id,
        name: e.name,
        sets: String(e.sets),
        reps: String(e.reps),
        weight: e.weight ? String(e.weight) : '',
      })) ?? [blankRow()],
    );
  }, [visible, session]);

  const updateRow = (id: string, changes: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Add a name', 'For example "Push day" or "Legs".');
      return;
    }
    const exercises = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: r.id,
        name: r.name.trim(),
        sets: Math.max(1, parseInt(r.sets, 10) || 1),
        reps: Math.max(1, parseInt(r.reps, 10) || 1),
        weight: Math.max(0, parseFloat(r.weight.replace(',', '.')) || 0),
      }));
    if (exercises.length === 0) {
      Alert.alert('Add an exercise', 'A session needs at least one exercise.');
      return;
    }
    onSave({ id: session?.id ?? newId(), name: trimmed, days: [...days].sort(), exercises });
  }

  function confirmDelete() {
    Alert.alert('Delete session?', `Remove "${session?.name}" from your plan? Past workouts stay in your history.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{session ? 'Edit session' : 'New session'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Push day" />

            <Text style={styles.label}>Which days?</Text>
            <View style={styles.chips}>
              {WEEKDAY_SHORT.map((label, d) => (
                <Chip key={label} label={label} active={days.includes(d)} onPress={() => toggleDay(d)} />
              ))}
            </View>
            {days.some((d) => takenDays.includes(d)) && (
              <Text style={styles.note}>Some of these days already have a session. This one will replace it there.</Text>
            )}

            <Text style={styles.label}>Exercises</Text>
            <View style={styles.headerRow}>
              <Text style={[styles.colHead, styles.nameCol]}>Exercise</Text>
              <Text style={styles.colHead}>Sets</Text>
              <Text style={styles.colHead}>Reps</Text>
              <Text style={styles.colHead}>kg</Text>
              <View style={styles.removeSpace} />
            </View>
            {rows.map((r) => (
              <View key={r.id} style={styles.exRow}>
                <TextInput
                  style={[styles.input, styles.nameCol]}
                  value={r.name}
                  onChangeText={(v) => updateRow(r.id, { name: v })}
                  placeholder="Exercise"
                />
                <TextInput
                  style={[styles.input, styles.num]}
                  value={r.sets}
                  onChangeText={(v) => updateRow(r.id, { sets: v })}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <TextInput
                  style={[styles.input, styles.num]}
                  value={r.reps}
                  onChangeText={(v) => updateRow(r.id, { reps: v })}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <TextInput
                  style={[styles.input, styles.num]}
                  value={r.weight}
                  onChangeText={(v) => updateRow(r.id, { weight: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  maxLength={5}
                />
                <Pressable
                  onPress={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                  hitSlop={8}
                  accessibilityLabel={`Remove ${r.name || 'exercise'}`}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addRow} onPress={() => setRows((prev) => [...prev, blankRow()])}>
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={styles.addRowText}>Add exercise</Text>
            </Pressable>

            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>{session ? 'Save' : 'Add session'}</Text>
            </Pressable>
            {session && onDelete && (
              <Pressable style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete session</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '92%',
  },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  label: { fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6 },
  note: { fontSize: 13, color: colors.muted, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  colHead: { width: 48, fontSize: 12, color: colors.muted, textAlign: 'center' },
  nameCol: { flex: 1, width: undefined, minWidth: 0, textAlign: 'left' },
  removeSpace: { width: 22 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  num: { width: 48, textAlign: 'center', paddingHorizontal: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  addRowText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  deleteButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
