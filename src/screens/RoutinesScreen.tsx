import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Button } from '../components/Button';
import { Fab } from '../components/Fab';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { HubHeader, RoutineCard } from '../components/Hub';
import { Dim, Enter, FadeSwap, Pop, Press, SelectFade } from '../components/Motion';
import { RoutineForm } from '../components/RoutineForm';
import { HintPane, NoMatch } from '../components/Section';
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
  const { colors, kinds, glass } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - 32 - 10) / 2);
  const { ready, today, routines: all, updateRoutines } = useStore();
  const contentBottom = useContentBottom(!glass);
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
        ) : glass ? (
          <View style={styles.shelf}>
            <Glass radius={20} style={styles.create} onPress={() => open()} accessibilityLabel="Create a new routine">
              <View style={styles.createIcon}>
                <Ionicons name="add" size={26} color={colors.text} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>Create new routine</Text>
                <Text style={styles.rowMeta}>Anything you want to do regularly</Text>
              </View>
            </Glass>
            <Text style={styles.shelfTitle}>{`Today · ${planned.filter((r) => isDoneOn(r, today)).length}/${planned.length} done`}</Text>
            {todays.length === 0 ? <Text style={styles.emptyText}>Nothing scheduled today.</Text> : null}
            {todays.map((r, i) => (
              <Enter key={r.id} index={i + 1}>
                <ArtRow routine={r} today={today} onChange={replace} onMore={() => open(r)} />
              </Enter>
            ))}
            {others.length > 0 && <Text style={styles.shelfTitle}>Not today</Text>}
            {others.map((r, i) => (
              <ArtRow key={r.id} routine={r} today={today} quiet onMore={() => open(r)} />
            ))}
            {ideasLeft.length > 0 && <Text style={styles.shelfTitle}>Ideas</Text>}
            {ideasLeft.map((idea) => (
              <Glass
                key={idea.name}
                radius={20}
                style={styles.artRow}
                onPress={() => addIdea(idea)}
                accessibilityLabel={`Add ${idea.name}`}
              >
                <View style={styles.ideaIcon}>
                  <Ionicons name="add" size={22} color={colors.text} />
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
        ) : (
          <>
            <Text style={styles.countLine}>
              {routines.length} {routines.length === 1 ? 'routine' : 'routines'}
              {filtering ? ` of ${all.length}` : ''}
            </Text>
            <HubHeader
              icon="today-outline"
              title="Today"
              count={todays.length}
              color={kinds.routines.color}
              right={<Text style={styles.hubMeta}>{`${planned.filter((r) => isDoneOn(r, today)).length}/${planned.length} done`}</Text>}
            />
            {todays.length === 0 ? (
              <Text style={styles.emptyGrid}>{filtering ? 'Nothing here matches.' : 'Nothing scheduled today.'}</Text>
            ) : (
              <View style={styles.grid}>
                {todays.map((r, i) => (
                  <Enter key={r.id} index={i}>
                    <RoutineCard routine={r} today={today} width={cardWidth} onChange={replace} onOpen={() => open(r)} />
                  </Enter>
                ))}
              </View>
            )}
            {others.length > 0 && (
              <>
                <HubHeader icon="calendar-outline" title="Other days" count={others.length} color={kinds.calendar.color} />
                <View style={styles.grid}>
                  {others.map((r) => (
                    <RoutineCard key={r.id} routine={r} today={today} width={cardWidth} onOpen={() => open(r)} />
                  ))}
                </View>
              </>
            )}
            {ideasLeft.length > 0 && !filtering && (
              <>
                <HubHeader icon="bulb-outline" title="Ideas" count={ideasLeft.length} color={kinds.inbox.color} />
                <View style={styles.grid}>
                  {ideasLeft.map((idea) => (
                    <Press
                      key={idea.name}
                      style={[styles.ideaCard, { width: cardWidth }]}
                      onPress={() => addIdea(idea)}
                      accessibilityLabel={`Add ${idea.name}, ${TIME_LABELS[idea.time]}, ${describeRepeat(idea.repeat)}`}
                    >
                      <View style={styles.ideaPlus}>
                        <Ionicons name="add" size={20} color={colors.text} />
                      </View>
                      <Text style={styles.ideaCardName} numberOfLines={2}>
                        {idea.name}
                      </Text>
                      <Text style={styles.otherSub} numberOfLines={2}>
                        {TIME_LABELS[idea.time]} · {describeRepeat(idea.repeat)}
                      </Text>
                    </Press>
                  ))}
                </View>
              </>
            )}
            <HintPane>Tap the circle on a card to tick it off. Tap the card to edit it, skip a day or set a reminder.</HintPane>
          </>
        )}
      </GlassScroll>

      {all.length > 0 && !glass && <Fab onPress={() => open()} accessibilityLabel="Add a routine" />}

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
 * A routine as a library row on the glass looks: its art (Stone) or icon tile (Lavender), name and schedule, a
 * round button to tick it off (or +1 for counters) and a visible more button for editing, skipping and reminders.
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
  /** Not on today's plan: its tile steps back a little; the words stay at full strength. */
  quiet?: boolean;
}) {
  const { colors, kinds, name } = useTheme();
  const styles = useStyles(makeStyles);
  const done = isDoneOn(r, today);
  const skipped = isSkipped(r, today);
  const counter = !!r.target && r.target > 1;
  const canTick = !!onChange && !skipped;
  const days = streak(r, today);
  const stone = name === 'stone';
  const pill = (name === 'lavender' || stone) && !skipped && days > 1;
  const idle =
    counter && !done ? (
      <Text style={styles.tickText}>+1</Text>
    ) : stone ? (
      <Ionicons name="checkmark-outline" size={18} color={colors.accent} />
    ) : (
      <Ionicons name="play" size={16} color={colors.text} style={styles.playNudge} />
    );
  const meta = `${counter ? `${countOn(r, today)} of ${r.target} · ` : ''}${routineSubtitle(r, today, !pill)}`;
  return (
    <Glass radius={20} style={styles.artRow} receded={done || skipped}>
      {stone ? (
        // Stone: a quiet glass tile with the routine's glyph in champagne.
        <Dim on={done || skipped || !!quiet} to={quiet && !done && !skipped ? 0.85 : 0.6} style={styles.stoneTile}>
          <Ionicons name={iconFor(r) as 'sunny'} size={22} color={colors.accent} />
        </Dim>
      ) : (
        // Lavender: the kind's pastel tile with a deep-indigo glyph, like the art on a playlist row.
        <Dim on={done || skipped || !!quiet} to={quiet && !done && !skipped ? 0.85 : 0.55} style={[styles.thumb, styles.tile]}>
          <Ionicons name={iconFor(r) as 'sunny'} size={24} color={colors.onKind} />
        </Dim>
      )}
      <View style={styles.flex}>
        <View style={styles.titleLine}>
          <Text style={[styles.rowTitle, styles.shrink, (done || skipped) && styles.rowDone]} numberOfLines={1}>
            {r.name}
          </Text>
          {/* Lavender and Stone lift the streak out of the meta line into a small pill, so the schedule never truncates. */}
          {pill ? (
            <View style={styles.streakPill} accessibilityLabel={`${days} in a row`}>
              <Ionicons name="flame" size={12} color={colors.streak} />
              <Text style={styles.streakText}>{days}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowMeta} numberOfLines={stone ? 2 : 1}>
          {meta}
        </Text>
      </View>
      {canTick && (
        <Press
          onPress={() => onChange!(tapRoutine(r, today))}
          style={styles.tick}
          overlay={colors.material.pressFill}
          haptic
          accessibilityRole={counter ? 'button' : 'checkbox'}
          accessibilityState={counter ? undefined : { checked: done }}
          accessibilityLabel={counter ? `Add one to ${r.name}, ${countOn(r, today)} of ${r.target}` : `Mark ${r.name} done`}
        >
          <SelectFade on={done} radius={22} bleed={1.5} style={styles.tickDone} />
          <Pop done={done}>
            <FadeSwap on={done} off={idle} onContent={<Ionicons name="checkmark" size={18} color={colors.onDone} />} />
          </Pop>
        </Press>
      )}
      <Press onPress={onMore} style={styles.more} overlay={colors.material.pressFill} accessibilityLabel={`Edit ${r.name}`}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Press>
    </Glass>
  );
}

const makeStyles = ({ colors, kinds, fonts, type, radius, name }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    shelf: { gap: 10 },
    create: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
    createIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    shelfTitle: { fontFamily: fonts.bodyBold, fontSize: name === 'stone' ? 16 : 17, color: colors.text, marginTop: 14, marginBottom: 2 },
    artRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
    thumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden' },
    tile: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: kinds.routines.color,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    shrink: { flexShrink: 1 },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 11,
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
    },
    streakText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
    tickDone: { backgroundImage: `linear-gradient(180deg, ${colors.doneFill[0]}, ${colors.doneFill[1]})` },
    ideaIcon: {
      width: 56,
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
    },
    rowTitle: { fontFamily: name === 'stone' ? fonts.body : fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.text },
    stoneTile: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    rowDone: { textDecorationLine: 'line-through', color: colors.faint, fontFamily: fonts.body },
    tick: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
    },
    tickText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
    playNudge: { marginLeft: 2 },
    more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16 },
    welcome: { padding: 24, alignItems: 'center', marginTop: 12 },
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
    emptyText: { padding: 16, color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
    ideaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    otherRow: { paddingVertical: 12, paddingHorizontal: 14, paddingLeft: 52 },
    otherName: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    otherSub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
    countLine: { ...type.label, marginTop: 18 },
    hubMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    emptyGrid: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, paddingVertical: 8 },
    ideaCard: {
      minHeight: 150,
      borderRadius: radius,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.faint,
      padding: 14,
      gap: 8,
      justifyContent: 'flex-end',
    },
    ideaPlus: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 'auto',
    },
    ideaCardName: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.text },
  });
