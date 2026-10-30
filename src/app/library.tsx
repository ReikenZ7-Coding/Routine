import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../lib/store';
import GroceriesScreen from '../screens/GroceriesScreen';
import RoutinesScreen from '../screens/RoutinesScreen';
import { type Theme, useStyles, useTheme } from '../theme';

type Shelf = 'routines' | 'groceries';

/** Everything you keep: routines and the grocery list, with search. */
export default function LibraryScreen() {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ shelf?: string }>();
  const { routines, groceries } = useStore();
  const [shelf, setShelf] = useState<Shelf>('routines');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (params.shelf === 'routines' || params.shelf === 'groceries') setShelf(params.shelf);
  }, [params.shelf]);

  const shelves: [Shelf, string, number][] = [
    ['routines', 'Routines', routines.length],
    ['groceries', 'Groceries', groceries.length],
  ];

  return (
    <View style={styles.flex}>
      <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
        <Text style={type.title}>My Library</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={shelf === 'routines' ? 'Search routines' : 'Search groceries'}
            placeholderTextColor={colors.faint}
          />
          {query ? (
            <Pressable accessibilityRole="button" onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.pills}>
          {shelves.map(([key, label, count]) => {
            const active = shelf === key;
            return (
              <Pressable
                key={key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => setShelf(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {label} <Text style={styles.pillCount}>{count}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {shelf === 'routines' ? <RoutinesScreen query={query} /> : <GroceriesScreen query={query} />}
    </View>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    top: { paddingHorizontal: 16, gap: 14 },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 14,
      height: 44,
    },
    searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text, height: 44 },
    pills: { flexDirection: 'row', gap: 8 },
    pill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    pillActive: { backgroundColor: colors.selected, borderColor: colors.selected },
    pillText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    pillTextActive: { color: colors.onSelected },
    pillCount: { fontFamily: fonts.mono, fontSize: 12, opacity: 0.7 },
  });
