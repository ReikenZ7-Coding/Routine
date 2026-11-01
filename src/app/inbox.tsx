import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { SceneArt } from '../components/Art';
import { Glass, GlassScroll } from '../components/Glass';
import { EASE_OUT, FadeSwap, Press, SelectFade } from '../components/Motion';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckRow } from '../components/CheckRow';
import { Divider, Section } from '../components/Section';
import { PageTitle } from '../components/PageTitle';
import { type InboxItem, inboxOpen, itemsFor, planFor, recentlyDone, toggleItem } from '../lib/inbox';
import { addDays, friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';

const SHOW = FadeIn.duration(180).easing(EASE_OUT);
const HIDE = FadeOut.duration(140).easing(EASE_OUT);

/** Quick to-dos: write them down now, put them on a day later. */
export default function InboxScreen() {
  const { colors, kinds, type, radii, name } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const lavender = name === 'lavender';
  const insets = useSafeAreaInsets();
  const { ready, today, inbox, updateInbox } = useStore();
  const contentBottom = useContentBottom();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  if (!ready) return <Skeleton label="Loading your inbox" />;

  const tomorrow = addDays(today, 1);
  const waiting = inboxOpen(inbox, today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const planned = inbox.filter((i) => !i.doneOn && i.date && i.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
  const done = recentlyDone(inbox, today);
  // Lavender: nothing to sort and nothing planned gets one scene card in place of the empty list.
  const clearDay = lavender && waiting.length === 0 && planned.length === 0;
  // Stone: the same moment as one quiet pane, with the tray in champagne.
  const stoneClear = (name === 'stone' || name === 'paper' || name === 'pine') && waiting.length === 0 && planned.length === 0;
  // Paper: the add button is always there, an ink-glass disc at the end of the composer, and the how-to sits in
  // its own small pane under the lists instead of at the foot of a card.
  const paper = name === 'paper';
  const pine = name === 'pine';

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    updateInbox((items) => [{ id: newId(), title, createdAt: new Date().toISOString() }, ...items]);
    setDraft('');
  };
  const change = (id: string, fn: (i: InboxItem) => InboxItem) => updateInbox((items) => items.map((i) => (i.id === id ? fn(i) : i)));
  const remove = (id: string) => updateInbox((items) => items.filter((i) => i.id !== id));

  const row = (item: InboxItem, i: number) => (
    <View key={item.id}>
      {i > 0 && <Divider />}
      <CheckRow
        tint={kinds.inbox.color}
        title={item.title}
        subtitle={
          item.date && !item.doneOn
            ? item.date < today
              ? `Was planned ${friendlyDate(item.date, today).toLowerCase()}`
              : friendlyDate(item.date, today)
            : undefined
        }
        done={!!item.doneOn}
        onToggle={() => change(item.id, (x) => toggleItem(x, today))}
        onLongPress={() => setOpen(open === item.id ? null : item.id)}
      />
      {open === item.id && (
        <View style={styles.actions}>
          {(
            [
              ['Today', today],
              ['Tomorrow', tomorrow],
              ['Inbox', undefined],
            ] as const
          ).map(([label, date]) => {
            const on = item.date === date;
            return (
              <Press
                key={label}
                style={styles.action}
                overlay={colors.material.pressFill}
                haptic
                onPress={() => {
                  change(item.id, (x) => planFor(x, date));
                  setOpen(null);
                }}
                accessibilityLabel={
                  label === 'Inbox' ? `Move ${item.title} back to the inbox` : `Plan ${item.title} for ${label.toLowerCase()}`
                }
                accessibilityState={{ selected: on }}
              >
                <SelectFade on={on} radius={radii.pill} bleed={1} style={styles.actionActive} />
                <FadeSwap
                  on={on}
                  off={<Text style={styles.actionText}>{label}</Text>}
                  onContent={<Text style={[styles.actionText, styles.actionTextActive]}>{label}</Text>}
                />
              </Press>
            );
          })}
          <Press
            style={styles.action}
            overlay={colors.material.pressFill}
            onPress={() => remove(item.id)}
            accessibilityLabel={`Delete ${item.title}`}
          >
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </Press>
        </View>
      )}
    </View>
  );

  return (
    <GlassScroll
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: contentBottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {colors.material.canopy ? (
        <PageTitle title="Inbox" subtitle="Jot down anything. Put it on a day when you're ready." bleed={insets.top + 16} />
      ) : (
        <>
          <Text style={type.title}>Inbox</Text>
          <Text style={[type.small, styles.intro]}>Jot down anything. Put it on a day when you're ready.</Text>
        </>
      )}

      <Text style={styles.label} nativeID="inbox-add-label">
        Add to inbox
      </Text>
      <Glass tier="control" radius={radii.pill} style={[styles.composer, (paper || pine) && styles.composerPaper]}>
        {!paper && !pine && <Ionicons name="add" size={20} color={colors.muted} />}
        <TextInput
          ref={input}
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Call Mum, book a trip…"
          placeholderTextColor={colors.faint}
          selectionColor={colors.link}
          cursorColor={colors.text}
          returnKeyType="done"
          submitBehavior="submit"
          accessibilityLabel="Add to inbox"
          accessibilityLabelledBy="inbox-add-label"
        />
        {paper || pine ? (
          <Press
            style={styles.inkDisc}
            hitSlop={4}
            haptic
            onPress={() => (draft.trim() ? add() : input.current?.focus())}
            accessibilityLabel="Add to inbox"
          >
            <Ionicons name="add" size={22} color={colors.onPrimary} />
          </Press>
        ) : draft.trim() ? (
          <Animated.View entering={SHOW} exiting={HIDE}>
            <Press
              style={lavender ? styles.addDisc : styles.addButton}
              overlay={colors.material.pressFill}
              haptic
              onPress={add}
              accessibilityLabel="Add to inbox"
            >
              <Ionicons name="arrow-up" size={20} color={lavender ? colors.onNode : colors.onPrimary} />
            </Press>
          </Animated.View>
        ) : null}
      </Glass>

      {clearDay ? (
        // Nothing to sort and nothing planned: a quiet scene says so, and offers the one thing to do here.
        <Glass tier="hero" style={styles.clear}>
          <View style={styles.clearArt}>
            <SceneArt width={width - 32} height={160} variant="dusk" />
          </View>
          <View style={styles.clearBody}>
            <Text style={styles.clearTitle}>Clear head, clear day</Text>
            <Text style={type.hint}>Nothing waiting. Write down the next thing on your mind and it lands here.</Text>
            <Press onPress={() => input.current?.focus()} style={styles.whitePill} haptic accessibilityLabel="Add a to-do">
              <Ionicons name="add" size={18} color={colors.onNode} />
              <Text style={styles.whitePillText}>Add a to-do</Text>
            </Press>
          </View>
        </Glass>
      ) : null}

      {stoneClear ? (
        <Glass style={styles.stoneClear}>
          {pine ? (
            <MoonPine color={colors.accent} />
          ) : (
            <View style={styles.stoneTray}>
              <Ionicons name="file-tray-outline" size={28} color={colors.accent} />
            </View>
          )}
          <Text style={styles.stoneClearTitle}>{pine ? 'Inbox zero' : 'Nothing to sort'}</Text>
          <Text style={styles.stoneClearText}>
            {pine
              ? 'Anything you jot down lands here, until you give it a day.'
              : 'When something crosses your mind, write it above. It waits here until you give it a day.'}
          </Text>
        </Glass>
      ) : null}

      {!clearDay && !stoneClear && (
        <Section
          enter={0}
          title={`To sort · ${waiting.length}`}
          dot={paper ? undefined : kinds.inbox.color}
          footer={waiting.length > 0 && !paper ? 'Tap to tick off. Press and hold to plan it for today or tomorrow.' : undefined}
        >
          {waiting.length === 0 ? <Text style={styles.empty}>All clear. New to-dos land here.</Text> : waiting.map(row)}
        </Section>
      )}

      {planned.length > 0 && (
        <Section enter={1} title="Planned">
          {planned.map(row)}
        </Section>
      )}
      {done.length > 0 && (
        <Section enter={2} title="Done this week">
          {done.map(row)}
        </Section>
      )}
      {paper && waiting.length + planned.length > 0 && (
        <Glass style={styles.hint}>
          <View style={styles.hintPebble}>
            <Ionicons name="hand-left-outline" size={18} color={colors.text} />
          </View>
          <Text style={[type.hint, styles.flex]}>Tap to tick off. Press and hold to plan it for today or tomorrow.</Text>
        </Glass>
      )}
    </GlassScroll>
  );
}

/** Pine's empty inbox: a faceted pine under a crescent moon, drawn in one mint line. */
function MoonPine({ color }: { color: string }) {
  return (
    <Svg width={96} height={72} viewBox="0 0 96 72" style={{ opacity: 0.8, marginBottom: 12 }} accessibilityElementsHidden>
      <Path d="M70 10a12 12 0 1 0 11 17a10 10 0 0 1-11-17z" stroke={color} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
      <Path
        d="M34 8 L22 28 h7 L17 46 h9 L12 64 h44 L42 46 h9 L39 28 h7 Z M34 64 v6"
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path d="M34 8 v56" stroke={color} strokeWidth={1} opacity={0.5} />
    </Svg>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { paddingHorizontal: 16 },
    composerPaper: { paddingLeft: 20, paddingRight: 8 },
    inkDisc: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: colors.litGlow,
    },
    hint: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
    hintPebble: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    intro: { marginTop: 4 },
    label: { ...type.label, marginTop: 20, marginBottom: 8 },
    composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, minHeight: 56 },
    // Positioned, so on the web it paints above the glass's absolute layers (a static input sits under them).
    input: { flex: 1, position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, minHeight: 50 },
    addButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addDisc: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.node,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.material.control.shadow,
    },
    clear: { marginTop: 20, padding: 0 },
    clearArt: { height: 160, overflow: 'hidden' },
    clearBody: { padding: 18, gap: 6 },
    clearTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
    whitePill: {
      marginTop: 10,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: colors.node,
      boxShadow: colors.material.control.shadow,
    },
    whitePillText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onNode },
    empty: { padding: 16, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    stoneClear: { marginTop: 24, padding: 22, alignItems: 'flex-start', gap: 6 },
    stoneTray: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    stoneClearTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
    stoneClearText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 52, paddingRight: 16, paddingBottom: 12 },
    action: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionActive: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    actionText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    actionTextActive: { color: colors.onPrimary },
  });
