import { StyleSheet, Text, View } from 'react-native';
import { weekStats } from '../lib/stats';
import { personalRecords } from '../lib/records';
import { formatWeight } from '../lib/gym';
import { WEEKDAY_SHORT, friendlyDate, parseKey } from '../lib/schedule';
import { useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Divider, Section } from './Section';
import { Sheet } from './Sheet';

/** "Your week": how the last seven days went, plus best streaks and lifts. */
export function StatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, routines, gym, chinese } = useStore();
  if (!visible) return null;
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
        {s.days.map((d) => (
          <View key={d.date} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.round((d.share ?? 0) * 100)}%`, backgroundColor: kinds.routines.color },
                ]}
              />
            </View>
            <Text style={[styles.barLabel, d.date === today && styles.barToday]}>{WEEKDAY_SHORT[parseKey(d.date).getDay()][0]}</Text>
          </View>
        ))}
      </View>

      {s.gymVolume > 0 && (
        <Text style={[type.small, styles.gap]}>
          You moved {Math.round(s.gymVolume).toLocaleString('en')} kg at the gym this week.
        </Text>
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
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const makeStyles = ({ colors, fonts, radius }: Theme) =>
  StyleSheet.create({
  flex: { flex: 1 },
  gap: { marginTop: 12 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 12,
    gap: 2,
  },
  tileValue: { fontFamily: fonts.display, fontSize: 26 },
  bars: { flexDirection: 'row', gap: 8, height: 90, marginTop: 16 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', borderRadius: 6, backgroundColor: colors.primarySoft, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
  barToday: { color: colors.text, fontFamily: fonts.monoMedium },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  num: { fontFamily: fonts.monoMedium, fontSize: 14, color: colors.text },
  empty: { padding: 16, fontFamily: fonts.body, fontSize: 14, color: colors.muted },
});
