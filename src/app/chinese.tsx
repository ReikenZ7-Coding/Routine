import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ActionChip, Chip } from '../components/Chip';
import { FocusTimer } from '../components/FocusTimer';
import { Divider, Section } from '../components/Section';
import { PageTitle } from '../components/PageTitle';
import { WordForm } from '../components/WordForm';
import { type Grade, type Word, STARTER_WORDS, addMinutes, dueWords, newWord, review, streakDays, todaysLog } from '../lib/chinese';
import { friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass, GlassScroll } from '../components/Glass';
import { Segmented } from '../components/Hub';
import { Bar, Enter, Press } from '../components/Motion';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { plural } from '../lib/plural';

const TARGETS = [10, 15, 20, 30];
const QUICK_MINUTES = [5, 10, 15];

export default function ChineseScreen() {
  const { colors, kinds, name } = useTheme();
  const lavender = name === 'lavender';
  const styles = useStyles(makeStyles);
  const { ready, today, chinese, updateChinese } = useStore();
  const contentBottom = useContentBottom();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState<Word | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  if (!ready) return <Skeleton label="Loading your practice" />;

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
          <Ionicons name="checkmark-circle" size={56} color={kinds.chinese.color} />
          <Text style={styles.reviewDoneTitle}>Review done</Text>
          <Text style={styles.reviewDoneText}>{plural(log.reviewed, 'card')} reviewed today. 加油!</Text>
          <Button label="Back to practice" onPress={finish} style={styles.doneButton} />
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
          <Button label="Stop" variant="plain" icon="close" onPress={finish} accessibilityLabel="Stop the review" />
        </View>
        <Glass
          tier="hero"
          style={styles.card}
          onPress={revealed ? undefined : () => setRevealed(true)}
          accessibilityRole={revealed ? undefined : 'button'}
          accessibilityLabel={revealed ? undefined : `${current.hanzi}. Show the answer`}
        >
          <Text style={styles.cardHanzi}>{current.hanzi}</Text>
          {revealed ? (
            <>
              {current.pinyin ? <Text style={styles.cardPinyin}>{current.pinyin}</Text> : null}
              <Text style={styles.cardMeaning}>{current.meaning}</Text>
            </>
          ) : (
            <Text style={styles.cardHint}>Tap to show the answer</Text>
          )}
        </Glass>
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
    <GlassScroll contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
      <PageTitle title="Chinese" subtitle="Daily practice and flashcards" badge={plural(chinese.words.length, 'word')} />
      <Enter index={0}>
        <Glass tier={lavender ? 'hero' : 'pane'} bloom={lavender} style={styles.todayCard}>
          <View style={styles.row}>
            <Text style={styles.cardTitle} accessibilityRole="header">
              Today's practice
            </Text>
            {streak > 0 && (
              <View style={styles.streakPill}>
                <Ionicons name="flame" size={14} color={colors.streak} />
                <Text style={styles.streak}>{plural(streak, 'day')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.minutes} accessibilityLabel={`${log.minutes} of ${chinese.target} minutes`}>
            {log.minutes} <Text style={styles.minutesOf}>/ {chinese.target} min</Text>
          </Text>
          <View style={styles.track}>
            <Bar
              progress={pct}
              color={kinds.chinese.color}
              track={name === 'paper' ? kinds.chinese.soft : colors.track}
              height={name === 'stone' ? 4 : 8}
            />
          </View>
          <Text style={styles.small}>Log the time you practised</Text>
          <View style={styles.chips}>
            {QUICK_MINUTES.map((m) => (
              <Chip
                key={m}
                label={`+${m}`}
                active={false}
                outerStyle={styles.flex}
                accessibilityLabel={`Log ${m} minutes`}
                onPress={() => updateChinese((c) => addMinutes(c, today, m))}
              />
            ))}
            <Press
              style={[styles.undo, log.minutes === 0 && styles.undoOff]}
              overlay={colors.material.pressFill}
              disabled={log.minutes === 0}
              onPress={() => updateChinese((c) => addMinutes(c, today, -5))}
              accessibilityLabel="Undo last 5 minutes"
            >
              <Ionicons name="arrow-undo" size={18} color={colors.text} />
            </Press>
          </View>
          <Text style={styles.small}>Daily target</Text>
          <Segmented
            accessibilityLabel="Daily target"
            options={TARGETS.map((t) => ({ key: String(t), label: `${t} min` }))}
            value={String(chinese.target)}
            onChange={(k) => updateChinese((c) => ({ ...c, target: Number(k) }))}
          />
        </Glass>
      </Enter>

      <Enter index={1}>
        <FocusTimer onLog={(m) => updateChinese((c) => addMinutes(c, today, m))} />
      </Enter>

      <Enter index={2}>
        <Glass style={styles.reviewCard}>
          {lavender && (
            // The word deck's own tile, like the art on a playlist row: one character on the kind's pastel.
            <View style={styles.deckTile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={styles.deckGlyph}>字</Text>
            </View>
          )}
          <View style={styles.flex}>
            <Text style={styles.reviewTitle}>
              {chinese.words.length === 0 ? 'Flashcards' : due.length ? `${plural(due.length, 'word')} to review` : 'All caught up'}
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
            <Button
              label="Review"
              variant="secondary"
              onPress={() => setQueue(due.map((w) => w.id))}
              accessibilityLabel={`Review ${plural(due.length, 'word')}`}
            />
          )}
        </Glass>
      </Enter>

      {chinese.words.length === 0 ? (
        <View style={styles.starter}>
          <Button
            label="Start with 10 beginner words"
            variant="secondary"
            onPress={() =>
              updateChinese((c) => ({
                ...c,
                words: [...c.words, ...STARTER_WORDS.map(([h, p, m]) => newWord(newId(), h, p, m, today))],
              }))
            }
          />
          <Button label="Add my own words" variant="plain" icon="add" onPress={() => openWord()} />
        </View>
      ) : (
        <Section
          enter={3}
          title={`My words · ${chinese.words.length}`}
          right={<ActionChip icon="add" label="Add word" onPress={() => openWord()} />}
        >
          {[...chinese.words]
            .sort((a, b) => a.due.localeCompare(b.due))
            .map((w, i) => (
              <View key={w.id}>
                {i > 0 && <Divider />}
                <Press
                  style={styles.wordRow}
                  overlay={colors.material.pressFill}
                  onPress={() => openWord(w)}
                  accessibilityLabel={`${w.hanzi}, ${w.pinyin ? `${w.pinyin}, ` : ''}${w.meaning}. Edit word`}
                >
                  <Text style={styles.wordHanzi}>{w.hanzi}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.wordPinyin}>{w.pinyin}</Text>
                    <Text style={styles.wordMeaning}>{w.meaning}</Text>
                  </View>
                  <Text style={styles.wordDue}>{w.due <= today ? 'Due' : friendlyDate(w.due, today)}</Text>
                </Press>
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
    </GlassScroll>
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
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const color = tone === 'danger' ? colors.danger : tone === 'primary' ? colors.link : colors.text;
  return (
    <Glass tier="control" style={styles.gradeButton} onPress={onPress} accessibilityLabel={`${label}, ${sub}`}>
      <Text style={[styles.gradeLabel, { color }]}>{label}</Text>
      <Text style={styles.gradeSub}>{sub}</Text>
    </Glass>
  );
}

const makeStyles = ({ colors, kinds, fonts, type, radii, name }: Theme) =>
  StyleSheet.create({
    deckTile: {
      width: 56,
      height: 56,
      borderRadius: radii.inset,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: kinds.chinese.color,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    deckGlyph: { fontFamily: fonts.body, fontSize: 28, lineHeight: 34, color: colors.onKind },
    flex: { flex: 1 },
    content: { padding: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    todayCard: { padding: 16 },
    cardTitle: { ...type.sectionTitle, flexShrink: 1 },
    streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    streak: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    minutes: {
      fontFamily: fonts.display,
      fontSize: name === 'lavender' || name === 'paper' ? 40 : 34,
      lineHeight: name === 'lavender' || name === 'paper' ? 46 : 40,
      letterSpacing: name === 'paper' ? -0.8 : undefined,
      color: colors.text,
      marginTop: 8,
      fontVariant: ['tabular-nums'],
    },
    minutesOf: { fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.muted },
    track: { marginTop: 10 },
    small: { ...type.hint, marginTop: 16, marginBottom: 8 },
    chips: { flexDirection: 'row', gap: 8 },
    undo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    undoOff: { opacity: 0.45 },
    reviewCard: { padding: 16, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
    reviewTitle: { fontFamily: name === 'paper' ? fonts.bodyBold : fonts.bodyMedium, fontSize: 17, color: colors.text },
    starter: { marginTop: 16, gap: 8 },
    wordRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 10, paddingHorizontal: 14 },
    wordHanzi:
      name === 'paper'
        ? { fontFamily: fonts.body, fontSize: 26, lineHeight: 32, color: colors.text, minWidth: 56 }
        : { fontFamily: fonts.body, fontSize: 24, color: colors.text, minWidth: 52 },
    wordPinyin: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    wordMeaning: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 1 },
    wordDue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    reviewScreen: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
    reviewTop: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    reviewCount: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    card: {
      alignSelf: 'stretch',
      borderRadius: radii.hero,
      paddingVertical: 48,
      paddingHorizontal: 20,
      alignItems: 'center',
      gap: 10,
    },
    cardHanzi:
      name === 'stone'
        ? { fontFamily: 'DMSans_300Light', fontSize: 72, lineHeight: 88, color: colors.text }
        : { fontFamily: fonts.body, fontSize: 64, lineHeight: 80, color: colors.text },
    cardPinyin: { fontFamily: fonts.display, fontSize: 22, color: kinds.chinese.text },
    cardMeaning: { fontFamily: fonts.body, fontSize: 18, color: colors.text },
    cardHint: { ...type.hint, marginTop: 8 },
    grades: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
    gradeButton: { flex: 1, minHeight: 64, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    gradeLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
    gradeSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
    reviewDoneTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    reviewDoneText: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    doneButton: { alignSelf: 'stretch', marginTop: 12 },
  });
