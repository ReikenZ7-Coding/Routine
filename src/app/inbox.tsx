import { Ionicons } from '@expo/vector-icons';
import { useDesktop } from '../components/desktop/context';
import { InboxPage } from '../components/desktop/InboxPage';
import { type ComponentRef, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Glass, GlassScroll } from '../components/Glass';
import { FadeSwap, Press, SelectFade } from '../components/Motion';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { CheckRow } from '../components/CheckRow';
import { Divider, Section } from '../components/Section';
import { PageTitle } from '../components/PageTitle';
import { type InboxItem, inboxOpen, itemsFor, planFor, recentlyDone, toggleItem } from '../lib/inbox';
import { addDays, friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';

/** The desktop draws its own page here; the phone keeps its screen. */
export default function InboxRoute() {
  return useDesktop().on ? <InboxPage /> : <InboxScreen />;
}

/** Quick to-dos: write them down now, put them on a day later. */
function InboxScreen() {
  const { colors, kinds, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const { ready, today, inbox, updateInbox } = useStore();
  const contentBottom = useContentBottom();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  if (!ready) return <Skeleton label="Loading your inbox" />;

  const tomorrow = addDays(today, 1);
  const waiting = inboxOpen(inbox, today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const planned = inbox.filter((i) => !i.doneOn && i.date && i.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
  const done = recentlyDone(inbox, today);
  // Nothing to sort and nothing planned: one quiet pane in place of the empty list, in every look.
  const clear = waiting.length === 0 && planned.length === 0;

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
    <GlassScroll contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]} keyboardShouldPersistTaps="handled">
      <PageTitle title="Inbox" subtitle="Jot down anything. Put it on a day when you're ready." />

      <Text style={styles.label} nativeID="inbox-add-label">
        Add to inbox
      </Text>
      {/* The add button is always there at the end of the composer; with nothing typed it puts the cursor in the
          field. */}
      <Glass tier="control" radius={radii.pill} style={styles.composer}>
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
        <Press
          style={styles.addDisc}
          hitSlop={4}
          haptic
          onPress={() => (draft.trim() ? add() : input.current?.focus())}
          accessibilityLabel="Add to inbox"
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </Press>
      </Glass>

      {clear ? (
        <Glass style={styles.clear}>
          <View style={styles.tray}>
            <Ionicons name="file-tray-outline" size={28} color={kinds.inbox.text} />
          </View>
          <Text style={styles.clearTitle}>Nothing to sort</Text>
          <Text style={styles.clearText}>When something crosses your mind, write it above. It waits here until you give it a day.</Text>
        </Glass>
      ) : (
        <Section
          enter={0}
          title={`To sort · ${waiting.length}`}
          dot={kinds.inbox.color}
          footer={waiting.length > 0 ? 'Tap to tick off. Press and hold to plan it for today or tomorrow.' : undefined}
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
    </GlassScroll>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: { padding: 16 },
    label: { ...type.label, marginBottom: 8 },
    composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 20, paddingRight: 8, minHeight: 56 },
    // Positioned, so on the web it paints above the glass's absolute layers (a static input sits under them).
    input: { flex: 1, position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, minHeight: 50 },
    addDisc: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: colors.material.control.shadow,
    },
    empty: { padding: 16, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    clear: { marginTop: 24, padding: 22, alignItems: 'flex-start', gap: 6 },
    tray: {
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
    clearTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
    clearText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted },
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
