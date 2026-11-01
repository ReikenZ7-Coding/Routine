import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { MOODS, setEntry } from '../lib/journal';
import { useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { FadeSwap, Press, SelectFade } from './Motion';
import { Section } from './Section';

/** A mood and a short note for a day. */
export function DayNote({ date, isToday }: { date: string; isToday: boolean }) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
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
            <Press
              key={m.value}
              outerStyle={styles.moodSlot}
              style={styles.mood}
              overlay={colors.material.pressFill}
              haptic
              onPress={() => updateJournal((j) => setEntry(j, date, { mood: active ? undefined : m.value }))}
              accessibilityLabel={m.label}
              accessibilityState={{ selected: active }}
            >
              <SelectFade on={active} radius={radii.inset} style={styles.moodFill} />
              <Text style={styles.face}>{m.face}</Text>
              <FadeSwap
                on={active}
                off={<Text style={styles.moodLabel}>{m.label}</Text>}
                onContent={<Text style={[styles.moodLabel, styles.moodLabelActive]}>{m.label}</Text>}
              />
            </Press>
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
        placeholderTextColor={colors.muted}
        multiline
      />
    </Section>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) =>
  StyleSheet.create({
    moods: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, paddingTop: 12 },
    moodSlot: { flex: 1 },
    mood: {
      minHeight: 56,
      minWidth: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: radii.inset,
      gap: 2,
    },
    moodFill: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    face: { fontSize: 24 },
    moodLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    moodLabelActive: { color: colors.onPrimary, fontFamily: fonts.bodyMedium },
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
