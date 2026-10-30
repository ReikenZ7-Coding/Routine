import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { allowReminders, remindersSupported } from '../lib/reminders';
import { Ionicons } from '@expo/vector-icons';
import { ROUTINE_ICONS, type Routine, type TimeOfDay, TIME_LABELS, formatTime, iconFor } from '../lib/routines';
import { clock, parseClock } from '../lib/timeline';
import { type Repeat, WEEKDAY_SHORT } from '../lib/schedule';
import { type Theme, useStyles, useTheme } from '../theme';
import { Chip } from './Chip';

type RepeatChoice = 'daily' | 'weekdays' | 'everyN' | 'once';

export type RoutineFields = Pick<Routine, 'name' | 'repeat' | 'time' | 'target' | 'reminder' | 'start' | 'duration' | 'icon' | 'pinned'>;

const DURATIONS = [5, 10, 15, 30, 45, 60, 90];

const DEFAULT_REMINDER: Record<TimeOfDay, string> = { morning: '08:00', afternoon: '13:00', evening: '20:00', anytime: '09:00' };

function parseTime(text: string): { hour: number; minute: number } | undefined {
  const m = text.trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!m) return undefined;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : undefined;
}

interface Props {
  visible: boolean;
  routine?: Routine;
  onSave: (fields: RoutineFields) => void;
  onDelete?: () => void;
  /** Skip (or un-skip) today without breaking the streak. Only offered when it's on today. */
  onSkip?: () => void;
  skippedToday?: boolean;
  onClose: () => void;
}

function choiceFor(r: Repeat): RepeatChoice {
  if (r.kind === 'once') return 'once';
  if (r.kind === 'weekdays') return 'weekdays';
  return r.n === 1 ? 'daily' : 'everyN';
}

export function RoutineForm({ visible, routine, onSave, onDelete, onSkip, skippedToday, onClose }: Props) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<RepeatChoice>('daily');
  const [everyN, setEveryN] = useState('2');
  const [days, setDays] = useState<number[]>([]);
  const [time, setTime] = useState<TimeOfDay>('anytime');
  const [counter, setCounter] = useState(false);
  const [target, setTarget] = useState('8');
  const [remind, setRemind] = useState(false);
  const [remindAt, setRemindAt] = useState('09:00');
  const [start, setStart] = useState('');
  const [duration, setDuration] = useState(15);
  const [icon, setIcon] = useState<string | undefined>();
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const r = routine?.repeat ?? { kind: 'everyNDays', n: 1 };
    setName(routine?.name ?? '');
    setChoice(choiceFor(r));
    setEveryN(r.kind === 'everyNDays' && r.n > 1 ? String(r.n) : '2');
    setDays(r.kind === 'weekdays' ? r.days : []);
    setTime(routine?.time ?? 'anytime');
    setCounter(!!routine?.target);
    setTarget(String(routine?.target ?? 8));
    setRemind(!!routine?.reminder);
    setRemindAt(routine?.reminder ? formatTime(routine.reminder.hour, routine.reminder.minute) : routine?.start ?? DEFAULT_REMINDER[routine?.time ?? 'anytime']);
    setStart(routine?.start ?? '');
    setDuration(routine?.duration ?? 15);
    setIcon(routine?.icon);
    setPinned(!!routine?.pinned);
  }, [visible, routine]);

  async function save() {
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
    let reminder: RoutineFields['reminder'];
    if (remind) {
      reminder = parseTime(remindAt);
      if (!reminder) {
        Alert.alert('Check the time', 'Write the reminder time like 07:30 or 20:00.');
        return;
      }
      if (remindersSupported && !(await allowReminders())) {
        Alert.alert('Notifications are off', 'Allow notifications for Routine in your phone settings to get reminders.');
      }
    }
    let startAt: string | undefined;
    if (start.trim()) {
      const m = parseClock(start);
      if (m === undefined) {
        Alert.alert('Check the start time', 'Write it like 07:30 or 18:00, or leave it empty for anytime.');
        return;
      }
      startAt = clock(m);
    }
    const goal = counter ? Math.max(2, parseInt(target, 10) || 2) : undefined;
    const when: TimeOfDay = startAt ? (parseClock(startAt)! < 720 ? 'morning' : parseClock(startAt)! < 1020 ? 'afternoon' : 'evening') : time;
    onSave({
      name: name.trim(),
      repeat,
      time: when,
      target: goal,
      reminder,
      start: startAt,
      duration: startAt ? duration : undefined,
      icon,
      pinned: pinned || undefined,
    });
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
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{routine ? 'Edit routine' : 'New routine'}</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Stretch 10 minutes" placeholderTextColor={colors.faint}
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

            <Text style={styles.label}>Start time (leave empty for anytime)</Text>
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={start}
              onChangeText={setStart}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              placeholder="07:30"
              placeholderTextColor={colors.faint}
            />
            {start.trim() ? (
              <>
                <Text style={styles.label}>Takes</Text>
                <View style={styles.chips}>
                  {DURATIONS.map((d) => (
                    <Chip key={d} label={d >= 60 ? `${d / 60} h`.replace('1.5 h', '1½ h') : `${d} min`} active={duration === d} onPress={() => setDuration(d)} />
                  ))}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>Roughly when?</Text>
                <View style={styles.chips}>
                  {(Object.keys(TIME_LABELS) as TimeOfDay[]).map((t) => (
                    <Chip key={t} label={TIME_LABELS[t]} active={time === t} onPress={() => setTime(t)} />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Icon</Text>
            <View style={styles.icons}>
              {ROUTINE_ICONS.map((ic) => {
                const active = (icon ?? iconFor({ name, icon })) === ic;
                return (
                  <Pressable accessibilityRole="button"
                    key={ic}
                    style={[styles.iconChoice, active && { backgroundColor: kinds.routines.color, borderColor: kinds.routines.color }]}
                    onPress={() => setIcon(ic)}
                    accessibilityLabel={`Icon ${ic}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={ic} size={18} color={active ? '#FFFFFF' : colors.text} />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Shortcut on Today</Text>
                <Text style={styles.switchSub}>A one-tap button at the top of your day</Text>
              </View>
              <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: kinds.routines.color }} />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Count it</Text>
                <Text style={styles.switchSub}>Tap +1 each time, like glasses of water</Text>
              </View>
              <Switch value={counter} onValueChange={setCounter} trackColor={{ true: kinds.routines.color }} />
            </View>
            {counter && (
              <View style={styles.inline}>
                <Text style={styles.inlineText}>Goal</Text>
                <TextInput
                  style={[styles.input, styles.smallInput]}
                  value={target}
                  onChangeText={setTarget}
                  keyboardType="number-pad"
                  maxLength={3}
                />
                <Text style={styles.inlineText}>times a day</Text>
              </View>
            )}

            <View style={styles.switchRow}>
              <View style={styles.flex}>
                <Text style={styles.switchTitle}>Remind me</Text>
                <Text style={styles.switchSub}>
                  {remindersSupported ? 'A notification on the days it’s due' : 'Works in the Android app'}
                </Text>
              </View>
              <Switch value={remind} onValueChange={setRemind} trackColor={{ true: kinds.routines.color }} />
            </View>
            {remind && (
              <View style={styles.inline}>
                <Text style={styles.inlineText}>At</Text>
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={remindAt}
                  onChangeText={setRemindAt}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  placeholder="08:00" placeholderTextColor={colors.faint}
                />
              </View>
            )}

            <Pressable accessibilityRole="button" style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>{routine ? 'Save' : 'Add routine'}</Text>
            </Pressable>
            {routine && onSkip && (
              <Pressable accessibilityRole="button" style={styles.skipButton} onPress={onSkip}>
                <Text style={styles.skipText}>{skippedToday ? 'Undo skip' : 'Skip today (keeps your streak)'}</Text>
              </Pressable>
            )}
            {routine && onDelete && (
              <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete routine</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginBottom: 8 },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.input,
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
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChoice: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timeInput: { width: 84, textAlign: 'center', fontFamily: fonts.mono },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  switchTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
  switchSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 1 },
  skipButton: { paddingVertical: 14, alignItems: 'center', marginTop: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  skipText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 16 },
  deleteButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 15 },
});
