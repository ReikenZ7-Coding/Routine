import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { FadeSwap, Press, SelectFade } from './Motion';
import { type DayMarks, monthGrid, weekOf } from '../lib/agenda';
import { MOODS, type Mood } from '../lib/journal';
import { addDays, parseKey } from '../lib/schedule';
import { type Theme, useStyles, useTheme } from '../theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DOT_ORDER = ['routines', 'gym', 'chinese', 'groceries'] as const;

interface Props {
  selected: string;
  today: string;
  expanded: boolean;
  /** Dates (YYYY-MM-DD) that have events in the phone's calendar. */
  busy: Set<string>;
  marksFor: (date: string) => DayMarks;
  /** The mood logged for a day, if any (a small dot in the day's corner). */
  moodFor?: (date: string) => Mood | undefined;
  onSelect: (date: string) => void;
}

/** A week strip that opens into a month. Each day shows a dot per kind of thing planned. */
export function CalendarStrip({ selected, today, expanded, busy, marksFor, moodFor, onSelect }: Props) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const rows = expanded ? monthGrid(selected) : [weekOf(selected)];

  const shift = (dir: -1 | 1) => {
    if (!expanded) return onSelect(addDays(selected, 7 * dir));
    const d = parseKey(selected);
    const target = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d.getDate(), last));
    onSelect(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Press
          onPress={() => shift(-1)}
          style={styles.navBtn}
          overlay={colors.material.pressFill}
          accessibilityLabel={expanded ? 'Previous month' : 'Previous week'}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Press>
        <View style={styles.letters}>
          {LETTERS.map((l, i) => (
            <Text key={i} style={styles.letter}>
              {l}
            </Text>
          ))}
        </View>
        <Press
          onPress={() => shift(1)}
          style={styles.navBtn}
          overlay={colors.material.pressFill}
          accessibilityLabel={expanded ? 'Next month' : 'Next week'}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Press>
      </View>

      {rows.map((week, wi) => (
        <View key={wi} style={styles.week}>
          {week.map((date, di) => {
            if (!date) return <View key={di} style={styles.day} />;
            const isSel = date === selected;
            const isToday = date === today;
            const marks = marksFor(date);
            const mood = moodFor?.(date);
            return (
              <Press
                key={date}
                outerStyle={styles.daySlot}
                style={styles.day}
                onPress={() => onSelect(date)}
                accessibilityLabel={`${parseKey(date).toDateString()}${mood ? `, mood ${MOODS[mood - 1].label}` : ''}`}
                accessibilityState={{ selected: isSel }}
              >
                <View style={[styles.num, isToday && styles.numToday]}>
                  <SelectFade on={isSel} radius={12} bleed={isToday ? 1.5 : 0} style={styles.numSelected} />
                  <FadeSwap
                    on={isSel}
                    off={<Text style={[styles.numText, date < today && styles.past]}>{Number(date.slice(8))}</Text>}
                    onContent={<Text style={[styles.numText, styles.numTextSelected]}>{Number(date.slice(8))}</Text>}
                  />
                </View>
                <View style={styles.dots}>
                  {DOT_ORDER.filter((k) => marks[k]).map((k) => (
                    <View key={k} style={[styles.dot, { backgroundColor: kinds[k].color }]} />
                  ))}
                  {busy.has(date) && <View style={[styles.dot, styles.busyDot]} />}
                </View>
                {mood ? <View style={styles.mood} /> : null}
              </Press>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    wrap: { marginTop: 20, gap: 2 },
    nav: { flexDirection: 'row', alignItems: 'center' },
    navBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    letters: { flex: 1, flexDirection: 'row' },
    letter: { ...type.label, flex: 1, textAlign: 'center', letterSpacing: 0 },
    week: { flexDirection: 'row', marginHorizontal: 22 },
    daySlot: { flex: 1 },
    day: { alignItems: 'center', paddingVertical: 4, gap: 4, minHeight: 48, borderRadius: 12 },
    num: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    numSelected: {
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    numToday: { borderWidth: 1.5, borderColor: colors.text },
    numText: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
    numTextSelected: { color: colors.onPrimary },
    past: { color: colors.faint },
    dots: { flexDirection: 'row', gap: 3, height: 5 },
    mood: { position: 'absolute', top: 2, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.streak },
    dot: { width: 5, height: 5, borderRadius: 2.5 },
    busyDot: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.muted },
  });
