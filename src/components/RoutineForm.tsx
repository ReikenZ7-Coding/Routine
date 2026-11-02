import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { allowReminders, remindersSupported } from '../lib/reminders';
import { Ionicons } from '@expo/vector-icons';
import { ROUTINE_ICONS, type Routine, type TimeOfDay, TIME_LABELS, formatTime, iconFor } from '../lib/routines';
import { clock, parseClock } from '../lib/timeline';
import { type Repeat, WEEKDAY_SHORT } from '../lib/schedule';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Field, FieldError, Input } from './Field';
import { FadeSwap, Press, SelectFade } from './Motion';
import { ConfirmDelete, Sheet, SheetFooter } from './Sheet';
import { useDesktop } from './desktop/context';

type Errors = Partial<Record<'name' | 'days' | 'start' | 'remind', string>>;

type RepeatChoice = 'daily' | 'weekdays' | 'everyN' | 'once';

export type RoutineFields = Pick<Routine, 'name' | 'repeat' | 'time' | 'target' | 'reminder' | 'start' | 'duration' | 'icon'>;

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
  /** A new routine's starting values (the desktop calendar's empty slot fills its weekday and start time). */
  draft?: Partial<RoutineFields>;
}

function choiceFor(r: Repeat): RepeatChoice {
  if (r.kind === 'once') return 'once';
  if (r.kind === 'weekdays') return 'weekdays';
  return r.n === 1 ? 'daily' : 'everyN';
}

export function RoutineForm({ visible, routine, onSave, onDelete, onSkip, skippedToday, onClose, draft }: Props) {
  const { colors, kinds } = useTheme();
  const desktop = useDesktop().on;
  // On the web a switch's off track is the browser's grey, close to invisible on glass: the desktop draws it in
  // the control border (3:1 on every look's glass). The phone keeps the platform's own off track.
  const track = desktop ? { false: colors.controlBorder, true: kinds.routines.color } : { true: kinds.routines.color };
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
  const [errors, setErrors] = useState<Errors>({});
  /** Shown once when notifications are off; the next Save goes ahead without the permission. */
  const [notice, setNotice] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const clear = (k: keyof Errors) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setNotice(undefined);
    // Editing fills the form from the routine; a new one from its draft, if it has one (the phone has none).
    const seed: Partial<RoutineFields> | undefined = routine ?? draft;
    const r = seed?.repeat ?? { kind: 'everyNDays', n: 1 };
    setName(seed?.name ?? '');
    setChoice(choiceFor(r));
    setEveryN(r.kind === 'everyNDays' && r.n > 1 ? String(r.n) : '2');
    setDays(r.kind === 'weekdays' ? r.days : []);
    setTime(seed?.time ?? 'anytime');
    setCounter(!!seed?.target);
    setTarget(String(seed?.target ?? 8));
    setRemind(!!seed?.reminder);
    setRemindAt(
      seed?.reminder ? formatTime(seed.reminder.hour, seed.reminder.minute) : (seed?.start ?? DEFAULT_REMINDER[seed?.time ?? 'anytime']),
    );
    setStart(seed?.start ?? '');
    setDuration(seed?.duration ?? 15);
    setIcon(seed?.icon);
  }, [visible, routine, draft]);

  async function save() {
    const found: Errors = {};
    if (!name.trim()) found.name = 'Add a name: what do you want to do regularly?';
    let repeat: Repeat = { kind: 'everyNDays', n: 1 };
    if (choice === 'once') repeat = { kind: 'once' };
    else if (choice === 'everyN') repeat = { kind: 'everyNDays', n: Math.max(2, parseInt(everyN, 10) || 2) };
    else if (choice === 'weekdays') {
      if (days.length === 0) found.days = 'Pick at least one day of the week.';
      repeat = { kind: 'weekdays', days: [...days].sort() };
    }
    let startAt: string | undefined;
    if (start.trim()) {
      const m = parseClock(start);
      if (m === undefined) found.start = 'Write the start time like 07:30 or 18:00, or leave it empty for anytime.';
      else startAt = clock(m);
    }
    let reminder: RoutineFields['reminder'];
    if (remind) {
      reminder = parseTime(remindAt);
      if (!reminder) found.remind = 'Write the reminder time like 07:30 or 20:00.';
    }
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    if (remind && remindersSupported && !notice) {
      setSaving(true);
      const allowed = await allowReminders().catch(() => false);
      setSaving(false);
      if (!allowed) {
        setNotice(
          'Notifications are off for Routine, so this reminder can’t ring. Allow them in your phone settings, or tap Save again to keep it anyway.',
        );
        return;
      }
    }
    const goal = counter ? Math.max(2, parseInt(target, 10) || 2) : undefined;
    const when: TimeOfDay = startAt
      ? parseClock(startAt)! < 720
        ? 'morning'
        : parseClock(startAt)! < 1020
          ? 'afternoon'
          : 'evening'
      : time;
    onSave({
      name: name.trim(),
      repeat,
      time: when,
      target: goal,
      reminder,
      start: startAt,
      duration: startAt ? duration : undefined,
      icon,
    });
  }

  const toggleDay = (d: number) => {
    clear('days');
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  return (
    <Sheet visible={visible} title={routine ? 'Edit routine' : 'New routine'} onClose={onClose}>
      <Field label="Name" error={errors.name}>
        <Input
          value={name}
          onChangeText={(t) => {
            setName(t);
            clear('name');
          }}
          invalid={!!errors.name}
          placeholder="e.g. Stretch 10 minutes"
          autoFocus={!routine}
          accessibilityLabel="Name"
        />
      </Field>

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
          <Chip
            key={key}
            label={label}
            active={choice === key}
            onPress={() => {
              setChoice(key);
              clear('days');
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

      <Field label="Start time (leave empty for anytime)" error={errors.start}>
        <View style={styles.timeBox}>
          <Input
            style={styles.center}
            value={start}
            onChangeText={(t) => {
              setStart(t);
              clear('start');
            }}
            invalid={!!errors.start}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            placeholder={desktop ? 'e.g. 07:30' : '07:30'}
            accessibilityLabel="Start time"
          />
        </View>
      </Field>
      {start.trim() ? (
        <>
          <Text style={styles.label}>Takes</Text>
          <View style={styles.chips}>
            {DURATIONS.map((d) => (
              <Chip
                key={d}
                label={d >= 60 ? `${d / 60} h`.replace('1.5 h', '1½ h') : `${d} min`}
                active={duration === d}
                onPress={() => setDuration(d)}
              />
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
            <Press
              key={ic}
              style={styles.iconChoice}
              overlay={colors.material.pressFill}
              onPress={() => setIcon(ic)}
              accessibilityLabel={`Icon ${ic}`}
              accessibilityState={{ selected: active }}
            >
              <SelectFade on={active} color={kinds.routines.color} radius={22} bleed={1} />
              <FadeSwap
                on={active}
                off={<Ionicons name={ic} size={18} color={colors.text} />}
                onContent={<Ionicons name={ic} size={18} color={colors.onKind} />}
              />
            </Press>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.switchTitle}>Count it</Text>
          <Text style={styles.switchSub}>
            {desktop ? 'Add one each time, like glasses of water' : 'Tap +1 each time, like glasses of water'}
          </Text>
        </View>
        <Switch value={counter} onValueChange={setCounter} trackColor={track} accessibilityLabel="Count it" />
      </View>
      {counter && (
        <View style={styles.inline}>
          <Text style={styles.inlineText}>Goal</Text>
          <View style={styles.smallBox}>
            <Input
              style={styles.center}
              value={target}
              onChangeText={setTarget}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel="Goal per day"
            />
          </View>
          <Text style={styles.inlineText}>times a day</Text>
        </View>
      )}

      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <Text style={styles.switchTitle}>Remind me</Text>
          <Text style={styles.switchSub}>{remindersSupported ? 'A notification on the days it’s due' : 'Works in the Android app'}</Text>
        </View>
        <Switch
          value={remind}
          onValueChange={(v) => {
            setRemind(v);
            clear('remind');
            setNotice(undefined);
          }}
          trackColor={track}
          accessibilityLabel="Remind me"
        />
      </View>
      {remind && (
        <>
          <View style={styles.inline}>
            <Text style={styles.inlineText}>At</Text>
            <View style={styles.timeBox}>
              <Input
                style={styles.center}
                value={remindAt}
                onChangeText={(t) => {
                  setRemindAt(t);
                  clear('remind');
                }}
                invalid={!!errors.remind}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                placeholder="08:00"
                accessibilityLabel="Reminder time"
              />
            </View>
          </View>
          <FieldError message={errors.remind ?? notice} />
        </>
      )}

      <SheetFooter>
        <Button label={routine ? 'Save' : 'Add routine'} onPress={save} busy={saving} style={styles.save} />
      </SheetFooter>
      {routine && onSkip && (
        <Button
          label={skippedToday ? 'Undo skip' : 'Skip today (keeps your streak)'}
          variant="secondary"
          onPress={onSkip}
          style={styles.skip}
        />
      )}
      {routine && onDelete && (
        <ConfirmDelete label="Delete routine" question={`Delete “${routine.name}” and its history?`} onConfirm={onDelete} />
      )}
    </Sheet>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    label: { ...type.label, marginTop: 18, marginBottom: 8 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    gapTop: { marginTop: 12 },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    inlineText: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    smallBox: { width: 72 },
    timeBox: { width: 96 },
    center: { textAlign: 'center', fontVariant: ['tabular-nums'] },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChoice: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flex: { flex: 1 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, minHeight: 48 },
    switchTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    switchSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 1 },
    save: { marginTop: 24 },
    skip: { marginTop: 10 },
  });
