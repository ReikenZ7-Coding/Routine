import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FilterRow, Segmented } from '../components/Hub';
import { PageTitle } from '../components/PageTitle';
import { useStore } from '../lib/store';
import GroceriesScreen from '../screens/GroceriesScreen';
import RoutinesScreen, { type RepeatFilter, type WhenFilter } from '../screens/RoutinesScreen';
import { type Theme, useStyles, useTheme } from '../theme';

type Shelf = 'routines' | 'groceries';

/** Everything you keep: routines and the grocery list, with search. The page looks add filters, hub style. */
export default function LibraryScreen() {
  const { colors, type, glass } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ shelf?: string }>();
  const { routines, groceries } = useStore();
  const [shelf, setShelf] = useState<Shelf>('routines');
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState<WhenFilter>('all');
  const [repeat, setRepeat] = useState<RepeatFilter>('all');

  useEffect(() => {
    if (params.shelf === 'routines' || params.shelf === 'groceries') setShelf(params.shelf);
  }, [params.shelf]);

  const shelves: [Shelf, string, number][] = [
    ['routines', 'Routines', routines.length],
    ['groceries', 'Groceries', groceries.length],
  ];
  const placeholder = shelf === 'routines' ? 'Search routines' : 'Search groceries';

  const search = (
    <View style={styles.search}>
      <Ionicons name="search" size={17} color={colors.muted} />
      <TextInput
        style={styles.searchInput}
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        accessibilityLabel={placeholder}
      />
      {query ? (
        <Pressable accessibilityRole="button" onPress={() => setQuery('')} style={styles.clear} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={17} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );

  if (glass) {
    return (
      <View style={styles.flex}>
        <View style={[styles.top, { paddingTop: insets.top + 16 }]}>
          <Text style={type.title}>My Library</Text>
          {search}
          <Segmented
            accessibilityLabel="Shelf"
            options={shelves.map(([key, label, count]) => ({ key, label, count }))}
            value={shelf}
            onChange={setShelf}
          />
        </View>
        {shelf === 'routines' ? <RoutinesScreen query={query} /> : <GroceriesScreen query={query} />}
      </View>
    );
  }

  const header = (
    <View style={styles.hub}>
      <PageTitle title="Library" subtitle="Your routines and the shopping list" badge={`${routines.length + groceries.length}`} />
      <Segmented
        options={shelves.map(([key, label, count]) => ({ key, label, count, icon: key === 'routines' ? 'repeat' : 'basket-outline' }))}
        value={shelf}
        onChange={setShelf}
      />
      {search}
      {shelf === 'routines' && (
        <>
          <FilterRow
            caption="When"
            value={when}
            onChange={setWhen}
            options={[
              { key: 'all', label: 'All', icon: 'apps-outline' },
              { key: 'morning', label: 'Morning', icon: 'sunny-outline' },
              { key: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline' },
              { key: 'evening', label: 'Evening', icon: 'moon-outline' },
              { key: 'anytime', label: 'Anytime', icon: 'time-outline' },
            ]}
          />
          <FilterRow
            caption="Repeat"
            value={repeat}
            onChange={setRepeat}
            options={[
              { key: 'all', label: 'Any' },
              { key: 'daily', label: 'Every day', icon: 'repeat-outline' },
              { key: 'some', label: 'Some days', icon: 'calendar-outline' },
              { key: 'once', label: 'One-off', icon: 'flag-outline' },
            ]}
          />
        </>
      )}
    </View>
  );

  return (
    <View style={styles.flex}>
      {shelf === 'routines' ? (
        <RoutinesScreen query={query} when={when} repeat={repeat} header={header} />
      ) : (
        <GroceriesScreen query={query} header={header} />
      )}
    </View>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    top: { paddingHorizontal: 16, gap: 14 },
    hub: { gap: 14, paddingTop: 4 },
    search: {
      flexDirection: 'row',
      minHeight: 48,
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 14,
    },
    searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text, height: 48 },
    clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -12 },
  });
