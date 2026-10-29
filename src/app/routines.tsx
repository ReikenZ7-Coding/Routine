import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '../components/CheckRow';
import { RoutineForm } from '../components/RoutineForm';
import { Divider, Section } from '../components/Section';
import {
  ROUTINE_IDEAS,
  type Routine,
  TIME_LABELS,
  isDoneOn,
  isScheduled,
  routineSubtitle,
  sortByTime,
  toggleDone,
} from '../lib/routines';
import { describeRepeat } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { colors, radius } from '../theme';

export default function RoutinesScreen() {
  const { ready, today, routines, updateRoutines } = useStore();
  const [editing, setEditing] = useState<Routine | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  if (!ready) return null;

  const todays = sortByTime(routines.filter((r) => isScheduled(r, today)));
  const others = sortByTime(routines.filter((r) => !isScheduled(r, today) && r.repeat.kind !== 'once'));
  const ideasLeft = ROUTINE_IDEAS.filter((idea) => !routines.some((r) => r.name === idea.name));
  const addIdea = (idea: (typeof ROUTINE_IDEAS)[number]) =>
    updateRoutines((rs) => [...rs, { ...idea, id: newId(), doneDates: [] }]);
  const toggle = (id: string) => updateRoutines((rs) => rs.map((r) => (r.id === id ? toggleDone(r, today) : r)));
  const open = (r?: Routine) => {
    setEditing(r);
    setFormOpen(true);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        {routines.length === 0 ? (
          <View style={styles.welcome}>
            <Ionicons name="repeat-outline" size={40} color={colors.primary} />
            <Text style={styles.welcomeTitle}>Your own routines</Text>
            <Text style={styles.welcomeText}>
              Anything you want to do regularly: stretching, reading, cleaning, taking vitamins. Tap an idea to add it, or
              make your own.
            </Text>
            {ROUTINE_IDEAS.map((idea) => (
              <Pressable
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
            <Pressable style={styles.primaryButton} onPress={() => open()}>
              <Text style={styles.primaryText}>Make my own routine</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Section title={`Today · ${todays.filter((r) => isDoneOn(r, today)).length}/${todays.length}`}>
              {todays.length === 0 ? (
                <Text style={styles.emptyText}>Nothing scheduled today.</Text>
              ) : (
                todays.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 && <Divider />}
                    <CheckRow
                      title={r.name}
                      subtitle={routineSubtitle(r, today)}
                      done={isDoneOn(r, today)}
                      onToggle={() => toggle(r.id)}
                      onLongPress={() => open(r)}
                    />
                  </View>
                ))
              )}
            </Section>
            {others.length > 0 && (
              <Section title="Not today">
                {others.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 && <Divider />}
                    <Pressable style={({ pressed }) => [styles.otherRow, pressed && styles.pressed]} onPress={() => open(r)}>
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
                    <Pressable
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
            <Text style={styles.hint}>Tap to tick off. Press and hold a routine to edit it.</Text>
          </>
        )}
      </ScrollView>

      {routines.length > 0 && (
        <Pressable style={styles.fab} onPress={() => open()} accessibilityLabel="Add routine">
          <Ionicons name="add" size={30} color="#fff" />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 110 },
  welcome: { backgroundColor: colors.card, borderRadius: radius, padding: 24, alignItems: 'center', marginTop: 12 },
  welcomeTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 12 },
  welcomeText: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 8 },
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
  ideaName: { fontSize: 15, fontWeight: '600', color: colors.text },
  ideaSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyText: { padding: 16, color: colors.muted, fontSize: 15 },
  ideaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  otherRow: { paddingVertical: 12, paddingHorizontal: 14, paddingLeft: 52 },
  pressed: { backgroundColor: colors.primarySoft },
  otherName: { fontSize: 16, color: colors.text },
  otherSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 13, marginTop: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
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
