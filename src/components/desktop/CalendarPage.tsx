// The week calendar: Monday to Sunday in columns, an all-day lane for everything without a time, and the
// timed routines as blocks on a 05:00 to midnight grid, with the now line across today. Built from the same
// routines, to-dos, gym plan and shopping list as Today; a block opens its routine's form.
import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { dayPlan } from '../../lib/day';
import { practiceSubject } from '../../lib/language';
import { isDoneOn } from '../../lib/routines';
import { addDays, boughtOn, parseKey } from '../../lib/schedule';
import { useStore } from '../../lib/store';
import { clock } from '../../lib/timeline';
import { type Kind, type Theme, useStyles, useTheme } from '../../theme';
import { useShell } from './api';
import { Hover } from './Hover';
import { useNow } from './nav';
import { Fig, GlassButton, Page, Panel, Row } from './Page';
import { useShellMetrics } from './layout';

const START = 5;
const END = 24;
const GUTTER = 56;

function monday(key: string): string {
  const day = parseKey(key).getDay();
  return addDays(key, -((day + 6) % 7));
}

const dayName = (key: string, style: 'short' | 'long') => parseKey(key).toLocaleDateString('en-GB', { weekday: style });
const dayMonth = (key: string) => {
  const d = parseKey(key);
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
};

export function CalendarPage() {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const m = useShellMetrics();
  const shell = useShell();
  const { routines, inbox, groceries, gym, language, today } = useStore();
  const now = useNow();
  const [week, setWeek] = useState(() => monday(today));
  const hour = m.compact ? 44 : 48;
  // The grid opens scrolled to two hours before now.
  const grid = useRef<ComponentRef<typeof ScrollView>>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const state = useMemo(() => ({ routines, inbox, groceries, gym, language }), [routines, inbox, groceries, gym, language]);
  const plans = useMemo(() => days.map((d) => dayPlan(state, d, today)), [days, state, today]);
  const planned = plans.reduce((n, p) => n + p.total, 0);
  const done = plans.reduce((n, p) => n + p.done, 0);

  const allDay = (i: number) => {
    const p = plans[i];
    const d = days[i];
    const out: { key: string; title: string; kind: Kind }[] = [];
    for (const r of p.anytime)
      out.push({ key: r.id, title: r.target && r.target > 1 ? `${r.name} · ${r.target}` : r.name, kind: 'routines' });
    if (p.session) out.push({ key: 'gym', title: p.session.name, kind: 'gym' });
    if (p.showPractice)
      out.push({ key: 'practice', title: `${practiceSubject(language.languages)} · ${p.practice.target} min`, kind: 'chinese' });
    if (p.groceries.length)
      out.push({
        key: 'groceries',
        title: `Groceries · ${p.groceries.filter((g) => !boughtOn(g, d)).length || 'all bought'}`,
        kind: 'groceries',
      });
    for (const t of p.todos) out.push({ key: t.id, title: t.title, kind: 'inbox' });
    return out;
  };

  return (
    <Page
      title="Calendar"
      subtitle={
        <>
          {dayMonth(days[0])} to {dayMonth(days[6])} · <Fig>{planned}</Fig> {planned === 1 ? 'thing' : 'things'} planned · <Fig>{done}</Fig>{' '}
          done so far
        </>
      }
      actions={
        <>
          <Hover onPress={() => setWeek((w) => addDays(w, -7))} squeeze style={styles.round} accessibilityLabel="Previous week">
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Hover>
          <GlassButton label="This week" onPress={() => setWeek(monday(today))} />
          <Hover onPress={() => setWeek((w) => addDays(w, 7))} squeeze style={styles.round} accessibilityLabel="Next week">
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Hover>
        </>
      }
    >
      <Row>
        <Panel span={12} index={0}>
          <View style={styles.headRow}>
            <View style={{ width: GUTTER }} />
            {days.map((d) => {
              const isToday = d === today;
              return (
                <View
                  key={d}
                  style={styles.dayHead}
                  accessible
                  accessibilityLabel={`${dayName(d, 'long')} ${dayMonth(d)}${isToday ? ', today' : ''}`}
                >
                  <Text style={styles.dayName}>{dayName(d, 'short')}</Text>
                  <View style={[styles.dateDisc, isToday && { backgroundColor: colors.node }]}>
                    <Text style={[styles.date, isToday && { color: colors.onNode }]}>{parseKey(d).getDate()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={[styles.lane, { borderColor: colors.border }]}>
            <Text style={[styles.time, { width: GUTTER }]}>All day</Text>
            {days.map((d, i) => {
              const items = allDay(i);
              return (
                <View key={d} style={styles.laneCol}>
                  {items.slice(0, 3).map((it) => (
                    <View key={it.key} style={styles.chip}>
                      <View style={[styles.dot, { backgroundColor: kinds[it.kind].color }]} />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {it.title}
                      </Text>
                    </View>
                  ))}
                  {items.length > 3 ? <Text style={styles.more}>{items.length - 3} more</Text> : null}
                </View>
              );
            })}
          </View>
          <ScrollView
            ref={grid}
            style={{ height: Math.min(9, END - START) * hour }}
            // Room above the first hour and below the last, so their labels are never cut.
            contentContainerStyle={{ paddingVertical: 8 }}
            onLayout={() => grid.current?.scrollTo({ y: Math.max(0, (Math.floor(now / 60) - 2 - START) * hour), animated: false })}
          >
            <View style={{ height: (END - START) * hour, flexDirection: 'row' }}>
              <View style={{ width: GUTTER }}>
                {Array.from({ length: END - START }, (_, h) => (
                  <Text key={h} style={[styles.time, styles.hourLabel, { top: h * hour }]}>
                    {String(START + h).padStart(2, '0')}:00
                  </Text>
                ))}
              </View>
              {days.map((d, i) => (
                <View key={d} style={[styles.col, { borderColor: colors.border }]}>
                  {Array.from({ length: END - START }, (_, h) => (
                    <View key={h} style={[styles.hourLine, { top: h * hour, backgroundColor: colors.border }]} />
                  ))}
                  {/* The now line runs under the blocks, so it always lies on the pane. */}
                  {d === today && now >= START * 60 ? (
                    <View
                      style={[styles.nowLine, { top: ((now - START * 60) / 60) * hour, backgroundColor: colors.accent }]}
                      pointerEvents="none"
                    >
                      <View style={[styles.nowDot, { backgroundColor: colors.accent }]} />
                    </View>
                  ) : null}
                  {plans[i].timed.map((e) => {
                    const r = e.routine!;
                    const top = ((Math.max(e.start, START * 60) - START * 60) / 60) * hour;
                    const h = Math.max(22, ((e.end - e.start) / 60) * hour - 2);
                    const isDone = isDoneOn(r, d);
                    return (
                      <Hover
                        key={e.id}
                        onPress={() => shell.open('routine', r)}
                        outerStyle={[styles.blockAt, { top: top + 1, height: h }]}
                        style={[styles.block, { backgroundColor: kinds.routines.soft }]}
                        radius={10}
                        accessibilityLabel={`${e.title}, ${dayName(d, 'long')} ${clock(e.start)}${isDone ? ', done' : ''}. Edit`}
                      >
                        <View style={styles.blockRow}>
                          <View style={[styles.dot, { backgroundColor: kinds.routines.color }]} />
                          <Text
                            style={[styles.blockTitle, isDone && { color: colors.muted, textDecorationLine: 'line-through' }]}
                            numberOfLines={1}
                          >
                            {e.title}
                          </Text>
                        </View>
                        {h >= 40 ? (
                          <Text style={styles.blockMeta} numberOfLines={1}>
                            {clock(e.start)} · {e.end - e.start}
                            {' '}min
                          </Text>
                        ) : null}
                      </Hover>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Panel>
      </Row>
      <View style={styles.legend}>
        {(
          [
            ['routines', 'Routines'],
            ['gym', 'Gym'],
            ['chinese', 'Language'],
            ['groceries', 'Groceries'],
            ['inbox', 'To-dos'],
          ] as [Kind, string][]
        ).map(([k, label]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: kinds[k].color }]} />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
        <Text style={styles.legendText}>Phone calendar events show in the Android app.</Text>
      </View>
    </Page>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...insetBox },
    headRow: { flexDirection: 'row', height: 64, alignItems: 'center' },
    dayHead: { flex: 1, alignItems: 'center', gap: 2 },
    dayName: { ...type.label },
    dateDisc: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    date: { fontFamily: fonts.bodyMedium, fontSize: 18, color: colors.text, fontVariant: ['tabular-nums'] },
    lane: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 6, minHeight: 44 },
    laneCol: { flex: 1, gap: 4, paddingHorizontal: 3 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 6, height: 26, ...insetBox },
    chipText: { fontFamily: fonts.body, fontSize: 13, color: colors.text, flex: 1 },
    more: { ...type.caption, paddingLeft: 4 },
    time: { ...type.caption, color: colors.label, fontVariant: ['tabular-nums'] },
    hourLabel: { position: 'absolute', left: 0, marginTop: -8 },
    col: { flex: 1, borderLeftWidth: 1 },
    hourLine: { position: 'absolute', left: 0, right: 0, height: 1 },
    blockAt: { position: 'absolute', left: 3, right: 3 },
    block: { flex: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, ...insetBox },
    blockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    blockTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, flex: 1 },
    blockMeta: { ...type.caption, color: colors.muted },
    dot: { width: 8, height: 8, borderRadius: 4 },
    nowLine: { position: 'absolute', left: 0, right: 0, height: 2 },
    nowDot: { position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4 },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { ...type.small, color: colors.onSlabMuted },
  });
};
