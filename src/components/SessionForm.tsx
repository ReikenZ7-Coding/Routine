import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Session } from '../lib/gym';
import { WEEKDAY_SHORT } from '../lib/schedule';
import { newId } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Field, FieldError, Input } from './Field';
import { Press } from './Motion';
import { ConfirmDelete, Sheet } from './Sheet';

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
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<{ name?: string; exercises?: string }>({});

  useEffect(() => {
    if (!visible) return;
    setErrors({});
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

  const updateRow = (id: string, changes: Partial<Row>) => {
    if (changes.name) setErrors((e) => ({ ...e, exercises: undefined }));
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  };

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  function save() {
    const trimmed = name.trim();
    const exercises = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        id: r.id,
        name: r.name.trim(),
        sets: Math.max(1, parseInt(r.sets, 10) || 1),
        reps: Math.max(1, parseInt(r.reps, 10) || 1),
        weight: Math.max(0, parseFloat(r.weight.replace(',', '.')) || 0),
      }));
    const found = {
      name: trimmed ? undefined : 'Add a name, for example “Push day” or “Legs”.',
      exercises: exercises.length ? undefined : 'A session needs at least one exercise with a name.',
    };
    setErrors(found);
    if (found.name || found.exercises) return;
    onSave({ id: session?.id ?? newId(), name: trimmed, days: [...days].sort(), exercises });
  }

  return (
    <Sheet visible={visible} title={session ? 'Edit session' : 'New session'} onClose={onClose}>
      <Field label="Name" error={errors.name}>
        <Input
          value={name}
          onChangeText={(t) => {
            setName(t);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          invalid={!!errors.name}
          placeholder="e.g. Push day"
          accessibilityLabel="Name"
        />
      </Field>

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
      {rows.map((r, i) => (
        <View key={r.id} style={styles.exRow}>
          <View style={styles.nameCol}>
            <Input
              value={r.name}
              onChangeText={(v) => updateRow(r.id, { name: v })}
              placeholder="Exercise"
              accessibilityLabel={`Exercise ${i + 1} name`}
            />
          </View>
          <View style={styles.num}>
            <Input
              style={styles.center}
              value={r.sets}
              onChangeText={(v) => updateRow(r.id, { sets: v })}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel={`Exercise ${i + 1} sets`}
            />
          </View>
          <View style={styles.num}>
            <Input
              style={styles.center}
              value={r.reps}
              onChangeText={(v) => updateRow(r.id, { reps: v })}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel={`Exercise ${i + 1} reps`}
            />
          </View>
          <View style={styles.num}>
            <Input
              style={styles.center}
              value={r.weight}
              onChangeText={(v) => updateRow(r.id, { weight: v })}
              keyboardType="decimal-pad"
              placeholder="0"
              maxLength={5}
              accessibilityLabel={`Exercise ${i + 1} weight in kilograms`}
            />
          </View>
          <Press
            style={styles.remove}
            overlay={colors.material.pressFill}
            onPress={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
            accessibilityLabel={`Remove ${r.name || `exercise ${i + 1}`}`}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
          </Press>
        </View>
      ))}
      <FieldError message={errors.exercises} />
      <Button
        label="Add exercise"
        variant="plain"
        icon="add"
        onPress={() => setRows((prev) => [...prev, blankRow()])}
        style={styles.addRow}
      />

      <Button label={session ? 'Save' : 'Add session'} onPress={save} style={styles.save} />
      {session && onDelete && (
        <ConfirmDelete
          label="Delete session"
          question={`Remove “${session.name}” from your plan? Past workouts stay in your history.`}
          onConfirm={onDelete}
        />
      )}
    </Sheet>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    label: { ...type.label, marginTop: 18, marginBottom: 8 },
    note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    colHead: { width: 52, fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center' },
    nameCol: { flex: 1, width: undefined, minWidth: 0, textAlign: 'left' },
    removeSpace: { width: 44 },
    exRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    num: { width: 52 },
    center: { textAlign: 'center', paddingHorizontal: 4, fontVariant: ['tabular-nums'] },
    remove: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    addRow: { alignSelf: 'flex-start', marginTop: 4 },
    save: { marginTop: 16 },
  });
