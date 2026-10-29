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
import type { NewGroceryItem } from '../lib/store';
import { Chip } from './Chip';
import { type GroceryItem, type Repeat, WEEKDAY_SHORT } from '../lib/schedule';
import { colors, fonts, radius } from '../theme';

type RepeatChoice = 'once' | 'daily' | 'everyN' | 'weekdays';

interface Props {
  visible: boolean;
  /** Item being edited, or undefined when adding a new one. */
  item?: GroceryItem;
  onSave: (item: NewGroceryItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function choiceFor(r: Repeat): RepeatChoice {
  if (r.kind === 'once') return 'once';
  if (r.kind === 'weekdays') return 'weekdays';
  return r.n === 1 ? 'daily' : 'everyN';
}

export function GroceryForm({ visible, item, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [aisle, setAisle] = useState('');
  const [choice, setChoice] = useState<RepeatChoice>('daily');
  const [everyN, setEveryN] = useState('3');
  const [days, setDays] = useState<number[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? '');
    setQuantity(item?.quantity ?? '');
    setAisle(item?.aisle ?? '');
    const r = item?.repeat ?? { kind: 'everyNDays', n: 1 };
    setChoice(choiceFor(r));
    setEveryN(r.kind === 'everyNDays' && r.n > 1 ? String(r.n) : '3');
    setDays(r.kind === 'weekdays' ? r.days : []);
  }, [visible, item]);

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Add a name', 'What do you need to buy?');
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
    onSave({
      name: trimmed,
      quantity: quantity.trim() || undefined,
      aisle: aisle.trim() || undefined,
      repeat,
    });
  }

  function confirmDelete() {
    Alert.alert('Delete item?', `Remove "${item?.name}" from your groceries?`, [
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
            <Text style={styles.heading}>{item ? 'Edit item' : 'New item'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Chicken"
              autoFocus={!item}
            />

            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>Amount (optional)</Text>
                <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} placeholder="500 g" />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Aisle (optional)</Text>
                <TextInput style={styles.input} value={aisle} onChangeText={setAisle} placeholder="Meat" />
              </View>
            </View>

            <Text style={styles.label}>How often?</Text>
            <View style={styles.chips}>
              {(
                [
                  ['daily', 'Every day'],
                  ['everyN', 'Every few days'],
                  ['weekdays', 'Certain days'],
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
              <View style={styles.chips}>
                {WEEKDAY_SHORT.map((label, d) => (
                  <Chip key={label} label={label} active={days.includes(d)} onPress={() => toggleDay(d)} />
                ))}
              </View>
            )}

            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>{item ? 'Save' : 'Add to list'}</Text>
            </Pressable>
            {item && onDelete && (
              <Pressable style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete item</Text>
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
  twoCol: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
