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
import { type Routine, type TimeOfDay, TIME_LABELS } from '../lib/routines';
import { type Repeat, WEEKDAY_SHORT } from '../lib/schedule';
import { colors, fonts, radius } from '../theme';
import { Chip } from './Chip';

type RepeatChoice = 'daily' | 'weekdays' | 'everyN' | 'once';

export type RoutineFields = Pick<Routine, 'name' | 'repeat' | 'time'>;

interface Props {
  visible: boolean;
  routine?: Routine;
  onSave: (fields: RoutineFields) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function choiceFor(r: Repeat): RepeatChoice {
  if (r.kind === 'once') return 'once';
  if (r.kind === 'weekdays') return 'weekdays';
  return r.n === 1 ? 'daily' : 'everyN';
}

export function RoutineForm({ visible, routine, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<RepeatChoice>('daily');
  const [everyN, setEveryN] = useState('2');
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState<TimeOfDay>('anytime');

  useEffect(() => {
    if (!visible) return;
    const r = routine?.repeat ?? { kind: 'everyNDays', n: 1 };
    setName(routine?.name ?? '');
    setChoice(choiceFor(r));
    setEveryN(r.kind === 'everyNDays' && r.n > 1 ? String(r.n) : '2');
    setDays(r.kind === 'weekdays' ? r.days : []);
    setTime(routine?.time ?? 'anytime');
  }, [visible, routine]);

  function save() {
    if (!name.trim()) {
      Alert.alert('Add a name', 'What do you want to do regularly?');
      return;
    }
    let repeat: Repeat;
    if (choice === 'once') repeat = { kind: 'once' };
    else if (choice === 'daily') repeat = { kind: 'everyNDays', n: 1 };
    else if (choice === 'everyN') repeat = { kind: 'everyNDays', n: Math.max(2, parseInt(everyN, 10) || 2) };
    else {
      if (days.length === 0) {
        Alert.alert('Pick a day', 'Choose at least one day of the week.');
        return;
      }
      repeat = { kind: 'weekdays', days: [...days].sort() };
    }
    onSave({ name: name.trim(), repeat, time });
  }

  function confirmDelete() {
    Alert.alert('Delete routine?', `Remove "${routine?.name}" and its history?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{routine ? 'Edit routine' : 'New routine'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Stretch 10 minutes"
              autoFocus={!routine}
            />

            <Text style={styles.label}>How often?</Text>
            <View style={styles.chips}>
              {(
                [
                  ['daily', 'Every day'],
                  ['weekdays', 'Certain days'],
                  ['everyN', 'Every few days'],
                  ['once', 'Just once'],
                ] as const
              ).map(([key, label]) => (
                <Chip key={key} label={label} active={choice === key} onPress={() => setChoice(key)} />
              ))}
            </View>
            {choice === 'everyN' && (
              <View style={styles.inline}>
                <Text style={styles.inlineText}>Every</Text>
                <TextInput
                  style={[styles.input, styles.smallInput]}
                  value={everyN}
                  onChangeText={setEveryN}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.inlineText}>days</Text>
              </View>
            )}
            {choice === 'weekdays' && (
              <View style={[styles.chips, styles.gapTop]}>
                {WEEKDAY_SHORT.map((label, d) => (
                  <Chip key={label} label={label} active={days.includes(d)} onPress={() => toggleDay(d)} />
                ))}
              </View>
            )}

            <Text style={styles.label}>When?</Text>
            <View style={styles.chips}>
              {(Object.keys(TIME_LABELS) as TimeOfDay[]).map((t) => (
                <Chip key={t} label={TIME_LABELS[t]} active={time === t} onPress={() => setTime(t)} />
              ))}
            </View>

            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>{routine ? 'Save' : 'Add routine'}</Text>
            </Pressable>
            {routine && onDelete && (
              <Pressable style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete routine</Text>
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
    maxHeight: '90%',
  },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginBottom: 8 },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 16,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gapTop: { marginTop: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  inlineText: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  smallInput: { width: 64, textAlign: 'center' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 16 },
  deleteButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 15 },
});
