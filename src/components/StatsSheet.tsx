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
import { alphaOf } from './glass/colour';
import { EASE_OUT, useReduceMotion } from './Motion';
import { Divider, Section } from './Section';
import { Sheet } from './Sheet';
import { practiceSubject } from '../lib/language';

/** "Your week": how the last seven days went, plus best streaks and lifts. */
export function StatsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { kinds, type, name } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, routines, gym, language } = useStore();
  // Always built (it is cheap), so the sheet keeps its content while it slides away.
  const s = weekStats(routines, gym, language, today);
  const pct = s.routinesPlanned ? Math.round((100 * s.routinesDone) / s.routinesPlanned) : null;
  const prs = personalRecords(gym.logs).slice(0, 5);

  return (
    <Sheet visible={visible} title="Your week" onClose={onClose}>
      <Text style={type.small}>The last 7 days, up to today.</Text>

      {/* The week in one sentence, then the days themselves as the picture. */}
      <Text style={styles.summary}>
        {pct === null ? (
          'No routines were planned'
        ) : (
          <>
            <Text style={styles.strong}>{pct}%</Text> of routines done
          </>
        )}
        {', '}
        <Text style={styles.strong}>{plural(s.gymDays, 'gym day').replace(' ', '\u00A0')}</Text>
        {' and '}
        <Text style={styles.strong}>{`${s.practiceMinutes}\u00A0min`}</Text> of {practiceSubject(language.languages)} practice.
      </Text>

      <Glass style={styles.week}>
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
                {name === 'paper' ? (
                  // Paper marks today with a small ink-glass disc behind its letter.
                  <View style={[styles.dayDisc, d.date === today && styles.dayDiscToday]}>
                    <Text style={[styles.barLabel, d.date === today && styles.barTodayOnInk]}>
                      {WEEKDAY_SHORT[parseKey(d.date).getDay()][0]}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.barLabel, d.date === today && styles.barToday]}>{WEEKDAY_SHORT[parseKey(d.date).getDay()][0]}</Text>
                )}
              </View>
            );
          })}
        </View>
      </Glass>

      {s.gymVolume > 0 && (
        <Text style={[type.small, styles.gap, name === 'paper' && styles.moved]}>
          You moved {Math.round(s.gymVolume).toLocaleString('en')} kg at the gym this week.
        </Text>
      )}

      <Section title="Best streaks" dot={name === 'paper' ? undefined : kinds.routines.color}>
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

      <Section title="Personal records" dot={name === 'paper' ? undefined : kinds.gym.color}>
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
  const stone = name === 'stone';
  const paper = name === 'paper';
  const orb = colors.material.orb;
  return StyleSheet.create({
    moved: { fontSize: 15, lineHeight: 21 },
    dayDisc: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    dayDiscToday: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    barTodayOnInk: { color: colors.onPrimary, fontFamily: fonts.bodyBold },
    flex: { flex: 1 },
    gap: { marginTop: 12 },
    summary: { marginTop: 14, fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.text },
    strong: { fontFamily: fonts.bodyBold, fontVariant: ['tabular-nums'] },
    week: { marginTop: 16, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 },
    bars: { flexDirection: 'row', gap: 8, height: 148 },
    barCol: { flex: 1, alignItems: 'center', gap: 6 },
    barTrack: {
      flex: 1,
      width: '100%',
      borderRadius: stone || paper ? 8 : 6,
      // Stone's empty days are frosted glass slots, not dark grooves.
      backgroundColor: stone ? colors.material.inset.fill : colors.track,
      ...(stone ? { borderWidth: 1, borderColor: colors.material.inset.border, borderTopColor: colors.material.inset.borderTop } : null),
      overflow: 'hidden',
    },
    barFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 6, transformOrigin: 'bottom' },
    // Lavender's bars are lit from the top: white fading into the routine pastel.
    barLight: lavender
      ? { backgroundImage: `linear-gradient(180deg, ${colors.node}, ${kinds.routines.color})` }
      : stone
        ? { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` }
        : paper
          ? // Paper's bars: the routine blue, a touch lighter at the top, with a lit top edge.
            {
              borderRadius: 8,
              backgroundImage: `linear-gradient(180deg, ${alphaOf(colors.material.rimTop, 0.18)}, ${alphaOf(colors.material.rimTop, 0)})`,
              boxShadow: `inset 0px 1px 0px ${alphaOf(colors.material.rimTop, 0.45)}`,
            }
          : orb
            ? // Pine: moonlit mint, brightest at the top, with a lit top edge
              {
                borderRadius: 8,
                backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${kinds.routines.color} 45%, ${alphaOf(kinds.routines.color, 0.72)})`,
                boxShadow: `inset 0px 1px 0px ${alphaOf(colors.material.rimTop, 0.9)}`,
              }
            : {},
    todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text, marginBottom: -2 },
    hidden: { opacity: 0 },
    barLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    barToday: { color: orb ? colors.accent : colors.text, fontFamily: fonts.bodyBold },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    // "4 in a row", "40 kg × 8": words with their numbers, so a sans with tabular figures (never mono for words)
    num: { fontFamily: fonts.bodyBold, fontSize: stone ? 15 : 14, color: colors.text, fontVariant: ['tabular-nums'] },
    empty: { padding: 16, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  });
};
