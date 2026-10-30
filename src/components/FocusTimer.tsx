import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Chip } from './Chip';

const LENGTHS = [15, 25];

/** A focus countdown that logs the minutes practised when it ends or is stopped. */
export function FocusTimer({ onLog }: { onLog: (minutes: number) => void }) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const [length, setLength] = useState(15);
  const [run, setRun] = useState<{ start: number; end: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const logRef = useRef(onLog);
  logRef.current = onLog;
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [run]);

  // Leaving the screen mid-session still counts the minutes done.
  useEffect(
    () => () => {
      const r = runRef.current;
      if (r) {
        const mins = Math.floor((Math.min(Date.now(), r.end) - r.start) / 60000);
        if (mins > 0) logRef.current(mins);
      }
    },
    [],
  );

  const stop = (finished: boolean) => {
    if (!run) return;
    const mins = finished ? Math.round((run.end - run.start) / 60000) : Math.floor((Date.now() - run.start) / 60000);
    setRun(null);
    if (mins > 0) logRef.current(mins);
    if (finished && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const left = run ? Math.max(0, run.end - now) : length * 60000;
  useEffect(() => {
    if (run && left === 0) stop(true);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const secs = Math.ceil(left / 1000);
  const total = run ? run.end - run.start : length * 60000;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={type.label}>Focus session</Text>
        {!run && (
          <View style={styles.chips}>
            {LENGTHS.map((m) => (
              <Chip key={m} label={`${m} min`} active={length === m} onPress={() => setLength(m)} />
            ))}
          </View>
        )}
      </View>
      <View style={styles.row}>
        <Text style={styles.clock}>
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </Text>
        {run ? (
          <Pressable accessibilityRole="button" style={[styles.btn, styles.stop]} onPress={() => stop(false)} accessibilityLabel="Stop and log">
            <Ionicons name="stop" size={16} color={colors.text} />
            <Text style={styles.stopText}>Stop & log</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button"
            style={styles.btn}
            onPress={() => {
              const start = Date.now();
              setNow(start);
              setRun({ start, end: start + length * 60000 });
            }}
            accessibilityLabel="Start focus session"
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.btnText}>Start</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(1 - left / total) * 100}%` }]} />
      </View>
      <Text style={type.small}>{run ? 'Phone down, books open. Minutes are logged for you.' : 'Minutes are added to today when it ends.'}</Text>
    </View>
  );
}

const makeStyles = ({ colors, kinds, fonts, radius }: Theme) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginTop: 12,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', gap: 6 },
  clock: { fontFamily: fonts.monoMedium, fontSize: 40, color: colors.text, letterSpacing: -1 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: kinds.chinese.color, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
  stop: { backgroundColor: colors.primarySoft },
  stopText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  track: { height: 3, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: kinds.chinese.color },
});
