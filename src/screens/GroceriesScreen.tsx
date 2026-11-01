import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ActionChip } from '../components/Chip';
import { Fab, useFabScroll } from '../components/Fab';
import { Skeleton } from '../components/Skeleton';
import { useContentBottom } from '../components/NowPlaying';
import { CheckRow } from '../components/CheckRow';
import { GroceryForm } from '../components/GroceryForm';
import { Divider, HintPane, NoMatch, Section } from '../components/Section';
import { STARTER_STAPLES, useStore } from '../lib/store';
import { type GroceryItem, boughtOn, describeRepeat, friendlyDate, groceryListText, needsBuying, nextDue } from '../lib/schedule';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass, GlassScroll } from '../components/Glass';
import { Enter, Press } from '../components/Motion';

const NO_AISLE = 'Other';

type IconName = keyof typeof Ionicons.glyphMap;
/** An aisle's glyph on Lavender's aisle panes; anything unknown gets a basket. */
const AISLE_ICONS: [RegExp, IconName][] = [
  [/dairy|milk|cheese|egg/i, 'egg-outline'],
  [/meat|fish|butcher|deli/i, 'restaurant-outline'],
  [/produce|fruit|veg|green/i, 'leaf-outline'],
  [/pantry|dry|tin|can|grain/i, 'cube-outline'],
  [/bake|bread/i, 'pizza-outline'],
  [/frozen|freez/i, 'snow-outline'],
  [/drink|beverage|juice/i, 'wine-outline'],
  [/clean|house|home/i, 'home-outline'],
];
const aisleIcon = (aisle: string): IconName => AISLE_ICONS.find(([re]) => re.test(aisle))?.[1] ?? 'basket-outline';

function byAisle(items: GroceryItem[]): [string, GroceryItem[]][] {
  const groups = new Map<string, GroceryItem[]>();
  for (const item of items) {
    const key = item.aisle || NO_AISLE;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_AISLE ? 1 : b === NO_AISLE ? -1 : a.localeCompare(b)))
    .map(([k, v]) => [k, v.sort((x, y) => x.name.localeCompare(y.name))]);
}

function subtitle(item: GroceryItem): string {
  return [item.quantity, describeRepeat(item.repeat)].filter(Boolean).join(' · ');
}

export default function GroceriesScreen({
  query = '',
  header,
  onClearQuery,
  scrollY,
}: {
  query?: string;
  header?: ReactNode;
  onClearQuery?: () => void;
  /** Receives the list's scroll offset (Library fades rows into the world under its fixed header). */
  scrollY?: SharedValue<number>;
}) {
  const { colors, kinds, name, type } = useTheme();
  const styles = useStyles(makeStyles);
  // Lavender gives every aisle its own pane, so the list reads as a stack of small glass cards.
  // Paper does the same, with each aisle's mark in ink on a glass pebble; Pine with its mark in birch, the aisle
  // named in capitals like the tags on its cards, and a quiet "All bought" pane when the list is done.
  const panes = name === 'lavender' || name === 'paper' || name === 'pine';
  const paper = name === 'paper';
  const pine = name === 'pine';
  const [copied, setCopied] = useState(false);
  const contentBottom = useContentBottom(true);
  const fab = useFabScroll();
  const { ready, today, groceries: all, toggleBought, addGrocery, addGroceries, updateGrocery, removeGrocery } = useStore();
  const q = query.trim().toLowerCase();
  const groceries = q ? all.filter((g) => g.name.toLowerCase().includes(q)) : all;
  const [editing, setEditing] = useState<GroceryItem | undefined>();
  const [formOpen, setFormOpen] = useState(false);

  const toBuy = groceries.filter((g) => needsBuying(g, today));
  const bought = groceries.filter((g) => boughtOn(g, today)).sort((a, b) => a.name.localeCompare(b.name));
  const later = groceries
    .filter((g) => !needsBuying(g, today) && !boughtOn(g, today) && g.repeat.kind !== 'once')
    .map((g) => ({ item: g, due: nextDue(g, today) }))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

  const openNew = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (g: GroceryItem) => {
    setEditing(g);
    setFormOpen(true);
  };

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

  if (!ready) return <Skeleton label="Loading your shopping list" />;

  return (
    <View style={styles.screen}>
      <GlassScroll
        contentContainerStyle={[styles.content, { paddingBottom: contentBottom }]}
        keyboardShouldPersistTaps="handled"
        onScroll={fab.onScroll}
        offsetOut={scrollY}
      >
        {header}
        {all.length === 0 ? (
          <Glass style={styles.welcome}>
            <Ionicons name="cart-outline" size={40} color={kinds.groceries.color} />
            <Text style={styles.welcomeTitle}>Your grocery routine</Text>
            <Text style={styles.welcomeText}>
              Add the things you buy regularly and how often. They come back on your list when it's time to buy them again.
            </Text>
            <Button label="Start with common staples" onPress={() => addGroceries(STARTER_STAPLES)} style={styles.welcomeButton} />
            <Button label="Add my own item" icon="add" variant="plain" onPress={openNew} />
          </Glass>
        ) : q && groceries.length === 0 ? (
          <NoMatch query={query} onClear={onClearQuery} />
        ) : (
          <>
            {panes && toBuy.length > 0 ? (
              <Enter index={0}>
                <View style={styles.paneHead}>
                  <Text style={[type.sectionTitle, styles.flex]} accessibilityRole="header">
                    {`To buy · ${toBuy.length}`}
                  </Text>
                  <ActionChip
                    icon={copied ? 'checkmark' : 'share-outline'}
                    label={copied ? 'Copied' : 'Share'}
                    onPress={share}
                    accessibilityLabel={copied ? 'List copied to the clipboard' : 'Share shopping list'}
                  />
                </View>
                <View style={styles.aislePanes}>
                  {byAisle(toBuy).map(([aisle, items]) => (
                    <Glass key={aisle}>
                      <View style={styles.aisleHead}>
                        <View style={[styles.aisleTile, paper && styles.aislePebble]}>
                          <Ionicons name={aisleIcon(aisle)} size={18} color={pine ? kinds.groceries.color : colors.text} />
                        </View>
                        <Text style={[styles.aisleName, pine && styles.aisleCaps]} accessibilityRole="header">
                          {aisle}
                        </Text>
                        <Text style={styles.aisleCount}>{items.length}</Text>
                      </View>
                      {items.map((g, i) => (
                        <View key={g.id}>
                          {i > 0 && <Divider />}
                          <CheckRow
                            tint={kinds.groceries.color}
                            title={g.name}
                            subtitle={subtitle(g)}
                            done={false}
                            onToggle={() => toggleBought(g.id)}
                            onLongPress={() => openEdit(g)}
                          />
                        </View>
                      ))}
                    </Glass>
                  ))}
                  <HintPane>Tap to tick off. Press and hold an item to edit it.</HintPane>
                </View>
              </Enter>
            ) : (paper || pine) && toBuy.length === 0 ? (
              <Enter index={0}>
                <Text style={[type.sectionTitle, styles.paneHead, styles.paperHead]} accessibilityRole="header">
                  To buy
                </Text>
                <Glass style={styles.allBought}>
                  <View style={styles.allBoughtPebble}>
                    <Ionicons name="basket-outline" size={26} color={pine ? colors.accent : colors.text} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.allBoughtTitle}>All bought</Text>
                    <Text style={type.hint}>Ticked items come back on their next day.</Text>
                  </View>
                </Glass>
              </Enter>
            ) : (
              <Section
                enter={0}
                title={`To buy · ${toBuy.length}`}
                footer={toBuy.length > 0 ? 'Tap to tick off. Hold to edit.' : undefined}
                right={
                  toBuy.length > 0 ? (
                    <ActionChip
                      icon={copied ? 'checkmark' : 'share-outline'}
                      label={copied ? 'Copied' : 'Share'}
                      onPress={share}
                      accessibilityLabel={copied ? 'List copied to the clipboard' : 'Share shopping list'}
                    />
                  ) : undefined
                }
              >
                {toBuy.length === 0 ? (
                  <Text style={styles.emptyText}>You're all stocked up.</Text>
                ) : (
                  byAisle(toBuy).map(([aisle, items]) => (
                    <View key={aisle}>
                      <Text style={styles.aisle}>{aisle}</Text>
                      {items.map((g, i) => (
                        <View key={g.id}>
                          {i > 0 && <Divider />}
                          <CheckRow
                            tint={kinds.groceries.color}
                            title={g.name}
                            subtitle={subtitle(g)}
                            done={false}
                            onToggle={() => toggleBought(g.id)}
                            onLongPress={() => openEdit(g)}
                          />
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </Section>
            )}

            {bought.length > 0 && (
              <Section enter={1} title={`Bought today · ${bought.length}`}>
                {bought.map((g, i) => (
                  <View key={g.id}>
                    {i > 0 && <Divider />}
                    <CheckRow
                      tint={kinds.groceries.color}
                      title={g.name}
                      subtitle={g.quantity}
                      done
                      onToggle={() => toggleBought(g.id)}
                      onLongPress={() => openEdit(g)}
                    />
                  </View>
                ))}
              </Section>
            )}

            {later.length > 0 && (
              <Section enter={2} title="Coming up">
                {later.map(({ item, due }, i) => (
                  <View key={item.id}>
                    {i > 0 && <Divider />}
                    <Press
                      style={styles.laterRow}
                      overlay={colors.material.pressFill}
                      onPress={() => openEdit(item)}
                      accessibilityLabel={`${item.name}, ${subtitle(item)}. Edit item`}
                    >
                      <View style={styles.laterText}>
                        <Text style={styles.laterName}>{item.name}</Text>
                        <Text style={styles.laterSub}>{subtitle(item)}</Text>
                      </View>
                      {due && <Text style={styles.laterDue}>{friendlyDate(due, today)}</Text>}
                    </Press>
                  </View>
                ))}
              </Section>
            )}
          </>
        )}
      </GlassScroll>

      {all.length > 0 && <Fab onPress={openNew} accessibilityLabel="Add a grocery item" hidden={fab.hidden} />}

      <GroceryForm
        visible={formOpen}
        item={editing}
        onClose={() => setFormOpen(false)}
        onSave={(data) => {
          if (editing) updateGrocery(editing.id, data);
          else addGrocery(data);
          setFormOpen(false);
        }}
        onDelete={
          editing
            ? () => {
                removeGrocery(editing.id);
                setFormOpen(false);
              }
            : undefined
        }
      />
    </View>
  );
}

const makeStyles = ({ colors, kinds, fonts, type, name }: Theme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 16 },
    welcome: { padding: 24, alignItems: 'center', marginTop: 12 },
    welcomeTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginTop: 12 },
    welcomeText: { fontFamily: fonts.body, fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 22, marginTop: 8 },
    welcomeButton: { alignSelf: 'stretch', marginTop: 20, marginBottom: 4 },
    emptyText: { padding: 16, color: colors.muted, fontFamily: fonts.body, fontSize: 16 },
    aisle: { ...type.label, color: kinds.groceries.text, paddingHorizontal: 16, paddingTop: 14 },
    flex: { flex: 1 },
    paneHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, marginBottom: 10 },
    aislePanes: { gap: name === 'paper' ? 12 : 8 },
    aislePebble: { backgroundColor: colors.material.inset.fill },
    // Lines up with the Section titles below it.
    paperHead: { paddingHorizontal: 2 },
    allBought: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
    allBoughtPebble: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    allBoughtTitle: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.text, marginBottom: 2 },
    aisleHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
    aisleTile: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: kinds.groceries.soft,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    aisleName: { flex: 1, fontFamily: fonts.bodyBold, fontSize: name === 'paper' ? 15 : 14, letterSpacing: 0.3, color: colors.text },
    aisleCaps: { fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: kinds.groceries.text },
    aisleCount: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
    laterRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 12, paddingHorizontal: 14, paddingLeft: 54 },
    laterText: { flex: 1 },
    laterName: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    laterSub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
    laterDue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted },
  });
