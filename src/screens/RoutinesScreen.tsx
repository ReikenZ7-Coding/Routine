import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RoutineForm } from '../components/RoutineForm';
import { RoutineRow } from '../components/RoutineRow';
import { Divider, Section } from '../components/Section';
import {
  ROUTINE_IDEAS,
  type Routine,
  TIME_LABELS,
  isDoneOn,
  isScheduled,
  isSkipped,
  routineSubtitle,
  sortByTime,
  toggleSkip,
} from '../lib/routines';
import { describeRepeat } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { useFabBottom } from '../components/NowPlaying';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from '../components/Glass';

export default function RoutinesScreen({ query = '' }: { query?: string }) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const fabBottom = useFabBottom();
  const { ready, today, routines: all, updateRoutines } = useStore();
  const q = query.trim().toLowerCase();
  const routines = q ? all.filter((r) => r.name.toLowerCase().includes(q)) : all;
  const [editing, setEditing] = useState<Routine | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  if (!ready) return null;

  const todays = sortByTime(routines.filter((r) => isScheduled(r, today)));
  const others = sortByTime(routines.filter((r) => !isScheduled(r, today) && r.repeat.kind !== 'once'));
  const ideasLeft = ROUTINE_IDEAS.filter((idea) => !all.some((r) => r.name === idea.name));
  const addIdea = (idea: (typeof ROUTINE_IDEAS)[number]) =>
    updateRoutines((rs) => [...rs, { ...idea, id: newId(), doneDates: [] }]);
  const replace = (next: Routine) => updateRoutines((rs) => rs.map((r) => (r.id === next.id ? next : r)));
  const live = editing && routines.find((r) => r.id === editing.id);
  const planned = todays.filter((r) => !isSkipped(r, today));
  const open = (r?: Routine) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {all.length === 0 ? (
          <Glass style={styles.welcome}>
            <Ionicons name="repeat-outline" size={40} color={kinds.routines.color} />
            <Text style={styles.welcomeTitle}>Your own routines</Text>
            <Text style={styles.welcomeText}>
              Anything you want to do regularly: stretching, reading, cleaning, taking vitamins. Tap an idea to add it, or
              make your own.
            </Text>
            {ROUTINE_IDEAS.map((idea) => (
              <Pressable accessibilityRole="button"
                key={idea.name}
                style={styles.idea}
                onPress={() => addIdea(idea)}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.ideaName}>{idea.name}</Text>
                  <Text style={styles.ideaSub}>
                    {TIME_LABELS[idea.time]} · {describeRepeat(idea.repeat)}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => open()}>
              <Text style={styles.primaryText}>Make my own routine</Text>
            </Pressable>
          </Glass>
        ) : (
          <>
            <Section title={`Today · ${planned.filter((r) => isDoneOn(r, today)).length}/${planned.length}`}>
              {todays.length === 0 ? (
                <Text style={styles.emptyText}>Nothing scheduled today.</Text>
              ) : (
                todays.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 && <Divider />}
                    <RoutineRow routine={r} date={today} onChange={replace} onLongPress={() => open(r)} />
                  </View>
                ))
              )}
            </Section>
            {others.length > 0 && (
              <Section title="Not today">
                {others.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 && <Divider />}
                    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.otherRow, pressed && styles.pressed]} onPress={() => open(r)}>
                      <Text style={styles.otherName}>{r.name}</Text>
                      <Text style={styles.otherSub}>{routineSubtitle(r, today)}</Text>
                    </Pressable>
                  </View>
                ))}
              </Section>
            )}
            {ideasLeft.length > 0 && (
              <Section title="Ideas">
                {ideasLeft.map((idea, i) => (
                  <View key={idea.name}>
                    {i > 0 && <Divider />}
                    <Pressable accessibilityRole="button"
                      style={({ pressed }) => [styles.ideaRow, pressed && styles.pressed]}
                      onPress={() => addIdea(idea)}
                      accessibilityLabel={`Add ${idea.name}`}
                    >
                      <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                      <View style={styles.flex}>
                        <Text style={styles.otherName}>{idea.name}</Text>
                        <Text style={styles.otherSub}>
                          {TIME_LABELS[idea.time]} · {describeRepeat(idea.repeat)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </Section>
            )}
            <Text style={styles.hint}>Tap to tick off. Press and hold to edit, skip a day or set a reminder.</Text>
          </>
        )}
      </ScrollView>

      {all.length > 0 && (
        <Pressable accessibilityRole="button" style={[styles.fab, { bottom: fabBottom }]} onPress={() => open()} accessibilityLabel="Add routine">
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </Pressable>
      )}

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

const makeStyles = ({ colors, fonts, radius }: Theme) =>
  StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 170 },
  welcome: { padding: 24, alignItems: 'center', marginTop: 12 },
  welcomeTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginTop: 12 },
  welcomeText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 8 },
  idea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 12,
    marginTop: 8,
  },
  ideaName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  ideaSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 16 },
  emptyText: { padding: 16, color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
  ideaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  otherRow: { paddingVertical: 12, paddingHorizontal: 14, paddingLeft: 52 },
  pressed: { backgroundColor: colors.primarySoft },
  otherName: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  otherSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  hint: { textAlign: 'center', color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
