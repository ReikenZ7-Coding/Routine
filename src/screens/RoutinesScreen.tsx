import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { Dim, Enter, FadeSwap, Pop, Press, SelectFade } from '../components/Motion';
import { RoutineForm } from '../components/RoutineForm';
import { NoMatch } from '../components/Section';
import {
  ROUTINE_IDEAS,
  type Routine,
  TIME_LABELS,
  iconFor,
  countOn,
  tapRoutine,
  isDoneOn,
  isScheduled,
  isSkipped,
  routineSubtitle,
  sortByTime,
  streak,
  toggleSkip,
} from '../lib/routines';
import { describeRepeat } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass, GlassScroll } from '../components/Glass';

export type WhenFilter = 'all' | Routine['time'];
export type RepeatFilter = 'all' | 'daily' | 'some' | 'once';

function matchesRepeat(r: Routine, f: RepeatFilter): boolean {
  if (f === 'all') return true;
  if (f === 'once') return r.repeat.kind === 'once';
  const daily = r.repeat.kind === 'everyNDays' && r.repeat.n === 1;
  return f === 'daily' ? daily : !daily && r.repeat.kind !== 'once';
}

export default function RoutinesScreen({
  query = '',
  when = 'all',
  repeat = 'all',
  header,
  onClearQuery,
}: {
  query?: string;
  when?: WhenFilter;
  repeat?: RepeatFilter;
  header?: ReactNode;
  onClearQuery?: () => void;
}) {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { ready, today, routines: all, updateRoutines } = useStore();
  // The "Create new routine" row is this shelf's add action, so there is no floating button here.
  const contentBottom = useContentBottom();
  const q = query.trim().toLowerCase();
  const filtered = all.filter((r) => (when === 'all' || r.time === when) && matchesRepeat(r, repeat));
  const routines = q ? filtered.filter((r) => r.name.toLowerCase().includes(q)) : filtered;
  const filtering = q.length > 0 || when !== 'all' || repeat !== 'all';
  const [editing, setEditing] = useState<Routine | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  if (!ready) return <Skeleton label="Loading your routines" />;

  const todays = sortByTime(routines.filter((r) => isScheduled(r, today)));
  const others = sortByTime(routines.filter((r) => !isScheduled(r, today) && r.repeat.kind !== 'once'));
  const ideasLeft = ROUTINE_IDEAS.filter((idea) => !all.some((r) => r.name === idea.name));
  const addIdea = (idea: (typeof ROUTINE_IDEAS)[number]) => updateRoutines((rs) => [...rs, { ...idea, id: newId(), doneDates: [] }]);
  const replace = (next: Routine) => updateRoutines((rs) => rs.map((r) => (r.id === next.id ? next : r)));
  const live = editing && routines.find((r) => r.id === editing.id);
  const planned = todays.filter((r) => !isSkipped(r, today));
  const open = (r?: Routine) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <View style={styles.flex}>
      <GlassScroll contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]} keyboardShouldPersistTaps="handled">
        {header}
        {all.length === 0 ? (
          <Glass style={styles.welcome}>
            <Ionicons name="repeat-outline" size={40} color={kinds.routines.color} />
            <Text style={styles.welcomeTitle}>Your own routines</Text>
            <Text style={styles.welcomeText}>
              Anything you want to do regularly: stretching, reading, cleaning, taking vitamins. Tap an idea to add it, or make your own.
            </Text>
            {ROUTINE_IDEAS.map((idea) => (
              <Press
                key={idea.name}
                outerStyle={styles.ideaSlot}
                style={styles.idea}
                overlay={colors.material.pressFill}
                onPress={() => addIdea(idea)}
                accessibilityLabel={`Add ${idea.name}, ${TIME_LABELS[idea.time]}, ${describeRepeat(idea.repeat)}`}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.link} />
                <View style={styles.flex}>
                  <Text style={styles.ideaName}>{idea.name}</Text>
                  <Text style={styles.ideaSub}>
                    {TIME_LABELS[idea.time]} · {describeRepeat(idea.repeat)}
                  </Text>
                </View>
              </Press>
            ))}
            <Button label="Make my own routine" icon="add" onPress={() => open()} style={styles.welcomeButton} />
          </Glass>
        ) : q && routines.length === 0 ? (
          <NoMatch query={query} onClear={onClearQuery} />
        ) : (
          <View style={styles.shelf}>
            <Glass style={styles.row} onPress={() => open()} accessibilityLabel="Create a new routine">
              <View style={styles.pebble}>
                <Ionicons name="add" size={24} color={colors.text} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Create new routine</Text>
                <Text style={styles.rowMeta}>Anything you want to do regularly</Text>
              </View>
            </Glass>
            <Text style={[type.sectionTitle, styles.shelfTitle]} accessibilityRole="header">
              {`Today · ${planned.filter((r) => isDoneOn(r, today)).length}/${planned.length} done`}
            </Text>
            {todays.length === 0 ? (
              <Text style={styles.emptyText}>{filtering ? 'Nothing here matches.' : 'Nothing scheduled today.'}</Text>
            ) : null}
            {todays.map((r, i) => (
              <Enter key={r.id} index={i + 1}>
                <ArtRow routine={r} today={today} onChange={replace} onMore={() => open(r)} />
              </Enter>
            ))}
            {others.length > 0 && (
              <Text style={[type.sectionTitle, styles.shelfTitle]} accessibilityRole="header">
                Not today
              </Text>
            )}
            {others.map((r) => (
              <ArtRow key={r.id} routine={r} today={today} quiet onMore={() => open(r)} />
            ))}
            {ideasLeft.length > 0 && !filtering && (
              <Text style={[type.sectionTitle, styles.shelfTitle]} accessibilityRole="header">
                Ideas
              </Text>
            )}
            {!filtering &&
              ideasLeft.map((idea) => (
                <Glass
                  key={idea.name}
                  style={styles.row}
                  onPress={() => addIdea(idea)}
                  accessibilityLabel={`Add ${idea.name}, ${TIME_LABELS[idea.time]}, ${describeRepeat(idea.repeat)}`}
                >
                  <View style={[styles.pebble, styles.ideaPebble]}>
                    <Ionicons name="add" size={22} color={colors.muted} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{idea.name}</Text>
                    <Text style={styles.rowMeta}>
                      {TIME_LABELS[idea.time]} · {describeRepeat(idea.repeat)}
                    </Text>
                  </View>
                </Glass>
              ))}
          </View>
        )}
      </GlassScroll>

      <RoutineForm
        visible={formOpen}
        routine={editing}
        onClose={() => setFormOpen(false)}
        onSave={(f) => {
          updateRoutines((rs) =>
            editing ? rs.map((r) => (r.id === editing.id ? { ...r, ...f } : r)) : [...rs, { ...f, id: newId(), doneDates: [] }],
          );
          setFormOpen(false);
        }}
        skippedToday={!!live && isSkipped(live, today)}
        onSkip={
          live && isScheduled(live, today)
            ? () => {
                replace(toggleSkip(live, today));
                setFormOpen(false);
              }
            : undefined
        }
        onDelete={
          editing
            ? () => {
                updateRoutines((rs) => rs.filter((r) => r.id !== editing.id));
                setFormOpen(false);
              }
            : undefined
        }
      />
    </View>
  );
}

/**
 * A routine as a library row, the same in every look: the routine's glyph in an inset pebble, its name with a
 * streak pill, its schedule, a tick ring (a plus for a counter, as on the Today trail) and a visible more button
 * for editing, skipping and reminders.
 */
function ArtRow({
  routine: r,
  today,
  onChange,
  onMore,
  quiet,
}: {
  routine: Routine;
  today: string;
  onChange?: (r: Routine) => void;
  onMore: () => void;
  /** Not on today's plan: its pebble steps back a little; the words stay at full strength. */
  quiet?: boolean;
}) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const done = isDoneOn(r, today);
  const skipped = isSkipped(r, today);
  const counter = !!r.target && r.target > 1;
  const canTick = !!onChange && !skipped;
  const days = streak(r, today);
  // The streak sits in a small pill at the start of the schedule line, so the name keeps the row's width.
  const pill = !skipped && days > 1;
  const meta = `${counter ? `${countOn(r, today)} of ${r.target} · ` : ''}${routineSubtitle(r, today, !pill)}`;
  return (
    <Glass style={styles.row} receded={done || skipped}>
      <Dim on={done || skipped || !!quiet} to={quiet && !done && !skipped ? 0.85 : 0.6} style={styles.pebble}>
        <Ionicons name={iconFor(r) as 'sunny'} size={20} color={kinds.routines.text} />
      </Dim>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, (done || skipped) && styles.rowDone]} numberOfLines={2}>
          {r.name}
        </Text>
        <View style={styles.metaLine}>
          {pill ? (
            <View style={styles.streakPill} accessibilityLabel={`${days} in a row`}>
              <Ionicons name="flame" size={12} color={colors.streak} />
              <Text style={styles.streakText}>{days}</Text>
            </View>
          ) : null}
          <Text style={[styles.rowMeta, styles.metaInline]} numberOfLines={2}>
            {meta}
          </Text>
        </View>
      </View>
      {canTick && (
        <Press
          onPress={() => onChange!(tapRoutine(r, today))}
          style={styles.tickSpot}
          overlay={colors.material.pressFill}
          haptic
          accessibilityRole={counter ? 'button' : 'checkbox'}
          accessibilityState={counter ? undefined : { checked: done }}
          accessibilityLabel={counter ? `Add one to ${r.name}, ${countOn(r, today)} of ${r.target}` : `Mark ${r.name} done`}
        >
          <Pop done={done} style={styles.tick}>
            <SelectFade on={done} color={kinds.routines.color} radius={13} bleed={2} />
            <FadeSwap
              on={done}
              off={counter ? <Ionicons name="add" size={16} color={colors.text} /> : null}
              onContent={<Ionicons name="checkmark" size={15} color={colors.onKind} />}
            />
          </Pop>
        </Press>
      )}
      <Press onPress={onMore} style={styles.more} overlay={colors.material.pressFill} accessibilityLabel={`Edit ${r.name}`}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Press>
    </Glass>
  );
}

const makeStyles = ({ colors, fonts, radius, radii }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1 },
    shelf: { gap: 10, marginTop: 18 },
    shelfTitle: { marginTop: 16, marginBottom: 2, paddingHorizontal: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingRight: 6, minHeight: 72 },
    pebble: {
      width: 44,
      height: 44,
      borderRadius: radii.inset,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    ideaPebble: { borderStyle: 'dashed', borderColor: colors.controlBorder },
    metaLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
    },
    streakText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.text },
    rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    metaInline: { marginTop: 0, flexShrink: 1 },
    rowDone: { textDecorationLine: 'line-through', color: colors.faint, fontFamily: fonts.bodyMedium },
    tickSpot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    tick: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: colors.controlBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16 },
    welcome: { padding: 24, alignItems: 'center', marginTop: 18 },
    welcomeTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginTop: 12 },
    welcomeText: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 21,
      marginTop: 8,
      marginBottom: 8,
    },
    ideaSlot: { alignSelf: 'stretch', marginTop: 8 },
    idea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius,
      padding: 12,
      minHeight: 56,
    },
    ideaName: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    ideaSub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
    welcomeButton: { alignSelf: 'stretch', marginTop: 16 },
    emptyText: { paddingHorizontal: 2, paddingVertical: 8, color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
  });
};
