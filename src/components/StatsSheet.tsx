import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { weekStats } from '../lib/stats';
import { personalRecords } from '../lib/records';
import { formatWeight } from '../lib/gym';
import { plural } from '../lib/plural';
import { WEEKDAY_SHORT, friendlyDate, parseKey } from '../lib/schedule';
import { useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { EASE_OUT, useReduceMotion } from './Motion';
import { Divider, Section } from './Section';
import { Sheet } from './Sheet';

/** "Your week": how the last seven days went, plus best streaks and lifts. */
export function StatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { kinds, type, name } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, routines, gym, chinese } = useStore();
  // Always built (it is cheap), so the sheet keeps its content while it slides away.
  const s = weekStats(routines, gym, chinese, today);
  const pct = s.routinesPlanned ? Math.round((100 * s.routinesDone) / s.routinesPlanned) : null;
  const prs = personalRecords(gym.logs).slice(0, 5);

  return (
    <Sheet visible={visible} title="Your week" onClose={onClose}>
      <Text style={type.small}>The last 7 days, up to today.</Text>

      <View style={styles.tiles}>
        <Tile value={pct === null ? '–' : `${pct}%`} label="routines done" color={kinds.routines.color} />
        <Tile value={String(s.gymDays)} label={s.gymDays === 1 ? 'gym day' : 'gym days'} color={kinds.gym.color} />
        <Tile value={String(s.chineseMinutes)} label="min Chinese" color={kinds.chinese.color} />
      </View>

      <View style={styles.bars}>
        {s.days.map((d, i) => {
          const day = parseKey(d.date).toLocaleDateString('en', { weekday: 'long' });
          return (
            <View
              key={d.date}
              style={styles.barCol}
              accessible
              accessibilityLabel={d.planned ? `${day}, ${d.done} of ${plural(d.planned, 'routine')}` : `${day}, nothing planned`}
            >
              <DayBar share={d.share ?? 0} index={i} shown={visible} />
              {name === 'lavender' && <View style={[styles.todayDot, d.date !== today && styles.hidden]} />}
              <Text style={[styles.barLabel, d.date === today && styles.barToday]}>{WEEKDAY_SHORT[parseKey(d.date).getDay()][0]}</Text>
            </View>
          );
        })}
      </View>

      {s.gymVolume > 0 && (
        <Text style={[type.small, styles.gap]}>You moved {Math.round(s.gymVolume).toLocaleString('en')} kg at the gym this week.</Text>
      )}

      <Section title="Best streaks" dot={kinds.routines.color}>
        {s.bestStreaks.length === 0 ? (
          <Text style={styles.empty}>Do a routine two times in a row to start a streak.</Text>
        ) : (
          s.bestStreaks.map((b, i) => (
            <View key={b.name}>
              {i > 0 && <Divider inset={16} />}
              <View style={styles.row}>
                <Text style={[type.bodyMedium, styles.flex]}>{b.name}</Text>
                <Text style={styles.num}>{b.streak} in a row</Text>
              </View>
            </View>
          ))
        )}
      </Section>

      <Section title="Personal records" dot={kinds.gym.color}>
        {prs.length === 0 ? (
          <Text style={styles.empty}>Log a workout and your best lifts show up here.</Text>
        ) : (
          prs.map((p, i) => (
            <View key={p.name}>
              {i > 0 && <Divider inset={16} />}
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={type.bodyMedium}>{p.name}</Text>
                  <Text style={type.small}>{friendlyDate(p.date, today)}</Text>
                </View>
                <Text style={styles.num}>
                  {formatWeight(p.weight)} × {p.reps}
                </Text>
              </View>
            </View>
          ))
        )}
      </Section>
    </Sheet>
  );
}

function Tile({ value, label, color }: { value: string; label: string; color: string }) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Glass style={styles.tile}>
      <View style={[styles.tileLine, { backgroundColor: color }]} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </Glass>
  );
}

const GROW = { duration: 600, easing: EASE_OUT };

/**
 * One day's bar: the fill grows up from the bottom (scaleY from a 2% sliver to its share, 600ms, each day 40ms
 * after the one before) each time the sheet opens. A day with nothing done keeps only its track. Under reduced
 * motion the bars are simply drawn at their share.
 */
function DayBar({ share, index, shown }: { share: number; index: number; shown: boolean }) {
  const { kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const target = Math.max(0, Math.min(1, share));
  const scale = useSharedValue(reduced ? target : 0.02);
  useEffect(() => {
    if (!shown || target === 0) return;
    if (reduced) return scale.set(target);
    scale.set(0.02);
    scale.set(withDelay(index * 40, withTiming(target, GROW)));
  }, [shown, target, reduced, index, scale]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.get() }] }));
  return (
    <View style={styles.barTrack}>
      {target > 0 && <Animated.View style={[styles.barFill, { backgroundColor: kinds.routines.color }, styles.barLight, grow]} />}
    </View>
  );
}

const makeStyles = ({ colors, kinds, fonts, name }: Theme) => {
  const lavender = name === 'lavender';
  return StyleSheet.create({
    flex: { flex: 1 },
    gap: { marginTop: 12 },
    tiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
    tile: { flex: 1, padding: 12, gap: 2 },
    tileLine: { width: 20, height: 3, borderRadius: 2, marginBottom: 8 },
    tileValue: {
      fontFamily: fonts.display,
      fontSize: lavender ? 30 : 26,
      lineHeight: lavender ? 36 : 32,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    bars: { flexDirection: 'row', gap: 8, height: 96, marginTop: 16 },
    barCol: { flex: 1, alignItems: 'center', gap: 6 },
    barTrack: {
      flex: 1,
      width: '100%',
      borderRadius: 6,
      backgroundColor: colors.track,
      overflow: 'hidden',
    },
    barFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, transformOrigin: 'bottom' },
    // Lavender's bars are lit from the top: white fading into the routine pastel.
    barLight: lavender ? { backgroundImage: `linear-gradient(180deg, ${colors.node}, ${kinds.routines.color})` } : {},
    todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text, marginBottom: -2 },
    hidden: { opacity: 0 },
    barLabel: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },
    barToday: { color: colors.text, fontFamily: fonts.monoMedium },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    num: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
    empty: { padding: 16, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  });
};
