import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckRow } from '../components/CheckRow';
import { Divider, Section } from '../components/Section';
import { type InboxItem, inboxOpen, itemsFor, planFor, recentlyDone, toggleItem } from '../lib/inbox';
import { addDays, friendlyDate } from '../lib/schedule';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';

/** Quick to-dos: write them down now, put them on a day later. */
export default function InboxScreen() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { ready, today, inbox, updateInbox } = useStore();
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  if (!ready) return null;

  const tomorrow = addDays(today, 1);
  const waiting = inboxOpen(inbox, today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const planned = inbox
    .filter((i) => !i.doneOn && i.date && i.date >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const done = recentlyDone(inbox, today);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    updateInbox((items) => [{ id: newId(), title, createdAt: new Date().toISOString() }, ...items]);
    setDraft('');
  };
  const change = (id: string, fn: (i: InboxItem) => InboxItem) =>
    updateInbox((items) => items.map((i) => (i.id === id ? fn(i) : i)));
  const remove = (id: string) => updateInbox((items) => items.filter((i) => i.id !== id));

  const row = (item: InboxItem, i: number) => (
    <View key={item.id}>
      {i > 0 && <Divider />}
      <CheckRow
        tint={kinds.inbox.color}
        title={item.title}
        subtitle={item.date && !item.doneOn ? (item.date < today ? `Was planned ${friendlyDate(item.date, today).toLowerCase()}` : friendlyDate(item.date, today)) : undefined}
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
          ).map(([label, date]) => (
            <Pressable accessibilityRole="button"
              key={label}
              style={[styles.action, item.date === date && styles.actionActive]}
              onPress={() => {
                change(item.id, (x) => planFor(x, date));
                setOpen(null);
              }}
            >
              <Text style={[styles.actionText, item.date === date && styles.actionTextActive]}>{label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" style={styles.action} onPress={() => remove(item.id)} accessibilityLabel={`Delete ${item.title}`}>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">
      <Text style={type.title}>Inbox</Text>
      <Text style={[type.small, styles.intro]}>Jot down anything. Put it on a day when you're ready.</Text>

      <View style={styles.composer}>
        <Ionicons name="add" size={20} color={colors.muted} />
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Call Mum, book vacation…"
          placeholderTextColor={colors.faint}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {draft.trim() ? (
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={add} accessibilityLabel="Add to inbox">
            <Ionicons name="arrow-up" size={18} color={colors.onPrimary} />
          </Pressable>
        ) : null}
      </View>

      <Section title={`To sort · ${waiting.length}`} dot={kinds.inbox.color}>
        {waiting.length === 0 ? (
          <Text style={styles.empty}>All clear. New to-dos land here.</Text>
        ) : (
          waiting.map(row)
        )}
      </Section>

      {planned.length > 0 && <Section title="Planned">{planned.map(row)}</Section>}
      {done.length > 0 && <Section title="Done this week">{done.map(row)}</Section>}

      <Text style={[type.small, styles.hint]}>Tap to tick off. Press and hold to plan it for today or tomorrow.</Text>
    </ScrollView>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: 16, paddingBottom: 120 },
    intro: { marginTop: 4 },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
      paddingLeft: 14,
      paddingRight: 6,
      height: 52,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text, height: 52 },
    addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    empty: { padding: 16, fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    actions: { flexDirection: 'row', gap: 8, paddingLeft: 52, paddingRight: 16, paddingBottom: 12 },
    action: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    actionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
    actionTextActive: { color: colors.onPrimary },
    hint: { textAlign: 'center', marginTop: 20 },
  });
