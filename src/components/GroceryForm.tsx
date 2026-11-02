import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NewGroceryItem } from '../lib/store';
import { Button } from './Button';
import { Chip } from './Chip';
import { Field, FieldError, Input } from './Field';
import { ConfirmDelete, Sheet, SheetFooter } from './Sheet';
import { type GroceryItem, type Repeat, WEEKDAY_SHORT } from '../lib/schedule';
import { type Theme, useStyles } from '../theme';

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
  const styles = useStyles(makeStyles);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [aisle, setAisle] = useState('');
  const [choice, setChoice] = useState<RepeatChoice>('daily');
  const [everyN, setEveryN] = useState('3');
  const [days, setDays] = useState<number[]>([]);
  const [errors, setErrors] = useState<{ name?: string; days?: string }>({});

  useEffect(() => {
    if (!visible) return;
    setErrors({});
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
    const found: { name?: string; days?: string } = {};
    if (!trimmed) found.name = 'Add a name: what do you need to buy?';
    if (choice === 'weekdays' && days.length === 0) found.days = 'Pick at least one day of the week.';
    setErrors(found);
    if (found.name || found.days) return;
    let repeat: Repeat;
    if (choice === 'once') repeat = { kind: 'once' };
    else if (choice === 'daily') repeat = { kind: 'everyNDays', n: 1 };
    else if (choice === 'everyN') repeat = { kind: 'everyNDays', n: Math.max(2, parseInt(everyN, 10) || 2) };
    else repeat = { kind: 'weekdays', days: [...days].sort() };
    onSave({
      name: trimmed,
      quantity: quantity.trim() || undefined,
      aisle: aisle.trim() || undefined,
      repeat,
    });
  }

  const toggleDay = (d: number) => {
    setErrors((e) => ({ ...e, days: undefined }));
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  return (
    <Sheet visible={visible} title={item ? 'Edit item' : 'New item'} onClose={onClose}>
      <Field label="Name" error={errors.name}>
        <Input
          value={name}
          onChangeText={(t) => {
            setName(t);
            setErrors((e) => ({ ...e, name: undefined }));
          }}
          invalid={!!errors.name}
          placeholder="e.g. Chicken"
          autoFocus={!item}
          accessibilityLabel="Name"
        />
      </Field>

      <View style={styles.twoCol}>
        <Field label="Amount (optional)" style={styles.col}>
          <Input value={quantity} onChangeText={setQuantity} placeholder="500 g" accessibilityLabel="Amount" />
        </Field>
        <Field label="Aisle (optional)" style={styles.col}>
          <Input value={aisle} onChangeText={setAisle} placeholder="Meat" accessibilityLabel="Aisle" />
        </Field>
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
          <Chip
            key={key}
            label={label}
            active={choice === key}
            onPress={() => {
              setChoice(key);
              setErrors((e) => ({ ...e, days: undefined }));
            }}
          />
        ))}
      </View>

      {choice === 'everyN' && (
        <View style={styles.inline}>
          <Text style={styles.inlineText}>Every</Text>
          <View style={styles.smallBox}>
            <Input
              style={styles.center}
              value={everyN}
              onChangeText={setEveryN}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Number of days"
            />
          </View>
          <Text style={styles.inlineText}>days</Text>
        </View>
      )}

      {choice === 'weekdays' && (
        <>
          <View style={[styles.chips, styles.gapTop]}>
            {WEEKDAY_SHORT.map((label, d) => (
              <Chip key={label} label={label} active={days.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </View>
          <FieldError message={errors.days} />
        </>
      )}

      <SheetFooter>
        <Button label={item ? 'Save' : 'Add to list'} onPress={save} style={styles.save} />
      </SheetFooter>
      {item && onDelete && (
        <ConfirmDelete label="Delete item" question={`Remove “${item.name}” from your groceries?`} onConfirm={onDelete} />
      )}
    </Sheet>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    label: { ...type.label, marginTop: 18, marginBottom: 8 },
    twoCol: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    gapTop: { marginTop: 12 },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    inlineText: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    smallBox: { width: 72 },
    center: { textAlign: 'center', fontVariant: ['tabular-nums'] },
    save: { marginTop: 24 },
  });
