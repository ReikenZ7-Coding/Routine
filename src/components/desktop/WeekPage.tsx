// Your week as a page: the phone's sentence, the week chart larger than on Overview, the best streaks ranked with
// their bars, the personal records, and when in the week things get done (the last four weeks, by weekday and part
// of the day). The same sums as the phone's Your week sheet (lib/stats, lib/records).
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatWeight } from '../../lib/gym';
import { practiceSubject } from '../../lib/language';
import { plural } from '../../lib/plural';
import { personalRecords } from '../../lib/records';
import { streak } from '../../lib/routines';
import { friendlyDate } from '../../lib/schedule';
import { type DayPart, type WhenCell, weekStats, whenDone } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { Bar } from '../Motion';
import { Hover } from './Hover';
import { Empty } from './Kit';
import { WeekPanel } from './Overview';
import { Fig, Page, Panel, Row } from './Page';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PARTS: [DayPart, string, string][] = [
  ['morning', 'Morning', 'mornings'],
  ['afternoon', 'Afternoon', 'afternoons'],
  ['evening', 'Evening', 'evenings'],
  ['anytime', 'Anytime', 'anytime'],
];

export function WeekPage() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, routines, gym, language } = useStore();
  const s = useMemo(() => weekStats(routines, gym, language, today), [routines, gym, language, today]);
  const pct = s.routinesPlanned ? Math.round((100 * s.routinesDone) / s.routinesPlanned) : null;
  const prs = useMemo(() => personalRecords(gym.logs).slice(0, 6), [gym.logs]);
  const streaks = useMemo(
    () =>
      routines
        .map((r) => ({ id: r.id, name: r.name, streak: streak(r, today) }))
        .filter((x) => x.streak > 1)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 6),
    [routines, today],
  );
  const top = streaks[0]?.streak ?? 1;

  return (
    <Page
      title="Your week"
      subtitle={
        <>
          {pct === null ? (
            'No routines were planned'
          ) : (
            <>
              <Fig>{pct}%</Fig> of routines done
            </>
          )}
          {', '}
          <Fig>{plural(s.gymDays, 'gym day')}</Fig> and <Fig>{`${s.practiceMinutes} min`}</Fig> of {practiceSubject(language.languages)}{' '}
          practice.
        </>
      }
    >
      <Row>
        <WeekPanel span={8} index={0} tall />
        <Panel span={4} index={1} title="Best streaks" subtitle="Routines done every time, up to today">
          {streaks.length === 0 ? (
            <Empty>Do a routine two times in a row to start a streak.</Empty>
          ) : (
            <View role="list" style={styles.ranks}>
              {streaks.map((b, i) => (
                <View
                  key={b.id}
                  role="listitem"
                  style={styles.rank}
                  accessible
                  accessibilityLabel={`${i + 1}. ${b.name}, ${b.streak} in a row`}
                >
                  <View style={styles.rankHead}>
                    <Text style={styles.rankNo}>{i + 1}</Text>
                    <Text style={[type.bodyMedium, styles.flex]} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.num}>{b.streak} in a row</Text>
                  </View>
                  <Bar progress={b.streak / top} color={kinds.routines.color} track={colors.track} height={8} />
                </View>
              ))}
            </View>
          )}
        </Panel>
      </Row>
      <Row>
        <Panel span={6} index={2} title="Personal records" subtitle="Your heaviest set of each lift">
          {prs.length === 0 ? (
            <Empty>Log a workout and your best lifts show up here.</Empty>
          ) : (
            <View role="list">
              {prs.map((p, i) => (
                <View key={p.name} role="listitem" style={[styles.row, i > 0 && styles.rule]}>
                  <View style={styles.flex}>
                    <Text style={type.bodyMedium}>{p.name}</Text>
                    <Text style={type.small}>{friendlyDate(p.date, today)}</Text>
                  </View>
                  <Text style={styles.num}>
                    {formatWeight(p.weight)} × {p.reps}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {s.gymVolume > 0 ? (
            <Text style={[type.small, styles.volume]}>
              You moved {Math.round(s.gymVolume).toLocaleString('en')} kg at the gym this week.
            </Text>
          ) : null}
        </Panel>
        <WhenPanel />
      </Row>
    </Page>
  );
}

/** When things get done: a cell per weekday and part of the day, filled by the share done over four weeks. */
function WhenPanel() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { routines, today } = useStore();
  const grid = useMemo(() => whenDone(routines, today, 28), [routines, today]);
  const [read, setRead] = useState<string | null>(null);
  const parts = PARTS.filter(([p]) => grid[p].some((c) => c.planned));
  const say = (day: number, part: string, c: WhenCell) =>
    `${WEEKDAYS[day]}s, ${part}: ${c.planned ? `${c.done} of ${c.planned} done` : 'nothing planned'}`;
  return (
    <Panel span={6} index={3} title="When things get done" subtitle="Routines over the last 4 weeks, by weekday">
      {parts.length === 0 ? (
        <Empty>Plan a routine and this fills in over the weeks.</Empty>
      ) : (
        <>
          <View style={styles.heatHead}>
            <View style={styles.heatLabel} />
            {WEEKDAYS.map((d) => (
              <Text key={d} style={[type.label, styles.heatDay]}>
                {d.slice(0, 3)}
              </Text>
            ))}
          </View>
          {parts.map(([p, label, many]) => (
            <View key={p} style={styles.heatRow}>
              <Text style={[type.small, styles.heatLabel]}>{label}</Text>
              {grid[p].map((c, d) => {
                const sentence = say(d, many, c);
                const share = c.planned ? c.done / c.planned : 0;
                return (
                  <Hover
                    key={d}
                    outerStyle={styles.heatSlot}
                    style={[
                      styles.heatCell,
                      c.planned
                        ? { backgroundColor: colors.track }
                        : { borderColor: colors.controlBorder, borderStyle: 'dashed', borderWidth: 1 },
                    ]}
                    radius={8}
                    accessibilityLabel={sentence}
                    onHoverChange={(on) => setRead(on ? sentence : null)}
                    onFocusChange={(on) => setRead(on ? sentence : null)}
                  >
                    {c.planned && c.done ? (
                      <View style={[styles.heatFill, { backgroundColor: kinds.routines.color, opacity: 0.25 + 0.75 * share }]} />
                    ) : null}
                  </Hover>
                );
              })}
            </View>
          ))}
          <Text style={[type.small, styles.heatRead]} accessibilityLiveRegion="polite">
            {read ?? 'A fuller square means more of what was planned got done. Point at one, or Tab to it, to read it.'}
          </Text>
        </>
      )}
    </Panel>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    ranks: { gap: 16 },
    rank: { gap: 8 },
    rankHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rankNo: { width: 20, fontFamily: fonts.bodyBold, fontSize: 15, color: colors.muted, fontVariant: ['tabular-nums'] },
    num: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
    rule: { borderTopWidth: 1, borderTopColor: colors.border },
    volume: { marginTop: 12 },
    heatHead: { flexDirection: 'row', gap: 6, marginBottom: 6 },
    heatRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 },
    heatLabel: { width: 84 },
    heatDay: { flex: 1, textAlign: 'center' },
    heatSlot: { flex: 1, minWidth: 0 },
    heatCell: { height: 40, borderRadius: 8, overflow: 'hidden' },
    heatFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8 },
    heatRead: { marginTop: 8, minHeight: 20 },
  });
