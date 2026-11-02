// Language on the desktop: today's practice and the review card side by side with the focus timer and your words.
// The card turns with Space or Enter and takes 1, 2 and 3 for Again, Good and Easy while it has focus. The same
// words, minutes and spacing as the phone's Language tab (lib/language).
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import {
  type Grade,
  type StudyLanguage,
  type Word,
  addLanguage,
  addMinutes,
  currentLanguage,
  dueWords,
  infoFor,
  inLine,
  isRtl,
  languageOf,
  newWord,
  removeLanguage,
  review,
  starterFor,
  streakDays,
  todaysLog,
  wordsFor,
} from '../../lib/language';
import { plural } from '../../lib/plural';
import { friendlyDate } from '../../lib/schedule';
import { newId, useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { FocusTimer } from '../FocusTimer';
import { LanguagePicker, LanguageTile } from '../LanguagePicker';
import { GradeButton, LanguageSheet } from '../LanguageSheet';
import { Bar, Collapse } from '../Motion';
import { Segmented } from '../Segmented';
import { Sheet } from '../Sheet';
import { WordForm } from '../WordForm';
import { Hover } from './Hover';
import { ChipRow, Empty, IconButton, Pill, SearchField, useRowText } from './Kit';
import { Column, Fig, GlassButton, Page, Panel, Row } from './Page';

const TARGETS = [10, 15, 20, 30];
const QUICK_MINUTES = [5, 10, 15];

function cardSize(word: string): number {
  const n = Array.from(word).length;
  return n <= 4 ? 72 : n <= 8 ? 56 : n <= 16 ? 40 : 30;
}

export function LanguagePage() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const text = useRowText();
  const { today, language: state, updateLanguage, damaged } = useStore();
  const [editing, setEditing] = useState<Word | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState<StudyLanguage | undefined>();
  const [query, setQuery] = useState('');

  const pick = (lang: StudyLanguage) => {
    updateLanguage((s) => addLanguage(s, lang, today, newId));
    setAdding(false);
  };
  const lang = currentLanguage(state);

  if (!lang) {
    return (
      <Page title="Language" subtitle="A little practice every day.">
        <Row>
          <Panel span={8} index={0} title="Which language are you learning?" subtitle="Pick one to start; you can add more any time">
            <Text style={[type.hint, styles.gap]}>The ones at the top come with eight beginner words.</Text>
            {damaged.includes('language') ? (
              <View style={styles.damaged} role="alert">
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.damagedText}>
                  Your saved practice couldn't be read, so it's been set aside and this page starts fresh. Restoring a backup from Settings
                  brings your words back.
                </Text>
              </View>
            ) : null}
            <View style={styles.picker}>
              <LanguagePicker learning={[]} onPick={pick} />
            </View>
          </Panel>
        </Row>
      </Page>
    );
  }

  const info = infoFor(lang);
  const words = wordsFor(state, lang.id);
  const log = todaysLog(state, today);
  const due = dueWords(state, today, lang.id);
  const streak = streakDays(state, today);
  const several = state.languages.length > 1;
  const starter = starterFor(lang);
  const rtl = isRtl(lang);
  const q = query.trim().toLowerCase();
  const shown = [...words]
    .filter((w) => !q || [w.hanzi, w.pinyin, w.meaning].some((x) => x?.toLowerCase().includes(q)))
    .sort((a, b) => a.due.localeCompare(b.due));
  const openWord = (w?: Word) => {
    setEditing(w);
    setFormOpen(true);
  };

  return (
    <Page
      title={lang.name}
      subtitle={
        <>
          <Fig>{plural(words.length, 'word')}</Fig> ·{' '}
          <Fig>
            {log.minutes} of {state.target}
          </Fig>{' '}
          min today
          {streak > 0 ? (
            <>
              {' · '}
              <Fig>{plural(streak, 'day')}</Fig> in a row
            </>
          ) : null}
          {info.native !== lang.name ? ` · ${inLine(info.native)}` : ''}
        </>
      }
      actions={<GlassButton label="Add a word" icon="add" onPress={() => openWord()} />}
    >
      {several ? (
        state.languages.length <= 4 ? (
          <View style={styles.switch}>
            <Segmented
              dense
              accessibilityLabel="Learning"
              options={state.languages.map((l) => ({ key: l.id, label: l.name }))}
              value={lang.id}
              onChange={(id) => updateLanguage((s) => ({ ...s, current: id }))}
            />
          </View>
        ) : (
          <ChipRow
            caption="Learning"
            options={state.languages.map((l) => ({ key: l.id, label: l.name }))}
            value={lang.id}
            onChange={(id) => updateLanguage((s) => ({ ...s, current: id }))}
          />
        )
      ) : null}
      <Row>
        <Column span={8}>
          <Panel
            span={8}
            index={0}
            title="Today's practice"
            subtitle={several ? 'Minutes count for all your languages' : 'Log the time you practised'}
          >
            <View style={styles.practice}>
              <View style={styles.flex}>
                <Text style={styles.minutes} accessibilityLabel={`${log.minutes} of ${state.target} minutes`}>
                  {log.minutes} <Text style={styles.minutesOf}>/ {state.target} min</Text>
                </Text>
                <View style={styles.track}>
                  <Bar progress={Math.min(1, log.minutes / state.target)} color={kinds.chinese.color} track={colors.track} height={8} />
                </View>
              </View>
              <View style={styles.quick}>
                {QUICK_MINUTES.map((m) => (
                  <Pill
                    key={m}
                    label={`+${m}`}
                    onPress={() => updateLanguage((s) => addMinutes(s, today, m))}
                    accessibilityLabel={`Log ${m} minutes`}
                  />
                ))}
                <IconButton
                  icon="arrow-undo"
                  label="Undo last 5 minutes"
                  size={36}
                  disabled={log.minutes === 0}
                  onPress={() => updateLanguage((s) => addMinutes(s, today, -5))}
                />
              </View>
            </View>
            <Text style={[type.label, styles.targetLabel]}>Daily target</Text>
            <View style={styles.target}>
              <Segmented
                dense
                accessibilityLabel="Daily target"
                options={TARGETS.map((t) => ({ key: String(t), label: `${t} min` }))}
                value={String(state.target)}
                onChange={(k) => updateLanguage((s) => ({ ...s, target: Number(k) }))}
              />
            </View>
          </Panel>
          <ReviewPanel
            lang={lang}
            words={words}
            due={due}
            reviewedToday={log.reviewed}
            starter={starter.length}
            onStarter={() =>
              updateLanguage((s) => ({
                ...s,
                words: [...s.words, ...starter.map(([w, r, m]) => newWord(newId(), w, r, m, lang.id, today))],
              }))
            }
            onAdd={() => openWord()}
          />
          {/* Under the practice, so the two columns end close together. */}
          <Panel
            span={8}
            index={4}
            title={several ? 'Your languages' : 'Your language'}
            right={<IconButton icon="add" label="Add a language" size={36} onPress={() => setAdding(true)} />}
          >
            {state.languages.map((l, i) => {
              const n = wordsFor(state, l.id).length;
              const native = infoFor(l).native;
              return (
                <Hover
                  key={l.id}
                  onPress={() => setManaging(l)}
                  style={[styles.langRow, i > 0 && styles.rule]}
                  radius={10}
                  accessibilityLabel={`${l.name}, ${plural(n, 'word')}${l.id === lang.id ? ', showing now' : ''}. Options`}
                >
                  <LanguageTile lang={l} />
                  <View style={styles.flex}>
                    <Text style={text.rowTitle}>{l.name}</Text>
                    <Text
                      style={text.rowMeta}
                      numberOfLines={1}
                    >{`${native !== l.name ? `${inLine(native)} · ` : ''}${plural(n, 'word')}`}</Text>
                  </View>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
                </Hover>
              );
            })}
            {several ? (
              <Text style={[type.small, styles.gap]}>Minutes, the daily target and the streak are shared by all your languages.</Text>
            ) : null}
          </Panel>
        </Column>
        <Column span={4}>
          <Panel span={4} index={2} title="Focus" subtitle="A timer that logs its minutes when it ends">
            <FocusTimer bare onLog={(m) => updateLanguage((s) => addMinutes(s, today, m))} />
          </Panel>
          <Panel span={4} index={3} title={`My words · ${words.length}`} subtitle="Soonest review first">
            {words.length === 0 ? (
              <Empty>No words yet. Add your own, or start with the beginner words.</Empty>
            ) : (
              <>
                <SearchField
                  id="words-search"
                  label="Search your words"
                  value={query}
                  onChange={setQuery}
                  placeholder="Word or meaning"
                  width="100%"
                />
                <View style={styles.words}>
                  {shown.length === 0 ? (
                    <Empty>Nothing matches “{query.trim()}”.</Empty>
                  ) : (
                    shown.slice(0, 40).map((w, i) => (
                      <Hover
                        key={w.id}
                        onPress={() => openWord(w)}
                        style={[styles.wordRow, i > 0 && styles.rule]}
                        radius={10}
                        accessibilityLabel={`${w.hanzi}, ${w.pinyin ? `${w.pinyin}, ` : ''}${w.meaning}. Edit word`}
                      >
                        <View style={styles.flex}>
                          <Text style={[styles.word, rtl && styles.rtl]}>{w.hanzi}</Text>
                          <Text style={text.rowMeta} numberOfLines={1}>
                            {w.pinyin ? <Text style={{ color: kinds.chinese.text }}>{`${w.pinyin}  ·  `}</Text> : null}
                            {w.meaning}
                          </Text>
                        </View>
                        <Text style={styles.due}>{w.due <= today ? 'Due' : friendlyDate(w.due, today)}</Text>
                      </Hover>
                    ))
                  )}
                  {shown.length > 40 ? <Text style={[type.small, styles.gap]}>{shown.length - 40} more: search to find one.</Text> : null}
                </View>
              </>
            )}
          </Panel>
        </Column>
      </Row>

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
        <Text style={[type.hint, styles.sheetText]}>It joins your daily practice, with its own words and reviews.</Text>
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
    </Page>
  );
}

/** Review, in place: the card at desktop size. Space or Enter turns it; 1, 2 and 3 grade it while it has focus. */
function ReviewPanel({
  lang,
  words,
  due,
  reviewedToday,
  starter,
  onStarter,
  onAdd,
}: {
  lang: StudyLanguage;
  words: Word[];
  due: Word[];
  reviewedToday: number;
  starter: number;
  onStarter: () => void;
  onAdd: () => void;
}) {
  const { kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, language: state, updateLanguage } = useStore();
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const current = useMemo(() => (queue ? state.words.find((w) => w.id === queue[0]) : undefined), [queue, state.words]);
  const finish = () => {
    setQueue(null);
    setRevealed(false);
  };
  const grade = (g: Grade) => {
    if (!current) return;
    updateLanguage((s) => review(s, today, current.id, g));
    setQueue((q) => (q ? (g === 'again' ? [...q.slice(1), q[0]] : q.slice(1)) : q));
    setRevealed(false);
  };
  // 1, 2 and 3 grade the card, only while the card itself has focus (so typing elsewhere never grades).
  const keys = useRef({ grade, revealed });
  keys.current = { grade, revealed };
  useEffect(() => {
    if (!focused || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !keys.current.revealed) return;
      const g = ({ '1': 'again', '2': 'good', '3': 'easy' } as Record<string, Grade>)[e.key];
      if (g) {
        e.preventDefault();
        keys.current.grade(g);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focused]);

  const title = queue
    ? current
      ? `${queue.length} left`
      : 'Review done'
    : words.length === 0
      ? 'Flashcards'
      : due.length
        ? `${plural(due.length, 'word')} to review`
        : 'All caught up';
  const sub = queue
    ? current
      ? 'Space or Enter turns the card; then 1, 2 or 3'
      : `${plural(reviewedToday, 'card')} reviewed today. Nice work.`
    : words.length === 0
      ? 'Add words and they come back for review just before you forget them'
      : due.length
        ? 'Words come back for review just before you forget them'
        : 'Come back tomorrow for your next review';

  return (
    <Panel
      span={8}
      index={1}
      title={title}
      subtitle={sub}
      right={
        queue ? (
          <GlassButton
            label={current ? 'Stop' : 'Back to practice'}
            icon={current ? 'close' : undefined}
            onPress={finish}
            accessibilityLabel={current ? 'Stop the review' : undefined}
          />
        ) : due.length ? (
          <GlassButton
            label="Start review"
            onPress={() => setQueue(due.map((w) => w.id))}
            accessibilityLabel={`Review ${plural(due.length, `${lang.name} word`)}`}
          />
        ) : undefined
      }
    >
      {queue && current ? (
        <>
          <Hover
            onPress={() => setRevealed((r) => !r)}
            style={styles.card}
            radius={24}
            onFocusChange={setFocused}
            accessibilityLabel={
              revealed
                ? `${current.hanzi}, ${current.pinyin ? `${current.pinyin}, ` : ''}${current.meaning}. Grade it with 1, 2 or 3`
                : `${current.hanzi}. Show the answer`
            }
          >
            <Text
              style={[
                styles.cardWord,
                { fontSize: cardSize(current.hanzi), lineHeight: Math.round(cardSize(current.hanzi) * 1.3) },
                isRtl(languageOf(state, current)) && styles.rtlCentre,
              ]}
            >
              {current.hanzi}
            </Text>
            {/* The answer fades in where the hint was, and the grades below it (Collapse eases the card's height). */}
            <Collapse open={revealed}>
              <View style={styles.answer}>
                {current.pinyin ? <Text style={[styles.cardReading, { color: kinds.chinese.text }]}>{current.pinyin}</Text> : null}
                <Text style={styles.cardMeaning}>{current.meaning}</Text>
              </View>
            </Collapse>
            <Collapse open={!revealed}>
              <Text style={[type.hint, styles.gap]}>Click, or press Space or Enter, to show the answer</Text>
            </Collapse>
          </Hover>
          <Collapse open={revealed}>
            <View style={styles.grades}>
              <GradeButton label="Again" sub="see it again · 1" onPress={() => grade('again')} tone="danger" />
              <GradeButton label="Good" sub="got it · 2" onPress={() => grade('good')} tone="primary" />
              <GradeButton label="Easy" sub="too easy · 3" onPress={() => grade('easy')} tone="muted" />
            </View>
          </Collapse>
        </>
      ) : queue ? (
        <View style={styles.doneRow}>
          <Ionicons name="checkmark-circle" size={40} color={kinds.chinese.color} />
          <Text style={type.body}>Every card in today's review has had its turn.</Text>
        </View>
      ) : words.length === 0 ? (
        <View style={styles.starter}>
          {starter > 0 ? <GlassButton label={`Start with ${starter} beginner words`} onPress={onStarter} /> : null}
          <GlassButton label="Add my own words" icon="add" onPress={onAdd} />
        </View>
      ) : null}
    </Panel>
  );
}

const makeStyles = ({ colors, fonts }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    gap: { marginTop: 8 },
    rule: { borderTopWidth: 1, borderTopColor: colors.border },
    damaged: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
    damagedText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
    picker: { marginTop: 8, marginHorizontal: -14 },
    switch: { maxWidth: 520 },
    practice: { flexDirection: 'row', alignItems: 'flex-end', gap: 24 },
    minutes: {
      fontFamily: fonts.display,
      fontSize: 44,
      lineHeight: 50,
      letterSpacing: -0.8,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    minutesOf: { fontFamily: fonts.bodyMedium, fontSize: 17, color: colors.muted },
    track: { marginTop: 10 },
    quick: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    targetLabel: { marginTop: 20, marginBottom: 8 },
    target: { maxWidth: 420 },
    card: {
      minHeight: 240,
      paddingVertical: 40,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      borderRadius: 24,
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    cardWord: { fontFamily: fonts.word, color: colors.text, textAlign: 'center' },
    rtlCentre: { writingDirection: 'rtl' },
    answer: { alignItems: 'center', gap: 10 },
    cardReading: { fontFamily: fonts.display, fontSize: 24, textAlign: 'center' },
    cardMeaning: { fontFamily: fonts.body, fontSize: 20, color: colors.text, textAlign: 'center' },
    grades: { flexDirection: 'row', gap: 12, marginTop: 12 },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    starter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    words: { marginTop: 12 },
    wordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingVertical: 8,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    word: { fontFamily: fonts.body, fontSize: 20, lineHeight: 30, color: colors.text },
    rtl: { writingDirection: 'rtl', textAlign: 'right' },
    due: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingVertical: 8,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    sheetText: { marginBottom: 8 },
    sheetList: { marginHorizontal: -14 },
  });
};
