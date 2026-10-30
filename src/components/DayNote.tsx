import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MOODS, setEntry } from '../lib/journal';
import { useStore } from '../lib/store';
import { colors, fonts, type } from '../theme';
import { Section } from './Section';

/** A mood and a short note for a day. */
export function DayNote({ date, isToday }: { date: string; isToday: boolean }) {
  const { journal, updateJournal } = useStore();
  const entry = journal[date] ?? {};
  const [note, setNote] = useState(entry.note ?? '');
  useEffect(() => setNote(journal[date]?.note ?? ''), [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = () => {
    if ((entry.note ?? '') !== note.trim()) updateJournal((j) => setEntry(j, date, { note }));
  };

  return (
    <Section title={isToday ? 'How was today?' : 'How it went'}>
      <View style={styles.moods}>
        {MOODS.map((m) => {
          const active = entry.mood === m.value;
          return (
            <Pressable
              key={m.value}
              style={[styles.mood, active && styles.moodActive]}
              onPress={() => updateJournal((j) => setEntry(j, date, { mood: active ? undefined : m.value }))}
              accessibilityLabel={m.label}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.face, !active && entry.mood ? styles.faceDim : null]}>{m.face}</Text>
              <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={styles.note}
        value={note}
        onChangeText={setNote}
        onBlur={saveNote}
        onEndEditing={saveNote}
        placeholder="A line about your day (optional)"
        placeholderTextColor={colors.faint}
        multiline
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  moods: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 12 },
  mood: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, gap: 2 },
  moodActive: { backgroundColor: colors.primarySoft },
  face: { fontSize: 24 },
  faceDim: { opacity: 0.35 },
  moodLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  moodLabelActive: { color: colors.text, fontFamily: fonts.bodyMedium },
  note: {
    ...type.body,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    minHeight: 40,
  },
});
