import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MOODS, moodOf, setEntry } from '../lib/journal';
import { useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Field, Input } from './Field';
import { alphaOf } from './glass/colour';
import { MoodGlyph } from './MoodGlyph';
import { FadeSwap, Pop, Press, SelectFade } from './Motion';
import { Section } from './Section';

/** A mood and a short note for a day. */
export function DayNote({ date, isToday }: { date: string; isToday: boolean }) {
  const { colors, radii, name } = useTheme();
  const styles = useStyles(makeStyles);
  // Lavender and Stone draw each mood as a disc with its name beneath. Lavender's chosen disc fills with the done
  // colour; Stone's faces are drawn in champagne and the chosen one sits in a champagne glass disc.
  // Paper's faces are drawn in ink, and the chosen one sits in an ink-glass disc, drawn in white.
  const discs = name === 'lavender' || name === 'stone' || name === 'paper';
  const stone = name === 'stone';
  const paper = name === 'paper';
  const { journal, updateJournal } = useStore();
  const entry = journal[date] ?? {};
  const mood = moodOf(entry.mood);
  const [note, setNote] = useState(entry.note ?? '');
  useEffect(() => setNote(journal[date]?.note ?? ''), [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = () => {
    if ((entry.note ?? '') !== note.trim()) updateJournal((j) => setEntry(j, date, { note }));
  };

  return (
    <Section title={isToday ? 'How was today?' : 'How it went'}>
      <View style={styles.moods} accessibilityRole="radiogroup" accessibilityLabel="Mood">
        {MOODS.map((m) => {
          const active = mood === m.value;
          const face = (ink: string, label: string) => (
            <View style={styles.moodInner}>
              <MoodGlyph curve={m.curve} color={ink} />
              <Text style={[styles.moodLabel, { color: label }, active && styles.moodLabelActive]}>{m.label}</Text>
            </View>
          );
          const choose = () => updateJournal((j) => setEntry(j, date, { mood: active ? undefined : m.value }));
          if (discs) {
            return (
              <Press
                key={m.value}
                outerStyle={styles.moodSlot}
                style={styles.discItem}
                haptic
                onPress={choose}
                accessibilityRole="radio"
                accessibilityLabel={m.label}
                accessibilityState={{ checked: active }}
              >
                <View style={stone ? styles.stoneDisc : paper ? styles.paperDisc : styles.disc}>
                  <SelectFade on={active} radius={25} bleed={paper ? 0 : 1} style={stone ? styles.stoneDiscOn : styles.discOn} />
                  <Pop done={active}>
                    <FadeSwap
                      on={active}
                      off={<MoodGlyph curve={m.curve} color={stone ? colors.accent : colors.text} />}
                      onContent={<MoodGlyph curve={m.curve} color={stone ? colors.onWarmTile : colors.onDone} />}
                    />
                  </Pop>
                </View>
                <Text style={[styles.moodLabel, styles.discLabel, active && styles.moodLabelActive]}>{m.label}</Text>
              </Press>
            );
          }
          return (
            <Press
              key={m.value}
              outerStyle={styles.moodSlot}
              style={styles.mood}
              overlay={colors.material.pressFill}
              haptic
              onPress={choose}
              accessibilityRole="radio"
              accessibilityLabel={m.label}
              accessibilityState={{ checked: active }}
            >
              <SelectFade on={active} radius={radii.inset} style={styles.moodFill} />
              <Pop done={active}>
                <FadeSwap on={active} off={face(colors.text, colors.muted)} onContent={face(colors.onPrimary, colors.onPrimary)} />
              </Pop>
            </Press>
          );
        })}
      </View>
      <Field label={isToday ? 'A line about today' : 'A line about that day'} style={styles.noteField}>
        <Input
          value={note}
          onChangeText={setNote}
          onBlur={saveNote}
          onEndEditing={saveNote}
          placeholder="Optional"
          multiline
          accessibilityLabel={isToday ? 'A line about today' : 'A line about that day'}
          style={styles.note}
        />
      </Field>
    </Section>
  );
}

const makeStyles = ({ colors, fonts, radii }: Theme) =>
  StyleSheet.create({
    moods: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingHorizontal: 10, paddingTop: 12 },
    moodSlot: { flex: 1 },
    mood: {
      minHeight: 64,
      minWidth: 52,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
      borderRadius: radii.inset,
    },
    moodInner: { alignItems: 'center', gap: 3 },
    moodFill: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    moodLabel: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18 },
    moodLabelActive: { fontFamily: fonts.bodyMedium },
    discItem: { alignItems: 'center', gap: 6, minHeight: 44, paddingVertical: 2, borderRadius: radii.inset },
    disc: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `linear-gradient(180deg, ${colors.material.control.body[0]}, ${colors.material.control.body[1]})`,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    paperDisc: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    discOn: { backgroundImage: `linear-gradient(180deg, ${colors.doneFill[0]}, ${colors.doneFill[1]})` },
    stoneDisc: {
      width: 50,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    stoneDiscOn: { backgroundColor: colors.warmTile, borderWidth: 1, borderColor: alphaOf(colors.onWarmTile, 0.45) },
    discLabel: { color: colors.muted },
    noteField: { marginHorizontal: 16, marginTop: 12, marginBottom: 16 },
    note: { minHeight: 48 },
  });
