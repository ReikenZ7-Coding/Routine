import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { Segmented } from './Segmented';
import { Button } from './Button';
import { Bar, Collapse, Press } from './Motion';

const LENGTHS = [15, 25];

/** A focus countdown that logs the minutes practised when it ends or is stopped. */
export function FocusTimer({
  onLog,
  bare,
}: {
  onLog: (minutes: number) => void;
  /** Content only, without its own title: the desktop puts it in a panel. */ bare?: boolean;
}) {
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

  const Box = bare ? View : Glass;
  return (
    <Box style={bare ? styles.bare : styles.card}>
      {/* The length switch has its own row under the title, so the title never wraps beside it; it folds away
          while a session runs. */}
      <View>
        {bare ? null : (
          <Text style={styles.title} accessibilityRole="header">
            Focus session
          </Text>
        )}
        <Collapse open={!run}>
          <View style={bare ? undefined : styles.lengths}>
            <Segmented
              accessibilityLabel="Session length"
              options={LENGTHS.map((m) => ({ key: String(m), label: `${m} min` }))}
              value={String(length)}
              onChange={(k) => setLength(Number(k))}
            />
          </View>
        </Collapse>
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
    </Box>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    card: { padding: 16, marginTop: 12, gap: 12 },
    bare: { gap: 12 },
    title: type.sectionTitle,
    lengths: { marginTop: 12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    // One clock in every look: a big numeral in the look's numeral face (a sans with steady tabular figures, never
    // mono), in one size and one box.
    clock: {
      fontFamily: fonts.numeral,
      fontSize: 52,
      lineHeight: 56,
      color: colors.text,
      letterSpacing: -1.2,
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
