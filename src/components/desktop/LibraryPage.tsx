// The Library on the desktop is the routines shelf as a table: a search field and the When and Repeat filters on
// one line, then today's routines, the ones not on today and the ideas still to add, one 64 dp row each. The
// shopping list has its own page (Groceries). The same filters and words as the phone's Library.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import {
  ROUTINE_IDEAS,
  type Routine,
  TIME_LABELS,
  countOn,
  iconFor,
  isDoneOn,
  isScheduled,
  isSkipped,
  sortByTime,
  streak,
  tapRoutine,
} from '../../lib/routines';
import { describeRepeat } from '../../lib/schedule';
import { newId, useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { type RepeatFilter, type WhenFilter, matchesRepeat } from '../../screens/RoutinesScreen';
import { useShell } from './api';
import { Hover } from './Hover';
import { ChipRow, GroupHead, IconButton, Pebble, SearchField, Tick, useRowText } from './Kit';
import { Fig, GlassButton, Page, Panel, Row } from './Page';

/** "Every day · 21:00 · 10 min" */
function schedule(r: Pick<Routine, 'repeat' | 'start' | 'duration' | 'time' | 'target'>): string {
  return [
    describeRepeat(r.repeat),
    r.start ?? TIME_LABELS[r.time],
    r.duration ? `${r.duration} min` : '',
    r.target && r.target > 1 ? `${r.target} times` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function LibraryPage() {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const shell = useShell();
  const { today, routines: all, updateRoutines } = useStore();
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState<WhenFilter>('all');
  const [repeat, setRepeat] = useState<RepeatFilter>('all');
  const q = query.trim().toLowerCase();
  const filtered = all.filter((r) => (when === 'all' || r.time === when) && matchesRepeat(r, repeat));
  const routines = q ? filtered.filter((r) => r.name.toLowerCase().includes(q)) : filtered;
  const filtering = q.length > 0 || when !== 'all' || repeat !== 'all';
  const todays = sortByTime(routines.filter((r) => isScheduled(r, today)));
  const others = sortByTime(routines.filter((r) => !isScheduled(r, today) && r.repeat.kind !== 'once'));
  const ideas = ROUTINE_IDEAS.filter((idea) => !all.some((r) => r.name === idea.name));
  const addIdea = (idea: (typeof ROUTINE_IDEAS)[number]) => updateRoutines((rs) => [...rs, { ...idea, id: newId(), doneDates: [] }]);
  const planned = all.filter((r) => isScheduled(r, today) && !isSkipped(r, today));
  const plannedNow = todays.filter((r) => !isSkipped(r, today));
  const doneNow = plannedNow.filter((r) => isDoneOn(r, today)).length;
  const tap = (r: Routine) => updateRoutines((rs) => rs.map((x) => (x.id === r.id ? tapRoutine(x, today) : x)));

  return (
    <Page
      title="Library"
      subtitle={
        all.length ? (
          <>
            <Fig>{all.length}</Fig> {all.length === 1 ? 'routine' : 'routines'} ·{' '}
            <Fig>
              {planned.filter((r) => isDoneOn(r, today)).length} of {planned.length}
            </Fig>{' '}
            done today
          </>
        ) : (
          'Your routines, all in one place.'
        )
      }
      actions={<GlassButton label="New routine" icon="add" onPress={() => shell.open('routine')} />}
    >
      {all.length === 0 ? (
        <Row>
          <Panel span={8} index={0} title="Your own routines" subtitle="Anything you want to do regularly">
            <Text style={[styles.body, styles.intro]}>
              Stretching, reading, cleaning, taking vitamins. Click an idea to add it, or make your own.
            </Text>
            {ROUTINE_IDEAS.map((idea, i) => (
              <IdeaRow key={idea.name} idea={idea} first={i === 0} onAdd={() => addIdea(idea)} />
            ))}
          </Panel>
        </Row>
      ) : (
        <>
          <View style={styles.toolbar}>
            <SearchField id="library-search" label="Search routines" value={query} onChange={setQuery} placeholder="Name of a routine" />
            <ChipRow
              caption="When"
              value={when}
              onChange={setWhen}
              options={[
                { key: 'all', label: 'All' },
                { key: 'morning', label: 'Morning', icon: 'sunny-outline' },
                { key: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline' },
                { key: 'evening', label: 'Evening', icon: 'moon-outline' },
                { key: 'anytime', label: 'Anytime', icon: 'time-outline' },
              ]}
            />
            <ChipRow
              caption="Repeat"
              value={repeat}
              onChange={setRepeat}
              options={[
                { key: 'all', label: 'Any' },
                { key: 'daily', label: 'Every day' },
                { key: 'some', label: 'Some days' },
                { key: 'once', label: 'One-off' },
              ]}
            />
          </View>
          <Row>
            <Panel span={12} index={0}>
              {q && routines.length === 0 ? (
                <View style={styles.noMatch}>
                  <Ionicons name="search-outline" size={28} color={colors.muted} />
                  <Text style={styles.body}>Nothing matches “{query.trim()}”</Text>
                  <GlassButton label="Clear search" onPress={() => setQuery('')} />
                </View>
              ) : (
                <>
                  <GroupHead
                    first
                    label={`Today · ${doneNow} of ${plannedNow.length} done`}
                    right={todays.length ? `${todays.length} on today` : undefined}
                  />
                  {todays.length === 0 ? (
                    <Text style={[styles.body, styles.none]}>{filtering ? 'Nothing here matches.' : 'Nothing scheduled today.'}</Text>
                  ) : (
                    todays.map((r) => (
                      <RoutineRow key={r.id} routine={r} today={today} onTick={() => tap(r)} onMore={() => shell.open('routine', r)} />
                    ))
                  )}
                  {others.length > 0 ? (
                    <>
                      <GroupHead label="Not today" right={String(others.length)} />
                      {others.map((r) => (
                        <RoutineRow key={r.id} routine={r} today={today} quiet onMore={() => shell.open('routine', r)} />
                      ))}
                    </>
                  ) : null}
                  {ideas.length > 0 && !filtering ? (
                    <>
                      <GroupHead label="Ideas" right="Click to add" />
                      {ideas.map((idea) => (
                        <IdeaRow key={idea.name} idea={idea} onAdd={() => addIdea(idea)} />
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </Panel>
          </Row>
        </>
      )}
    </Page>
  );
}

/** A routine as a table row: pebble, name and schedule, streak, reminder, tick and more. */
function RoutineRow({
  routine: r,
  today,
  onTick,
  onMore,
  quiet,
}: {
  routine: Routine;
  today: string;
  onTick?: () => void;
  onMore: () => void;
  quiet?: boolean;
}) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const text = useRowText();
  const done = isDoneOn(r, today);
  const skipped = isSkipped(r, today);
  const counter = !!r.target && r.target > 1;
  const days = streak(r, today);
  return (
    <View style={styles.row}>
      <Pebble icon={iconFor(r)} ink={kinds.routines.text} dim={quiet || done || skipped} />
      <View style={styles.flex}>
        <Text style={[text.rowTitle, (done || skipped) && text.struck]} numberOfLines={1}>
          {r.name}
        </Text>
        <Text style={text.rowMeta} numberOfLines={1}>
          {skipped ? 'Skipped today · streak kept' : `${counter ? `${countOn(r, today)} of ${r.target} today · ` : ''}${schedule(r)}`}
        </Text>
      </View>
      <View style={styles.cell}>
        {days > 1 && !skipped ? (
          <View style={styles.streak} accessible accessibilityLabel={`${days} in a row`}>
            <Ionicons name="flame" size={13} color={colors.streak} />
            <Text style={styles.streakText}>{days}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.bell}>
        {r.reminder ? <Ionicons name="notifications-outline" size={18} color={colors.muted} accessibilityLabel="Reminder set" /> : null}
      </View>
      <View style={styles.tick}>
        {onTick && !skipped ? (
          <Tick
            done={done}
            adds={counter && !done}
            color={kinds.routines.color}
            onPress={onTick}
            label={counter ? `Add one to ${r.name}, ${countOn(r, today)} of ${r.target}` : `${r.name}, ${done ? 'done' : 'not done'}`}
          />
        ) : null}
      </View>
      <IconButton icon="ellipsis-horizontal" label={`Edit ${r.name}`} bare onPress={onMore} />
    </View>
  );
}

function IdeaRow({ idea, onAdd, first }: { idea: (typeof ROUTINE_IDEAS)[number]; onAdd: () => void; first?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const text = useRowText();
  return (
    <Hover
      onPress={onAdd}
      style={[styles.row, styles.idea, first && styles.first]}
      radius={12}
      accessibilityLabel={`Add ${idea.name}, ${TIME_LABELS[idea.time]}, ${describeRepeat(idea.repeat)}`}
    >
      <Pebble icon="add" ink={colors.muted} dashed />
      <View style={styles.flex}>
        <Text style={text.rowTitle}>{idea.name}</Text>
        <Text style={text.rowMeta}>{schedule(idea)}</Text>
      </View>
      <Text style={styles.add}>Add</Text>
    </Hover>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    body: { ...type.body },
    intro: { marginBottom: 8, color: colors.muted },
    none: { color: colors.muted, paddingVertical: 12 },
    toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 24 },
    noMatch: { alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 64,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    first: { borderTopWidth: 0 },
    idea: { paddingHorizontal: 8, marginHorizontal: -8 },
    cell: { width: 64, alignItems: 'flex-start' },
    streak: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: 24,
      paddingHorizontal: 9,
      borderRadius: 12,
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
    },
    streakText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
    bell: { width: 28, alignItems: 'center' },
    tick: { width: 40 },
    add: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.link, paddingRight: 8 },
  });
};
