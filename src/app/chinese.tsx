import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../components/Chip';
import { Divider, Section } from '../components/Section';
import { WordForm } from '../components/WordForm';
import {
  type Grade,
  type Word,
  STARTER_WORDS,
  addMinutes,
  dueWords,
  newWord,
  review,
  streakDays,
  todaysLog,
} from '../lib/chinese';
import { friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { colors, radius } from '../theme';

const TARGETS = [10, 15, 20, 30];
const QUICK_MINUTES = [5, 10, 15];

export default function ChineseScreen() {
  const { ready, today, chinese, updateChinese } = useStore();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState<Word | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  if (!ready) return null;

  const log = todaysLog(chinese, today);
  const due = dueWords(chinese, today);
  const streak = streakDays(chinese, today);
  const pct = Math.min(1, log.minutes / chinese.target);

  const openWord = (w?: Word) => {
    setEditing(w);
    setFormOpen(true);
  };

  // Review mode: one card at a time from a fixed queue.
  if (queue) {
    const current = chinese.words.find((w) => w.id === queue[0]);
    const finish = () => {
      setQueue(null);
      setRevealed(false);
    };
    if (!current) {
      return (
        <View style={styles.reviewScreen}>
          <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
          <Text style={styles.reviewDoneTitle}>Review done</Text>
          <Text style={styles.reviewDoneText}>{log.reviewed} cards reviewed today. 加油!</Text>
          <Pressable style={styles.primaryButton} onPress={finish}>
            <Text style={styles.primaryText}>Back</Text>
          </Pressable>
        </View>
      );
    }
    const grade = (g: Grade) => {
      updateChinese((c) => review(c, today, current.id, g));
      // "Again" puts the card at the back of today's queue.
      setQueue((q) => (q ? (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)) : q));
      setRevealed(false);
    };
    return (
      <View style={styles.reviewScreen}>
        <View style={styles.reviewTop}>
          <Text style={styles.reviewCount}>{queue.length} left</Text>
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={styles.link}>Stop</Text>
          </Pressable>
        </View>
        <Pressable style={styles.card} onPress={() => setRevealed(true)} disabled={revealed}>
          <Text style={styles.cardHanzi}>{current.hanzi}</Text>
          {revealed ? (
            <>
              {current.pinyin ? <Text style={styles.cardPinyin}>{current.pinyin}</Text> : null}
              <Text style={styles.cardMeaning}>{current.meaning}</Text>
            </>
          ) : (
            <Text style={styles.cardHint}>Tap to show the answer</Text>
          )}
        </Pressable>
        {revealed && (
          <View style={styles.grades}>
            <GradeButton label="Again" sub="see it again" onPress={() => grade('again')} tone="danger" />
            <GradeButton label="Good" sub="got it" onPress={() => grade('good')} tone="primary" />
            <GradeButton label="Easy" sub="too easy" onPress={() => grade('easy')} tone="muted" />
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.todayCard}>
        <View style={styles.row}>
          <Text style={styles.eyebrow}>Today's practice</Text>
          {streak > 0 && <Text style={styles.streak}>{streak}-day streak</Text>}
        </View>
        <Text style={styles.minutes}>
          {log.minutes} <Text style={styles.minutesOf}>/ {chinese.target} min</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
        <Text style={styles.small}>Log the time you practised:</Text>
        <View style={styles.chips}>
          {QUICK_MINUTES.map((m) => (
            <Chip key={m} label={`+${m} min`} active={false} onPress={() => updateChinese((c) => addMinutes(c, today, m))} />
          ))}
          {log.minutes > 0 && (
            <Chip label="Undo 5" active={false} onPress={() => updateChinese((c) => addMinutes(c, today, -5))} />
          )}
        </View>
        <Text style={styles.small}>Daily target:</Text>
        <View style={styles.chips}>
          {TARGETS.map((t) => (
            <Chip
              key={t}
              label={`${t} min`}
              active={chinese.target === t}
              onPress={() => updateChinese((c) => ({ ...c, target: t }))}
            />
          ))}
        </View>
      </View>

      <View style={styles.reviewCard}>
        <View style={styles.flex}>
          <Text style={styles.reviewTitle}>
            {chinese.words.length === 0 ? 'Flashcards' : due.length ? `${due.length} words to review` : 'All caught up'}
          </Text>
          <Text style={styles.small}>
            {chinese.words.length === 0
              ? 'Add words and they come back for review just before you forget them.'
              : due.length
                ? 'Words come back for review just before you forget them.'
                : 'Come back tomorrow for your next review.'}
          </Text>
        </View>
        {due.length > 0 && (
          <Pressable style={styles.startButton} onPress={() => setQueue(due.map((w) => w.id))}>
            <Text style={styles.primaryText}>Start</Text>
          </Pressable>
        )}
      </View>

      {chinese.words.length === 0 ? (
        <View style={styles.starter}>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              updateChinese((c) => ({
                ...c,
                words: [...c.words, ...STARTER_WORDS.map(([h, p, m]) => newWord(newId(), h, p, m, today))],
              }))
            }
          >
            <Text style={styles.primaryText}>Start with 10 beginner words</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => openWord()}>
            <Text style={styles.secondaryText}>Add my own words</Text>
          </Pressable>
        </View>
      ) : (
        <Section
          title={`My words · ${chinese.words.length}`}
          right={
            <Pressable onPress={() => openWord()} hitSlop={8}>
              <Text style={styles.link}>Add word</Text>
            </Pressable>
          }
        >
          {[...chinese.words]
            .sort((a, b) => a.due.localeCompare(b.due))
            .map((w, i) => (
              <View key={w.id}>
                {i > 0 && <Divider />}
                <Pressable style={({ pressed }) => [styles.wordRow, pressed && styles.pressed]} onPress={() => openWord(w)}>
                  <Text style={styles.wordHanzi}>{w.hanzi}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.wordPinyin}>{w.pinyin}</Text>
                    <Text style={styles.wordMeaning}>{w.meaning}</Text>
                  </View>
                  <Text style={styles.wordDue}>{w.due <= today ? 'Due' : friendlyDate(w.due, today)}</Text>
                </Pressable>
              </View>
            ))}
        </Section>
      )}

      <WordForm
        visible={formOpen}
        word={editing}
        onClose={() => setFormOpen(false)}
        onSave={(f) => {
          updateChinese((c) =>
            editing
              ? { ...c, words: c.words.map((w) => (w.id === editing.id ? { ...w, ...f } : w)) }
              : { ...c, words: [...c.words, newWord(newId(), f.hanzi, f.pinyin, f.meaning, today)] },
          );
          setFormOpen(false);
        }}
        onDelete={
          editing
            ? () => {
                updateChinese((c) => ({ ...c, words: c.words.filter((w) => w.id !== editing.id) }));
                setFormOpen(false);
              }
            : undefined
        }
      />
    </ScrollView>
  );
}

function GradeButton({
  label,
  sub,
  onPress,
  tone,
}: {
  label: string;
  sub: string;
  onPress: () => void;
  tone: 'danger' | 'primary' | 'muted';
}) {
  const color = tone === 'danger' ? colors.danger : tone === 'primary' ? colors.primary : colors.muted;
  return (
    <Pressable style={[styles.gradeButton, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.gradeLabel, { color }]}>{label}</Text>
      <Text style={styles.gradeSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayCard: { backgroundColor: colors.card, borderRadius: radius, padding: 16 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  streak: { fontSize: 13, fontWeight: '600', color: colors.text },
  minutes: { fontSize: 32, fontWeight: '700', color: colors.text, marginTop: 6, fontVariant: ['tabular-nums'] },
  minutesOf: { fontSize: 17, fontWeight: '500', color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 10, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  small: { fontSize: 13, color: colors.muted, marginTop: 12, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radius,
    padding: 16,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  startButton: { backgroundColor: colors.primary, borderRadius: radius, paddingVertical: 12, paddingHorizontal: 20 },
  starter: { marginTop: 8 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 14 },
  pressed: { backgroundColor: colors.primarySoft },
  wordHanzi: { fontSize: 24, color: colors.text, minWidth: 52 },
  wordPinyin: { fontSize: 14, color: colors.text },
  wordMeaning: { fontSize: 13, color: colors.muted, marginTop: 1 },
  wordDue: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  reviewScreen: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
  reviewTop: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  reviewCount: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  card: {
    alignSelf: 'stretch',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  cardHanzi: { fontSize: 64, color: colors.text },
  cardPinyin: { fontSize: 22, color: colors.primary, fontWeight: '600' },
  cardMeaning: { fontSize: 18, color: colors.text },
  cardHint: { fontSize: 14, color: colors.muted, marginTop: 8 },
  grades: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  gradeButton: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  gradeLabel: { fontSize: 16, fontWeight: '700' },
  gradeSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  reviewDoneTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  reviewDoneText: { fontSize: 15, color: colors.muted },
});
