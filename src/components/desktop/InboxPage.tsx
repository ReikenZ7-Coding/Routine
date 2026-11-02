// The inbox as a board: what is waiting to be sorted (with the composer on top), what is planned (grouped by day)
// and what got done this week, side by side. The same items and words as the phone's Inbox; each row's Plan button
// opens the days to put it on, and its more button renames or deletes it.
import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { type InboxItem, inboxOpen, planFor, recentlyDone, toggleItem } from '../../lib/inbox';
import { addDays, friendlyDate, parseKey } from '../../lib/schedule';
import { newId, useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { Glass } from '../Glass';
import { Collapse } from '../Motion';
import { Hover } from './Hover';
import { Empty, GroupHead, IconButton, Pill, Tick, useRowText } from './Kit';
import { longDate } from './nav';
import { Fig, Page, Panel, Row } from './Page';

export function InboxPage() {
  const { kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const { today, inbox, updateInbox } = useStore();
  const waiting = inboxOpen(inbox, today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const planned = inbox.filter((i) => !i.doneOn && i.date && i.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
  const done = recentlyDone(inbox, today);
  const clear = waiting.length === 0 && planned.length === 0;

  const change = (id: string, fn: (i: InboxItem) => InboxItem) => updateInbox((items) => items.map((i) => (i.id === id ? fn(i) : i)));
  const remove = (id: string) => updateInbox((items) => items.filter((i) => i.id !== id));
  const add = (title: string) => updateInbox((items) => [{ id: newId(), title, createdAt: new Date().toISOString() }, ...items]);
  const row = (item: InboxItem) => (
    <TodoRow key={item.id} item={item} today={today} onChange={(fn) => change(item.id, fn)} onRemove={() => remove(item.id)} />
  );

  // Planned, by day: "Today", "Tomorrow", "Saturday 7 November".
  const days = new Map<string, InboxItem[]>();
  for (const i of planned) days.set(i.date!, [...(days.get(i.date!) ?? []), i]);
  const dayLabel = (d: string) => (d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : longDate(d));

  return (
    <Page
      title="Inbox"
      subtitle={
        clear ? (
          "Jot down anything. Put it on a day when you're ready."
        ) : (
          <>
            <Fig>{waiting.length}</Fig> to sort · <Fig>{planned.length}</Fig> planned
          </>
        )
      }
    >
      {clear ? (
        <Row>
          <Panel span={8} index={0} title="To sort">
            <Composer onAdd={add} />
            <View style={styles.clear}>
              <View style={styles.tray}>
                <Ionicons name="file-tray-outline" size={28} color={kinds.inbox.text} />
              </View>
              <Text style={styles.clearTitle}>Nothing to sort</Text>
              <Text style={styles.clearText}>When something crosses your mind, write it above. It waits here until you give it a day.</Text>
            </View>
          </Panel>
          {done.length > 0 ? (
            <Panel span={4} index={1} title="Done this week" subtitle={`${done.length} ticked off`}>
              {done.map(row)}
            </Panel>
          ) : null}
        </Row>
      ) : (
        <Row>
          <Panel
            span={4}
            index={0}
            title="To sort"
            subtitle={waiting.length ? `${waiting.length} waiting for a day` : 'New to-dos land here'}
          >
            <Composer onAdd={add} />
            <View style={styles.list}>{waiting.length === 0 ? <Empty>All clear. New to-dos land here.</Empty> : waiting.map(row)}</View>
          </Panel>
          <Panel span={4} index={1} title="Planned" subtitle={planned.length ? `${planned.length} on a day` : 'Things with a day'}>
            {planned.length === 0 ? (
              <Empty>Plan a to-do and it moves here, under its day.</Empty>
            ) : (
              [...days.entries()].map(([d, items], gi) => (
                <View key={d}>
                  <GroupHead label={dayLabel(d)} right={String(items.length)} first={gi === 0} />
                  {items.map(row)}
                </View>
              ))
            )}
          </Panel>
          <Panel span={4} index={2} title="Done this week" subtitle={done.length ? `${done.length} ticked off` : 'The last 7 days'}>
            {done.length === 0 ? <Empty>Ticked-off to-dos show here for a week.</Empty> : done.map(row)}
          </Panel>
        </Row>
      )}
    </Page>
  );
}

/** "Add to inbox": a labelled field in inset glass with the add disc at its end. */
function Composer({ onAdd }: { onAdd: (title: string) => void }) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t) return input.current?.focus();
    onAdd(t);
    setDraft('');
  };
  return (
    <View style={styles.composerBox}>
      <Text style={styles.label} nativeID="inbox-add-label">
        Add to inbox
      </Text>
      <Glass tier="control" radius={radii.pill} style={styles.composer}>
        <View style={styles.composerRing} {...({ dataSet: { ring: 'field' } } as object)}>
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
          <Hover onPress={add} squeeze style={styles.addDisc} radius={18} accessibilityLabel="Add to inbox">
            <Ionicons name="add" size={20} color={colors.onPrimary} />
          </Hover>
        </View>
      </Glass>
    </View>
  );
}

/** A to-do: its box, title and day; Plan opens the days under it, more opens Rename and Delete. */
export function TodoRow({
  item,
  today,
  onChange,
  onRemove,
}: {
  item: InboxItem;
  today: string;
  onChange: (fn: (i: InboxItem) => InboxItem) => void;
  onRemove: () => void;
}) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const text = useRowText();
  const [open, setOpen] = useState<'plan' | 'more' | 'rename' | null>(null);
  const [name, setName] = useState(item.title);
  const done = !!item.doneOn;
  const meta = done
    ? `Done ${friendlyDate(item.doneOn!, today).toLowerCase()}`
    : item.date
      ? item.date < today
        ? `Was planned ${friendlyDate(item.date, today).toLowerCase()}`
        : friendlyDate(item.date, today)
      : 'No day yet';
  const toggle = (k: 'plan' | 'more') => setOpen((o) => (o === k ? null : k));
  const plan = (date: string | undefined) => {
    onChange((x) => planFor(x, date));
    setOpen(null);
  };
  const rename = () => {
    const t = name.trim();
    if (t && t !== item.title) onChange((x) => ({ ...x, title: t }));
    setOpen(null);
  };
  // Today, tomorrow and the five days after, by name; and back to the inbox once it has a day.
  const choices: [string, string | undefined][] = [
    ['Today', today],
    ['Tomorrow', addDays(today, 1)],
    ...Array.from({ length: 5 }, (_, i): [string, string] => {
      const d = addDays(today, i + 2);
      return [parseKey(d).toLocaleDateString('en-GB', { weekday: 'long' }), d];
    }),
  ];
  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <Tick square done={done} color={kinds.inbox.color} label={item.title} onPress={() => onChange((x) => toggleItem(x, today))} />
        <View style={styles.flex}>
          <Text style={[text.rowTitle, done && text.struck]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={text.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {done ? null : (
          <IconButton
            icon="calendar-outline"
            label={`Plan ${item.title}`}
            size={36}
            bare
            onPress={() => toggle('plan')}
            aria={{ 'aria-expanded': open === 'plan' }}
          />
        )}
        <IconButton
          icon="ellipsis-horizontal"
          label={`More for ${item.title}`}
          size={36}
          bare
          onPress={() => toggle('more')}
          aria={{ 'aria-expanded': open === 'more' || open === 'rename' }}
        />
      </View>
      <Collapse open={open === 'plan'}>
        <View style={styles.actions} role="group" aria-label={`Plan ${item.title}`}>
          {choices.map(([label, date]) => (
            <Pill
              key={label}
              label={label}
              active={item.date === date}
              onPress={() => plan(date)}
              accessibilityLabel={`Plan ${item.title} for ${label === 'Today' || label === 'Tomorrow' ? label.toLowerCase() : label}`}
            />
          ))}
          {item.date ? <Pill label="Back to the inbox" icon="file-tray-outline" onPress={() => plan(undefined)} /> : null}
        </View>
      </Collapse>
      <Collapse open={open === 'more'}>
        <View style={styles.actions}>
          <Pill
            label="Rename"
            icon="create-outline"
            onPress={() => {
              setName(item.title);
              setOpen('rename');
            }}
            accessibilityLabel={`Rename ${item.title}`}
          />
          <Pill label="Delete" icon="trash-outline" danger onPress={onRemove} accessibilityLabel={`Delete ${item.title}`} />
        </View>
      </Collapse>
      <Collapse open={open === 'rename'}>
        <View style={styles.rename}>
          <View style={[styles.renameBox, { borderColor: colors.material.inset.border }]}>
            <TextInput
              style={styles.renameInput}
              value={name}
              onChangeText={setName}
              onSubmitEditing={rename}
              autoFocus
              selectionColor={colors.link}
              accessibilityLabel={`New name for ${item.title}`}
            />
          </View>
          <Pill label="Save" onPress={rename} active />
          <Pill label="Cancel" onPress={() => setOpen(null)} />
        </View>
      </Collapse>
    </View>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    label: { ...type.label, marginBottom: 8 },
    composerBox: { marginBottom: 12 },
    composer: { height: 48, justifyContent: 'center' },
    composerRing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 5, height: 46, borderRadius: 23 },
    input: { flex: 1, position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, height: 44 },
    addDisc: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    list: { marginTop: 4 },
    rowWrap: { borderTopWidth: 1, borderTopColor: colors.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingVertical: 6, marginLeft: -8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 40, paddingBottom: 12 },
    rename: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 40, paddingBottom: 12 },
    renameBox: {
      flex: 1,
      height: 40,
      borderRadius: radii.inset,
      borderWidth: 1,
      borderTopColor: inset.borderTop,
      backgroundColor: inset.fill,
      justifyContent: 'center',
    },
    renameInput: { position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, paddingHorizontal: 12, height: 38 },
    clear: { marginTop: 12, gap: 6, alignItems: 'flex-start' },
    tray: {
      width: 56,
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    clearTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.text },
    clearText: { ...type.body, color: colors.muted },
  });
};
