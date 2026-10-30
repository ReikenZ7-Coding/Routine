import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type DayMarks, monthGrid, weekOf } from '../lib/agenda';
import { addDays, parseKey } from '../lib/schedule';
import { colors, fonts, kinds, type } from '../theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DOT_ORDER = ['routines', 'gym', 'chinese', 'groceries'] as const;

interface Props {
  selected: string;
  today: string;
  expanded: boolean;
  /** Dates (YYYY-MM-DD) that have events in the phone's calendar. */
  busy: Set<string>;
  marksFor: (date: string) => DayMarks;
  /** Mood face logged for a day, if any. */
  moodFor?: (date: string) => string | undefined;
  onSelect: (date: string) => void;
}

/** A week strip that opens into a month. Each day shows a dot per kind of thing planned. */
export function CalendarStrip({ selected, today, expanded, busy, marksFor, moodFor, onSelect }: Props) {
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
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel={expanded ? 'Previous month' : 'Previous week'}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
        </Pressable>
        <View style={styles.letters}>
          {LETTERS.map((l, i) => (
            <Text key={i} style={styles.letter}>
              {l}
            </Text>
          ))}
        </View>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel={expanded ? 'Next month' : 'Next week'}>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
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
              <Pressable
                key={date}
                style={styles.day}
                onPress={() => onSelect(date)}
                accessibilityLabel={parseKey(date).toDateString()}
                accessibilityState={{ selected: isSel }}
              >
                <View style={[styles.num, isSel && styles.numSelected, !isSel && isToday && styles.numToday]}>
                  <Text style={[styles.numText, isSel && styles.numTextSelected, date < today && !isSel && styles.past]}>
                    {Number(date.slice(8))}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {DOT_ORDER.filter((k) => marks[k]).map((k) => (
                    <View key={k} style={[styles.dot, { backgroundColor: kinds[k].color }]} />
                  ))}
                  {busy.has(date) && <View style={[styles.dot, styles.busyDot]} />}
                </View>
                {mood ? <Text style={styles.mood}>{mood}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 20, gap: 2 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  letters: { flex: 1, flexDirection: 'row' },
  letter: { ...type.label, flex: 1, textAlign: 'center', letterSpacing: 0 },
  week: { flexDirection: 'row', marginHorizontal: 22 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 4 },
  num: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numSelected: { backgroundColor: colors.text },
  numToday: { borderWidth: 1.5, borderColor: colors.text },
  numText: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.text },
  numTextSelected: { color: '#fff' },
  past: { color: colors.faint },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  mood: { position: 'absolute', top: 0, right: 2, fontSize: 10 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  busyDot: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.muted },
});
