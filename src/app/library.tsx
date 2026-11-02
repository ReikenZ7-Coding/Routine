import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Glass } from '../components/Glass';
import { WorldFade } from '../components/glass/WorldFade';
import { Press } from '../components/Motion';
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
  const { colors, type, glass, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ shelf?: string }>();
  const { routines, groceries } = useStore();
  const [shelf, setShelf] = useState<Shelf>('routines');
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState<WhenFilter>('all');
  const [repeat, setRepeat] = useState<RepeatFilter>('all');
  const [listTop, setListTop] = useState(0);
  const listScroll = useSharedValue(0);

  useEffect(() => {
    if (params.shelf === 'routines' || params.shelf === 'groceries') setShelf(params.shelf);
  }, [params.shelf]);

  const shelves: [Shelf, string, number][] = [
    ['routines', 'Routines', routines.length],
    ['groceries', 'Groceries', groceries.length],
  ];
  const placeholder = shelf === 'routines' ? 'Search routines' : 'Search groceries';

  const search = (
    <View>
      <Text style={styles.label} nativeID="library-search-label">
        {placeholder}
      </Text>
      <Glass tier="control" radius={radii.pill} style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={shelf === 'routines' ? 'Name of a routine' : 'Name of an item'}
          placeholderTextColor={colors.faint}
          selectionColor={colors.link}
          cursorColor={colors.text}
          returnKeyType="search"
          accessibilityLabel={placeholder}
          accessibilityLabelledBy="library-search-label"
        />
        {query ? (
          <Press onPress={() => setQuery('')} style={styles.clear} overlay={colors.material.pressFill} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={colors.muted} />
          </Press>
        ) : null}
      </Glass>
    </View>
  );
  const clear = () => setQuery('');

  if (glass) {
    return (
      <View style={styles.flex}>
        <View style={[styles.top, { paddingTop: insets.top + 16 }]} onLayout={(e) => setListTop(e.nativeEvent.layout.height)}>
          <Text style={type.title}>My Library</Text>
          {search}
          <Segmented
            accessibilityLabel="Shelf"
            options={shelves.map(([key, label, count]) => ({ key, label, count }))}
            value={shelf}
            onChange={setShelf}
          />
        </View>
        <View style={styles.flex}>
          {shelf === 'routines' ? (
            <RoutinesScreen query={query} onClearQuery={clear} scrollY={listScroll} />
          ) : (
            <GroceriesScreen query={query} onClearQuery={clear} scrollY={listScroll} />
          )}
          {/* Rows scrolling up under the fixed search and switch fade into the world instead of being cut. */}
          <WorldFade top={listTop} scroll={listScroll} />
        </View>
      </View>
    );
  }

  const header = (
    <View style={styles.hub}>
      {/* No count badge: the switch below already counts both shelves. */}
      <PageTitle title="Library" subtitle="Your routines and the shopping list" bleed={20}>
        <Segmented
          accessibilityLabel="Shelf"
          options={shelves.map(([key, label, count]) => ({ key, label, count, icon: key === 'routines' ? 'repeat' : 'basket-outline' }))}
          value={shelf}
          onChange={setShelf}
        />
      </PageTitle>
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
        <RoutinesScreen query={query} when={when} repeat={repeat} header={header} onClearQuery={clear} />
      ) : (
        <GroceriesScreen query={query} header={header} onClearQuery={clear} />
      )}
    </View>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    top: { paddingHorizontal: 16, gap: 14 },
    hub: { gap: 14, paddingTop: 4 },
    label: { ...type.label, marginBottom: 8 },
    search: { flexDirection: 'row', minHeight: 50, alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 3 },
    // Positioned, so on the web it paints above the glass's absolute layers (a static input sits under them).
    searchInput: { flex: 1, position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, minHeight: 48 },
    clear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  });
