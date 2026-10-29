import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckRow } from '../components/CheckRow';
import { Divider, Section } from '../components/Section';
import { useStore } from '../lib/store';
import { boughtOn, isOnList, parseKey } from '../lib/schedule';
import { colors, radius } from '../theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const { ready, today, groceries, toggleBought } = useStore();
  const insets = useSafeAreaInsets();
  const list = groceries
    .filter((g) => isOnList(g, today))
    .sort((a, b) => Number(boughtOn(a, today)) - Number(boughtOn(b, today)) || a.name.localeCompare(b.name));
  const done = list.filter((g) => boughtOn(g, today)).length;
  const total = list.length;
  const pct = total ? done / total : 0;

  const dateLabel = parseKey(today).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.date}>{dateLabel}</Text>
      <Text style={styles.greeting}>{greeting()}</Text>

      <View style={styles.progressCard}>
        <Text style={styles.progressText}>
          {total === 0 ? 'Nothing planned yet' : done === total ? 'All done for today' : `${done} of ${total} done`}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
      </View>

      {ready && (
        <Section
          title="Groceries"
          right={
            <Pressable onPress={() => router.navigate('/groceries')} hitSlop={8}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          }
        >
          {list.length === 0 ? (
            <Pressable style={styles.empty} onPress={() => router.navigate('/groceries')}>
              <Text style={styles.emptyText}>
                {groceries.length === 0
                  ? 'Add the things you buy often, and they will show up here when you need them.'
                  : 'Nothing to buy today.'}
              </Text>
              {groceries.length === 0 && <Text style={styles.link}>Set up groceries</Text>}
            </Pressable>
          ) : (
            list.map((g, i) => (
              <View key={g.id}>
                {i > 0 && <Divider />}
                <CheckRow
                  title={g.name}
                  subtitle={g.quantity}
                  done={boughtOn(g, today)}
                  onToggle={() => toggleBought(g.id)}
                />
              </View>
            ))
          )}
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  date: { fontSize: 14, color: colors.muted },
  greeting: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 2 },
  progressCard: { backgroundColor: colors.card, borderRadius: radius, padding: 16, marginTop: 16 },
  progressText: { fontSize: 16, fontWeight: '600', color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.primarySoft, marginTop: 10, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  empty: { padding: 16, gap: 8 },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 21 },
});
