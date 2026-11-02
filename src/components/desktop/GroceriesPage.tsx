// Groceries on the desktop: what to buy today, one pane per aisle in two columns, and beside it what was bought
// today and what comes back next. The same list, aisles and words as the phone's shopping shelf.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { type GroceryItem, boughtOn, friendlyDate, groceryListText, needsBuying, nextDue } from '../../lib/schedule';
import { STARTER_STAPLES, useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { aisleIcon, byAisle, subtitle } from '../../screens/GroceriesScreen';
import { GroceryForm } from '../GroceryForm';
import { useShell } from './api';
import { Hover } from './Hover';
import { Empty, IconButton, Tick, useRowText } from './Kit';
import { Column, Fig, GlassButton, Page, Panel, Row } from './Page';

export function GroceriesPage() {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const text = useRowText();
  const shell = useShell();
  const { today, groceries: all, toggleBought, addGroceries, updateGrocery, removeGrocery } = useStore();
  const [editing, setEditing] = useState<GroceryItem | undefined>();
  const [copied, setCopied] = useState(false);

  const toBuy = all.filter((g) => needsBuying(g, today));
  const bought = all.filter((g) => boughtOn(g, today)).sort((a, b) => a.name.localeCompare(b.name));
  const later = all
    .filter((g) => !needsBuying(g, today) && !boughtOn(g, today) && g.repeat.kind !== 'once')
    .map((g) => ({ item: g, due: nextDue(g, today) }))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

  const share = async () => {
    const message = groceryListText(toBuy);
    try {
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      } else await Share.share({ message });
    } catch {}
  };

  const form = (
    <GroceryForm
      visible={!!editing}
      item={editing}
      onClose={() => setEditing(undefined)}
      onSave={(data) => {
        if (editing) updateGrocery(editing.id, data);
        setEditing(undefined);
      }}
      onDelete={
        editing
          ? () => {
              removeGrocery(editing.id);
              setEditing(undefined);
            }
          : undefined
      }
    />
  );

  if (all.length === 0) {
    return (
      <Page title="Groceries" subtitle="Your shopping list, by aisle.">
        <Row>
          <Panel span={8} index={0} title="Your grocery routine" subtitle="The things you buy regularly, and how often">
            <Text style={[type.body, styles.intro]}>They come back on your list when it's time to buy them again.</Text>
            <View style={styles.buttons}>
              <GlassButton label="Start with common staples" onPress={() => addGroceries(STARTER_STAPLES)} />
              <GlassButton label="Add my own item" icon="add" onPress={() => shell.open('grocery')} />
            </View>
          </Panel>
        </Row>
      </Page>
    );
  }

  const row = (g: GroceryItem, i: number, done: boolean, meta: string) => (
    <View key={g.id} style={[styles.row, i > 0 && styles.rule]}>
      <Tick square done={done} color={kinds.groceries.color} label={g.name} onPress={() => toggleBought(g.id)} />
      <View style={styles.flex}>
        <Text style={[text.rowTitle, done && text.struck]} numberOfLines={1}>
          {g.name}
        </Text>
        {meta ? (
          <Text style={text.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <IconButton icon="ellipsis-horizontal" label={`Edit ${g.name}`} size={36} bare onPress={() => setEditing(g)} />
    </View>
  );

  return (
    <Page
      title="Groceries"
      subtitle={
        <>
          <Fig>{toBuy.length}</Fig> to buy today · <Fig>{bought.length}</Fig> bought
        </>
      }
      actions={
        <>
          {toBuy.length ? (
            <GlassButton
              label={copied ? 'Copied' : 'Share list'}
              icon={copied ? 'checkmark' : 'share-outline'}
              onPress={share}
              accessibilityLabel={copied ? 'List copied to the clipboard' : 'Share the shopping list'}
            />
          ) : null}
          <GlassButton label="Add an item" icon="add" onPress={() => shell.open('grocery')} />
        </>
      }
    >
      <Row>
        <Column span={8}>
          {toBuy.length ? (
            <Row>
              {byAisle(toBuy).map(([aisle, items], ai) => (
                <Panel key={aisle} span={4} index={ai}>
                  <View style={styles.aisleHead}>
                    <View style={styles.tile}>
                      <Ionicons name={aisleIcon(aisle)} size={18} color={kinds.groceries.text} />
                    </View>
                    <Text style={[type.sectionTitle, styles.flex]} role="heading" aria-level={2}>
                      {aisle}
                    </Text>
                    <Text style={styles.count}>{items.length}</Text>
                  </View>
                  {items.map((g, i) => row(g, i, false, subtitle(g)))}
                </Panel>
              ))}
            </Row>
          ) : (
            <Panel span={8} index={0} title="To buy">
              <View style={styles.allBought}>
                <View style={[styles.tile, styles.bigTile]}>
                  <Ionicons name="basket-outline" size={26} color={kinds.groceries.text} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.allTitle}>All bought</Text>
                  <Text style={type.hint}>You're all stocked up. Ticked items come back on their next day.</Text>
                </View>
              </View>
            </Panel>
          )}
        </Column>
        <Column span={4}>
          <Panel span={4} index={5} title={`Bought today · ${bought.length}`} subtitle="Untick one to put it back">
            {bought.length === 0 ? (
              <Empty>Tick items off as you shop and they show here.</Empty>
            ) : (
              bought.map((g, i) => row(g, i, true, g.quantity ?? ''))
            )}
          </Panel>
          <Panel span={4} index={6} title="Coming up" subtitle="Back on the list on their day">
            {later.length === 0 ? (
              <Empty>Things you buy every few days show here between shops.</Empty>
            ) : (
              later.map(({ item, due }, i) => (
                <Hover
                  key={item.id}
                  onPress={() => setEditing(item)}
                  style={[styles.later, i > 0 && styles.rule]}
                  radius={10}
                  accessibilityLabel={`${item.name}, ${subtitle(item)}${due ? `, back ${friendlyDate(due, today).toLowerCase()}` : ''}. Edit item`}
                >
                  <View style={styles.flex}>
                    <Text style={text.rowTitle}>{item.name}</Text>
                    <Text style={text.rowMeta}>{subtitle(item)}</Text>
                  </View>
                  {due ? <Text style={styles.due}>{friendlyDate(due, today)}</Text> : null}
                </Hover>
              ))
            )}
          </Panel>
        </Column>
      </Row>
      {form}
    </Page>
  );
}

const makeStyles = ({ colors, fonts }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    intro: { color: colors.muted },
    buttons: { flexDirection: 'row', gap: 8, marginTop: 16 },
    rule: { borderTopWidth: 1, borderTopColor: colors.border },
    aisleHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, minHeight: 36 },
    tile: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: inset.fill,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
    },
    bigTile: { width: 52, height: 52, borderRadius: 16 },
    count: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.muted, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingVertical: 4, marginLeft: -8 },
    allBought: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    allTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.text, marginBottom: 2 },
    later: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
      paddingHorizontal: 8,
      marginHorizontal: -8,
    },
    due: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  });
};
