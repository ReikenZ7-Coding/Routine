import { Ionicons } from '@expo/vector-icons';
import { useDesktop } from '../components/desktop/context';
import { LibraryPage } from '../components/desktop/LibraryPage';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Glass } from '../components/Glass';
import { Press } from '../components/Motion';
import { FilterRow, Segmented } from '../components/Segmented';
import { PageTitle } from '../components/PageTitle';
import { useStore } from '../lib/store';
import GroceriesScreen from '../screens/GroceriesScreen';
import RoutinesScreen, { type RepeatFilter, type WhenFilter } from '../screens/RoutinesScreen';
import { type Theme, useStyles, useTheme } from '../theme';

/** The desktop draws its own page here; the phone keeps its screen. */
export default function LibraryRoute() {
  return useDesktop().on ? <LibraryPage /> : <LibraryScreen />;
}

type Shelf = 'routines' | 'groceries';

/** Everything you keep: routines and the grocery list, with search and (for routines) filters. One layout in every
 *  look. */
function LibraryScreen() {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
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

  // The same header in every look, scrolling with the list: the title, the shelf switch, the search, and on the
  // routines shelf (once there is something to filter) the When and Repeat filters.
  const header = (
    <View>
      {/* No count badge: the switch below already counts both shelves. */}
      <PageTitle title="Library" subtitle="Your routines and the shopping list">
        <Segmented
          accessibilityLabel="Shelf"
          options={shelves.map(([key, label, count]) => ({ key, label, count, icon: key === 'routines' ? 'repeat' : 'basket-outline' }))}
          value={shelf}
          onChange={setShelf}
        />
      </PageTitle>
      <View style={styles.tools}>
        {search}
        {shelf === 'routines' && routines.length > 0 && (
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
    tools: { gap: 14 },
    label: { ...type.label, marginBottom: 8 },
    search: { flexDirection: 'row', minHeight: 50, alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 3 },
    // Positioned, so on the web it paints above the glass's absolute layers (a static input sits under them).
    searchInput: { flex: 1, position: 'relative', fontFamily: fonts.body, fontSize: 16, color: colors.text, minHeight: 48 },
    clear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  });
