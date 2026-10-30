import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '../components/CheckRow';
import { GroceryForm } from '../components/GroceryForm';
import { Divider, Section } from '../components/Section';
import { STARTER_STAPLES, useStore } from '../lib/store';
import { type GroceryItem, boughtOn, describeRepeat, friendlyDate, groceryListText, needsBuying, nextDue } from '../lib/schedule';
import { useFabBottom } from '../components/NowPlaying';
import { type Theme, useStyles, useTheme } from '../theme';

const NO_AISLE = 'Other';

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

export default function GroceriesScreen({ query = '' }: { query?: string }) {
  const { colors, kinds, type } = useTheme();
  const styles = useStyles(makeStyles);
  const fabBottom = useFabBottom();
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
        Alert.alert('Copied', 'Your list is on the clipboard.');
      } else await Share.share({ message });
    } catch {}
  };

  if (!ready) return null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {all.length === 0 ? (
          <View style={styles.welcome}>
            <Ionicons name="cart-outline" size={40} color={kinds.groceries.color} />
            <Text style={styles.welcomeTitle}>Your grocery routine</Text>
            <Text style={styles.welcomeText}>
              Add the things you buy regularly and how often. They come back on your list when it's time to buy them
              again.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => addGroceries(STARTER_STAPLES)}>
              <Text style={styles.primaryText}>Start with common staples</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={openNew}>
              <Text style={styles.secondaryText}>Add my own item</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Section
              title={`To buy · ${toBuy.length}`}
              right={
                toBuy.length > 0 ? (
                  <Pressable onPress={share} hitSlop={8} accessibilityLabel="Share shopping list" style={styles.shareLink}>
                    <Ionicons name="share-outline" size={14} color={colors.text} />
                    <Text style={type.link}>Share</Text>
                  </Pressable>
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

            {bought.length > 0 && (
              <Section title={`Bought today · ${bought.length}`}>
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
              <Section title="Coming up">
                {later.map(({ item, due }, i) => (
                  <View key={item.id}>
                    {i > 0 && <Divider />}
                    <Pressable
                      style={({ pressed }) => [styles.laterRow, pressed && styles.pressed]}
                      onPress={() => openEdit(item)}
                    >
                      <View style={styles.laterText}>
                        <Text style={styles.laterName}>{item.name}</Text>
                        <Text style={styles.laterSub}>{subtitle(item)}</Text>
                      </View>
                      {due && <Text style={styles.laterDue}>{friendlyDate(due, today)}</Text>}
                    </Pressable>
                  </View>
                ))}
              </Section>
            )}

            <Text style={styles.hint}>Tap to tick off. Press and hold an item to edit it.</Text>
          </>
        )}
      </ScrollView>

      {all.length > 0 && (
        <Pressable style={[styles.fab, { bottom: fabBottom }]} onPress={openNew} accessibilityLabel="Add grocery item">
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </Pressable>
      )}

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

const makeStyles = ({ colors, kinds, fonts, radius }: Theme) =>
  StyleSheet.create({
  screen: { flex: 1 },
  shareLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  content: { padding: 16, paddingBottom: 170 },
  welcome: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', marginTop: 12 },
  welcomeTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginTop: 12 },
  welcomeText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 16 },
  secondaryButton: { paddingVertical: 14, alignSelf: 'stretch', alignItems: 'center' },
  secondaryText: { color: colors.primary, fontFamily: fonts.bodyMedium, fontSize: 16 },
  emptyText: { padding: 16, color: colors.muted, fontFamily: fonts.body, fontSize: 15 },
  aisle: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: kinds.groceries.color,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  laterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, paddingLeft: 52 },
  pressed: { backgroundColor: colors.primarySoft },
  laterText: { flex: 1 },
  laterName: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
  laterSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  laterDue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.muted },
  hint: { textAlign: 'center', color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
