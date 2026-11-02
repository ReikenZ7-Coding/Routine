import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ActionChip, Chip } from '../components/Chip';
import { FocusTimer } from '../components/FocusTimer';
import { LanguagePicker, LanguageTile } from '../components/LanguagePicker';
import { Divider, Section } from '../components/Section';
import { PageTitle } from '../components/PageTitle';
import { ConfirmDelete, Sheet } from '../components/Sheet';
import { WordForm } from '../components/WordForm';
import {
  type Grade,
  inLine,
  type StudyLanguage,
  type Word,
  addLanguage,
  addMinutes,
  currentLanguage,
  dueWords,
  infoFor,
  isRtl,
  languageOf,
  newWord,
  removeLanguage,
  review,
  starterFor,
  streakDays,
  todaysLog,
  wordsFor,
} from '../lib/language';
import { friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass, GlassScroll } from '../components/Glass';
import { FilterRow, Segmented } from '../components/Segmented';
import { Bar, Enter, Press } from '../components/Motion';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { plural } from '../lib/plural';

const TARGETS = [10, 15, 20, 30];
const QUICK_MINUTES = [5, 10, 15];

/** The flashcard's word shrinks with its length, so a phrase fits as well as a single character does. */
function cardSize(word: string): number {
  const n = Array.from(word).length;
  return n <= 4 ? 64 : n <= 8 ? 48 : n <= 16 ? 36 : 28;
}

export default function LanguageScreen() {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const { ready, today, language: state, updateLanguage, damaged } = useStore();
  const contentBottom = useContentBottom();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState<Word | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<StudyLanguage | undefined>();

  if (!ready) return <Skeleton label="Loading your practice" />;

  const pick = (lang: StudyLanguage) => {
    updateLanguage((s) => addLanguage(s, lang, today, newId));
    setAdding(false);
  };

  const lang = currentLanguage(state);

  // First visit: choose a language, on the tab itself.
  if (!lang) {
    return (
      // Keyed, so choosing a language opens its page from the top rather than at the chooser's scroll.
      <GlassScroll key="choose" contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
        <PageTitle title="Language" subtitle="A little practice every day" />
        <Enter index={0}>
          <Glass style={styles.chooser}>
            <View style={styles.chooserHead}>
              <Text style={styles.chooserTitle} accessibilityRole="header">
                Which language are you learning?
              </Text>
              <Text style={styles.chooserText}>
                Pick one to start; you can add more any time. The ones at the top come with eight beginner words.
              </Text>
              {damaged.includes('language') && (
                // A save that couldn't be read is set aside, never written over, so it isn't lost by choosing again.
                <View style={styles.damaged} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.damagedText}>
                    Your saved practice couldn't be read, so it's been set aside and this page starts fresh. Restoring a backup from
                    Settings brings your words back.
                  </Text>
                </View>
              )}
            </View>
            <LanguagePicker learning={[]} onPick={pick} />
          </Glass>
        </Enter>
      </GlassScroll>
    );
  }

  const info = infoFor(lang);
  const words = wordsFor(state, lang.id);
  const log = todaysLog(state, today);
  const due = dueWords(state, today, lang.id);
  const streak = streakDays(state, today);
  const pct = Math.min(1, log.minutes / state.target);
  const several = state.languages.length > 1;
  const starter = starterFor(lang);

  const openWord = (w?: Word) => {
    setEditing(w);
    setFormOpen(true);
  };

  // Review mode: one card at a time from a fixed queue.
  if (queue) {
    const current = state.words.find((w) => w.id === queue[0]);
    const finish = () => {
      setQueue(null);
      setRevealed(false);
    };
    if (!current) {
      return (
        <View style={styles.reviewScreen}>
          <Ionicons name="checkmark-circle" size={56} color={kinds.chinese.color} />
          <Text style={styles.reviewDoneTitle}>Review done</Text>
          <Text style={styles.reviewDoneText}>{plural(log.reviewed, 'card')} reviewed today. Nice work.</Text>
          <Button label="Back to practice" onPress={finish} style={styles.doneButton} />
        </View>
      );
    }
    const grade = (g: Grade) => {
      updateLanguage((s) => review(s, today, current.id, g));
      // "Again" puts the card at the back of today's queue.
      setQueue((q) => (q ? (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)) : q));
      setRevealed(false);
    };
    const size = cardSize(current.hanzi);
    const rtl = isRtl(languageOf(state, current));
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
          <Text style={[styles.cardWord, { fontSize: size, lineHeight: Math.round(size * 1.3) }, rtl && styles.rtlCentre]}>
            {current.hanzi}
          </Text>
          {revealed ? (
            <>
              {current.pinyin ? <Text style={styles.cardReading}>{current.pinyin}</Text> : null}
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

  const rtl = isRtl(lang);
  return (
    <GlassScroll key="practice" contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}>
      <PageTitle
        title={lang.name}
        subtitle={info.native !== lang.name ? `${inLine(info.native)} · daily practice and flashcards` : 'Daily practice and flashcards'}
        badge={plural(words.length, 'word')}
      />
      {several && (
        <View style={styles.switcher}>
          <FilterRow
            caption="Learning"
            options={state.languages.map((l) => ({ key: l.id, label: l.name }))}
            value={lang.id}
            onChange={(id) => updateLanguage((s) => ({ ...s, current: id }))}
          />
        </View>
      )}
      <Enter index={0}>
        <Glass style={styles.todayCard}>
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
          <Text style={styles.minutes} accessibilityLabel={`${log.minutes} of ${state.target} minutes`}>
            {log.minutes} <Text style={styles.minutesOf}>/ {state.target} min</Text>
          </Text>
          <View style={styles.track}>
            <Bar progress={pct} color={kinds.chinese.color} track={colors.track} height={8} />
          </View>
          <Text style={styles.small}>
            {several ? 'Log the time you practised, in any of your languages' : 'Log the time you practised'}
          </Text>
          <View style={styles.chips}>
            {QUICK_MINUTES.map((m) => (
              <Chip
                key={m}
                label={`+${m}`}
                active={false}
                outerStyle={styles.flex}
                accessibilityLabel={`Log ${m} minutes`}
                onPress={() => updateLanguage((s) => addMinutes(s, today, m))}
              />
            ))}
            <Press
              style={[styles.undo, log.minutes === 0 && styles.undoOff]}
              overlay={colors.material.pressFill}
              disabled={log.minutes === 0}
              onPress={() => updateLanguage((s) => addMinutes(s, today, -5))}
              accessibilityLabel="Undo last 5 minutes"
            >
              <Ionicons name="arrow-undo" size={18} color={colors.text} />
            </Press>
          </View>
          <Text style={styles.small}>Daily target</Text>
          <Segmented
            accessibilityLabel="Daily target"
            options={TARGETS.map((t) => ({ key: String(t), label: `${t} min` }))}
            value={String(state.target)}
            onChange={(k) => updateLanguage((s) => ({ ...s, target: Number(k) }))}
          />
        </Glass>
      </Enter>

      <Enter index={1}>
        <FocusTimer onLog={(m) => updateLanguage((s) => addMinutes(s, today, m))} />
      </Enter>

      <Enter index={2}>
        <Glass style={styles.reviewCard}>
          <View style={styles.flex}>
            <Text style={styles.reviewTitle}>
              {words.length === 0 ? 'Flashcards' : due.length ? `${plural(due.length, 'word')} to review` : 'All caught up'}
            </Text>
            <Text style={styles.small}>
              {words.length === 0
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
              accessibilityLabel={`Review ${plural(due.length, `${lang.name} word`)}`}
            />
          )}
        </Glass>
      </Enter>

      {words.length === 0 ? (
        <View style={styles.starter}>
          {starter.length > 0 && (
            <Button
              label={`Start with ${starter.length} beginner words`}
              variant="secondary"
              onPress={() =>
                updateLanguage((s) => ({
                  ...s,
                  words: [...s.words, ...starter.map(([w, r, m]) => newWord(newId(), w, r, m, lang.id, today))],
                }))
              }
            />
          )}
          <Button label="Add my own words" variant={starter.length ? 'plain' : 'secondary'} icon="add" onPress={() => openWord()} />
        </View>
      ) : (
        <Section
          enter={3}
          title={`My words · ${words.length}`}
          right={<ActionChip icon="add" label="Add word" onPress={() => openWord()} />}
        >
          {[...words]
            .sort((a, b) => a.due.localeCompare(b.due))
            .map((w, i) => (
              <View key={w.id}>
                {i > 0 && <Divider inset={14} />}
                <Press
                  style={styles.wordRow}
                  overlay={colors.material.pressFill}
                  onPress={() => openWord(w)}
                  accessibilityLabel={`${w.hanzi}, ${w.pinyin ? `${w.pinyin}, ` : ''}${w.meaning}. Edit word`}
                >
                  <View style={styles.flex}>
                    {/* Each line keeps its own direction: an Arabic word sits on the right across the whole row, and
                        the due label moves down beside its meaning, so the two never meet in the middle. */}
                    <Text style={[styles.word, rtl && styles.rtl]}>{w.hanzi}</Text>
                    <View style={rtl ? styles.wordLine : undefined}>
                      <Text style={[styles.wordMeaning, rtl && styles.flex]}>
                        {w.pinyin ? <Text style={styles.wordReading}>{`${w.pinyin}  ·  `}</Text> : null}
                        {w.meaning}
                      </Text>
                      {rtl && <Text style={styles.wordDue}>{w.due <= today ? 'Due' : friendlyDate(w.due, today)}</Text>}
                    </View>
                  </View>
                  {!rtl && <Text style={styles.wordDue}>{w.due <= today ? 'Due' : friendlyDate(w.due, today)}</Text>}
                </Press>
              </View>
            ))}
        </Section>
      )}

      <Section
        enter={4}
        title={several ? 'Your languages' : 'Your language'}
        right={<ActionChip icon="add" label="Add language" onPress={() => setAdding(true)} />}
        footer={several ? 'Minutes, the daily target and the streak are shared by all your languages.' : undefined}
      >
        {state.languages.map((l, i) => {
          const n = wordsFor(state, l.id).length;
          const native = infoFor(l).native;
          return (
            <View key={l.id}>
              {i > 0 && <Divider inset={68} />}
              <Press
                style={styles.langRow}
                overlay={colors.material.pressFill}
                onPress={() => setManaging(l)}
                accessibilityRole="button"
                accessibilityLabel={`${l.name}, ${plural(n, 'word')}${l.id === lang.id ? ', showing now' : ''}`}
                accessibilityHint="Opens its options"
              >
                <LanguageTile lang={l} />
                <View style={styles.flex}>
                  <Text style={styles.langName}>{l.name}</Text>
                  <Text style={styles.langMeta} numberOfLines={1}>
                    {`${native !== l.name ? `${inLine(native)} · ` : ''}${plural(n, 'word')}`}
                  </Text>
                </View>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
              </Press>
            </View>
          );
        })}
      </Section>

      <WordForm
        visible={formOpen}
        language={editing ? (languageOf(state, editing) ?? lang) : lang}
        word={editing}
        onClose={() => setFormOpen(false)}
        onSave={(f) => {
          updateLanguage((s) =>
            editing
              ? { ...s, words: s.words.map((w) => (w.id === editing.id ? { ...w, ...f } : w)) }
              : { ...s, words: [...s.words, newWord(newId(), f.hanzi, f.pinyin, f.meaning, lang.id, today)] },
          );
          setFormOpen(false);
        }}
        onDelete={
          editing
            ? () => {
                updateLanguage((s) => ({ ...s, words: s.words.filter((w) => w.id !== editing.id) }));
                setFormOpen(false);
              }
            : undefined
        }
      />

      <Sheet visible={adding} title="Add a language" onClose={() => setAdding(false)}>
        <Text style={styles.sheetText}>It joins your daily practice, with its own words and reviews.</Text>
        <View style={styles.sheetList}>
          <LanguagePicker learning={state.languages.map((l) => l.id)} onPick={pick} />
        </View>
      </Sheet>

      <LanguageSheet
        lang={managing}
        showing={managing?.id === lang.id}
        words={managing ? wordsFor(state, managing.id).length : 0}
        onClose={() => setManaging(undefined)}
        onShow={() => {
          if (managing) updateLanguage((s) => ({ ...s, current: managing.id }));
          setManaging(undefined);
        }}
        onRemove={() => {
          if (managing) updateLanguage((s) => removeLanguage(s, managing.id));
          setManaging(undefined);
        }}
      />
    </GlassScroll>
  );
}

/** One language's options: practise it, or stop learning it (which asks first, and says its words go too). */
function LanguageSheet({
  lang,
  showing,
  words,
  onClose,
  onShow,
  onRemove,
}: {
  lang?: StudyLanguage;
  showing: boolean;
  words: number;
  onClose: () => void;
  onShow: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles(makeStyles);
  // Holds the last language while the sheet slides away, so its content doesn't blank out mid-exit.
  const [shown, setShown] = useState(lang);
  if (lang && lang !== shown) setShown(lang);
  const l = lang ?? shown;
  const native = l ? infoFor(l).native : '';
  return (
    <Sheet visible={!!lang} title={l?.name ?? ''} onClose={onClose}>
      {l ? (
        <>
          <Text style={styles.sheetText}>{`${native !== l.name ? `${inLine(native)} · ` : ''}${plural(words, 'word')}`}</Text>
          {!showing && <Button label={`Practise ${l.name}`} onPress={onShow} style={styles.sheetButton} />}
          <ConfirmDelete
            label={`Remove ${l.name}`}
            question={
              words > 0
                ? `Remove ${l.name}? Its ${plural(words, 'word')} go too. Your practice minutes and streak stay.`
                : `Remove ${l.name}? Your practice minutes and streak stay.`
            }
            confirmLabel="Remove"
            onConfirm={onRemove}
          />
        </>
      ) : null}
    </Sheet>
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

const makeStyles = ({ colors, kinds, fonts, type, radii }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    chooser: { paddingVertical: 8 },
    chooserHead: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, gap: 6 },
    chooserTitle: type.sectionTitle,
    chooserText: type.hint,
    damaged: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
    damagedText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
    wordLine: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
    switcher: { marginBottom: 16 },
    todayCard: { padding: 16 },
    cardTitle: { ...type.sectionTitle, flexShrink: 1 },
    streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    streak: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    minutes: {
      fontFamily: fonts.display,
      fontSize: 40,
      lineHeight: 46,
      letterSpacing: -0.8,
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
    reviewTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
    starter: { marginTop: 16, gap: 8 },
    wordRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14 },
    // Generous line height, so scripts with tall marks (Thai, Hindi, Vietnamese) never clip.
    word: { fontFamily: fonts.body, fontSize: 20, lineHeight: 30, color: colors.text },
    rtl: { writingDirection: 'rtl', textAlign: 'right' },
    rtlCentre: { writingDirection: 'rtl' },
    wordReading: { fontFamily: fonts.body, fontSize: 14, color: kinds.chinese.text },
    wordMeaning: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 1 },
    wordDue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    langRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 8, paddingHorizontal: 14 },
    langName: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.text },
    langMeta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
    sheetText: { ...type.hint, marginBottom: 8 },
    sheetList: { marginHorizontal: -14 },
    sheetButton: { marginTop: 16 },
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
    cardWord: {
      // The look's flashcard face (Stone sets the word in its light face).
      fontFamily: fonts.word,
      color: colors.text,
      textAlign: 'center',
    },
    cardReading: { fontFamily: fonts.display, fontSize: 22, color: kinds.chinese.text, textAlign: 'center' },
    cardMeaning: { fontFamily: fonts.body, fontSize: 18, color: colors.text, textAlign: 'center' },
    cardHint: { ...type.hint, marginTop: 8 },
    grades: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
    gradeButton: { flex: 1, minHeight: 64, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    gradeLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
    gradeSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
    reviewDoneTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
    reviewDoneText: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    doneButton: { alignSelf: 'stretch', marginTop: 12 },
  });
