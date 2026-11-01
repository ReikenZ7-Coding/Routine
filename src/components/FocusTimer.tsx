import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { Segmented } from './Hub';
import { Button } from './Button';
import { Bar, Press } from './Motion';

const LENGTHS = [15, 25];

/** A focus countdown that logs the minutes practised when it ends or is stopped. */
export function FocusTimer({ onLog }: { onLog: (minutes: number) => void }) {
  const { colors, kinds, type } = useTheme();
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
    <Glass style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title} accessibilityRole="header">
          Focus session
        </Text>
        {!run && (
          <View style={styles.lengths}>
            <Segmented
              accessibilityLabel="Session length"
              options={LENGTHS.map((m) => ({ key: String(m), label: `${m} min` }))}
              value={String(length)}
              onChange={(k) => setLength(Number(k))}
            />
          </View>
        )}
      </View>
      <View style={styles.row}>
        <Text style={styles.clock} accessibilityLabel={`${Math.floor(secs / 60)} minutes ${secs % 60} seconds ${run ? 'left' : ''}`}>
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}
        </Text>
        {run ? (
          <Press
            style={[styles.btn, styles.stop]}
            overlay={colors.material.pressFill}
            onPress={() => stop(false)}
            accessibilityLabel="Stop and log"
          >
            <Ionicons name="stop" size={16} color={colors.text} />
            <Text style={styles.stopText}>Stop & log</Text>
          </Press>
        ) : (
          <Button
            label="Start"
            icon="play"
            onPress={() => {
              const start = Date.now();
              setNow(start);
              setRun({ start, end: start + length * 60000 });
            }}
            accessibilityLabel={`Start a ${length} minute focus session`}
          />
        )}
      </View>
      <Bar progress={1 - left / total} color={kinds.chinese.color} track={colors.track} height={4} />
      <Text style={type.hint}>
        {run ? 'Phone down, books open. Minutes are logged for you.' : 'Minutes are added to today when it ends.'}
      </Text>
    </Glass>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    card: { padding: 16, marginTop: 12, gap: 12 },
    title: { ...type.sectionTitle, flexShrink: 1 },
    lengths: { width: 164 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    clock: {
      fontFamily: fonts.monoMedium,
      fontSize: 40,
      lineHeight: 48,
      color: colors.text,
      letterSpacing: -1,
      fontVariant: ['tabular-nums'],
    },
    btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 18, minHeight: 48 },
    stop: {
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    stopText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  });
