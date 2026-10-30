// Today's top half for the glass looks, laid out after the reference designs:
// Lavender follows the music-app home (search bar, art hero, category circles, list rows with art),
// Stone follows the meditation home (light greeting with a flower, recommendation card, category tiles).
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Bloom, SceneArt } from './Art';
import { Glass } from './Glass';

type IconName = keyof typeof Ionicons.glyphMap;

export interface HomeItem {
  key: string;
  title: string;
  meta: string;
  done: boolean;
  /** Ionicons name shown on the row's colour tile. */
  icon?: string;
  onPress: () => void;
  onLongPress?: () => void;
}

/** Vivid tile colours for Lavender rows, so each row reads at a glance like album art. */
const TILES: [string, string][] = [
  ['#FF8AD8', '#7B5CFF'],
  ['#5EE7FF', '#4F6BFF'],
  ['#FFB38A', '#FF5FA2'],
  ['#8CF5C8', '#2FA4D9'],
  ['#C7A6FF', '#5B3FD9'],
  ['#FFE08A', '#FF8A5B'],
];

export interface HomeCategory {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Done for today (filled), or the warm highlight on Stone. */
  active?: boolean;
}

interface Props {
  name: string;
  greeting: string;
  tagline: string;
  dateLabel: string;
  calendarOpen: boolean;
  calendar: ReactNode;
  onToggleCalendar: () => void;
  hero: { eyebrow: string; title: string; meta: string; action: string; icon: IconName; onAction: () => void };
  categories: HomeCategory[];
  items: HomeItem[];
  done: number;
  total: number;
  onAdd: () => void;
  onSettings: () => void;
  onStats: () => void;
  onSeeAll: () => void;
}

export function GlassHome(props: Props) {
  const { name } = useTheme();
  return name === 'stone' ? <StoneHome {...props} /> : <LavenderHome {...props} />;
}

function LavenderHome(p: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  return (
    <View>
      <View style={styles.bar}>
        <Pressable onPress={p.onSettings} style={styles.iconBtnStart} accessibilityRole="button" accessibilityLabel="Settings">
          <Ionicons name="menu" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.barRight}>
          <Pressable onPress={p.onStats} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Your week">
            <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={p.onSettings} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Your profile">
            <LinearGradient colors={['#FFC6E9', '#8F7CFF']} style={styles.avatar}>
              <Text style={styles.avatarText}>{(p.name[0] ?? 'M').toUpperCase()}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <Text style={styles.lavGreet}>{p.greeting}</Text>
      <Text style={styles.lavName} numberOfLines={1}>
        {p.name}
      </Text>

      <View style={styles.searchRow}>
        <Glass radius={18} style={styles.search} onPress={p.onAdd} accessibilityLabel="Add a routine, to-do or word">
          <Ionicons name="add-circle-outline" size={18} color={colors.muted} />
          <Text style={styles.searchText}>Add a routine, to-do, word…</Text>
        </Glass>
        <Glass
          radius={18}
          style={styles.filter}
          onPress={p.onToggleCalendar}
          accessibilityLabel={p.calendarOpen ? 'Hide calendar' : 'Show calendar'}
        >
          <Ionicons name={p.calendarOpen ? 'close' : 'calendar-outline'} size={18} color={colors.text} />
        </Glass>
      </View>
      {p.calendarOpen && <View style={styles.calendar}>{p.calendar}</View>}

      <View style={styles.lavHero}>
        <View style={StyleSheet.absoluteFill}>
          <SceneArt width={width - 32} height={200} variant="dusk" />
        </View>
        <LinearGradient
          colors={['rgba(24,18,80,0.74)', 'rgba(24,18,80,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.lavEyebrow}>{p.hero.eyebrow}</Text>
        <Text style={styles.lavHeroTitle} numberOfLines={2}>
          {p.hero.title}
        </Text>
        <Text style={styles.lavHeroMeta} numberOfLines={1}>
          {p.hero.meta}
        </Text>
        <View style={styles.flex} />
        <Glass radius={22} style={styles.lavPlay} onPress={p.hero.onAction} accessibilityLabel={p.hero.action}>
          <Ionicons name={p.hero.icon} size={20} color="#FFFFFF" />
        </Glass>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>

      <SectionHead title="Categories" action="See all" onAction={p.onSeeAll} />
      <View style={styles.circles}>
        {p.categories.map((c) => (
          <View key={c.label} style={styles.circleItem}>
            <Glass
              radius={26}
              tint={c.active ? colors.selected : undefined}
              style={styles.circle}
              onPress={c.onPress}
              accessibilityLabel={c.label}
            >
              <Ionicons name={c.active ? 'checkmark' : c.icon} size={22} color="#FFFFFF" />
            </Glass>
            <Text style={styles.circleLabel} numberOfLines={1}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>

      <SectionHead title="Today" action={p.total ? `${p.done}/${p.total} done` : undefined} />
      <View style={styles.rows}>
        {p.items.length === 0 ? (
          <Glass radius={18} style={styles.emptyRow} onPress={p.onAdd} accessibilityLabel="Plan your day">
            <Ionicons name="sparkles-outline" size={18} color={colors.text} />
            <Text style={styles.rowTitle}>Plan your day: add a routine or a to-do</Text>
          </Glass>
        ) : (
          p.items.map((it, i) => (
            <Glass key={it.key} radius={18} style={styles.row} onPress={it.onLongPress} accessibilityLabel={`Edit ${it.title}`}>
              <LinearGradient colors={TILES[i % TILES.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
                <Ionicons name={(it.icon ?? 'sparkles') as 'sparkles'} size={22} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, it.done && styles.rowDone]} numberOfLines={1}>
                  {it.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {it.meta}
                </Text>
              </View>
              <Pressable
                onPress={it.onPress}
                style={[styles.rowButton, it.done && styles.rowButtonDone]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: it.done }}
                accessibilityLabel={it.title}
              >
                <Ionicons name={it.done ? 'checkmark' : 'play'} size={14} color="#FFFFFF" style={it.done ? undefined : styles.playNudge} />
              </Pressable>
            </Glass>
          ))
        )}
      </View>
    </View>
  );
}

function StoneHome(p: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View>
      <View style={styles.bar}>
        <Pressable onPress={p.onStats} style={styles.iconBtnStart} accessibilityRole="button" accessibilityLabel="Your week">
          <Ionicons name="pulse" size={30} color={colors.text} />
        </Pressable>
        <Glass radius={22} style={styles.round} onPress={p.onSettings} accessibilityLabel="Settings">
          <Ionicons name="menu" size={20} color={colors.text} />
        </Glass>
      </View>

      <View style={styles.stoneTop}>
        <View style={styles.flex}>
          <Text style={styles.stoneGreet}>
            {p.greeting},{'\n'}
            {p.name}
          </Text>
          <Text style={styles.stoneTagline}>{p.tagline}</Text>
        </View>
        <View style={styles.stoneBloom} pointerEvents="none">
          <Bloom size={92} />
        </View>
      </View>

      <Glass style={styles.stoneCard}>
        <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.stoneCardHead}>
          <Text style={styles.stoneEyebrow}>★ {p.hero.eyebrow}</Text>
          <Pressable
            onPress={p.onToggleCalendar}
            style={styles.iconBtnEnd}
            accessibilityRole="button"
            accessibilityLabel={p.calendarOpen ? 'Hide calendar' : 'Show calendar'}
          >
            <Ionicons name={p.calendarOpen ? 'close' : 'arrow-forward'} size={18} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.stoneTitle} numberOfLines={2}>
          {p.hero.title}
        </Text>
        <Text style={styles.stoneMeta} numberOfLines={1}>
          {p.hero.meta}
        </Text>
        <Pressable onPress={p.hero.onAction} style={styles.stonePill} accessibilityRole="button" accessibilityLabel={p.hero.action}>
          <Ionicons name={p.hero.icon === 'play' ? 'play-outline' : p.hero.icon} size={14} color={colors.onPrimary} />
          <Text style={styles.stonePillText}>{p.hero.action}</Text>
        </Pressable>
      </Glass>
      {p.calendarOpen && (
        <View style={styles.calendar}>
          <Text style={styles.stoneDate}>{p.dateLabel}</Text>
          {p.calendar}
        </View>
      )}

      <Glass style={styles.stonePanel}>
        <Text style={styles.stonePanelTitle}>Categories</Text>
        <View style={styles.tiles}>
          {p.categories.map((c, i) => (
            <Pressable key={c.label} style={styles.tileItem} onPress={c.onPress} accessibilityRole="button" accessibilityLabel={c.label}>
              <View style={[styles.tile, (c.active || i >= p.categories.length - 2) && styles.tileWarm]}>
                <Ionicons
                  name={c.active ? 'checkmark' : c.icon}
                  size={20}
                  color={c.active || i >= p.categories.length - 2 ? '#F4E6BF' : colors.text}
                />
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Glass>

      <Glass style={styles.stonePanel}>
        <View style={styles.stoneCardHead}>
          <Text style={styles.stonePanelTitle}>Today</Text>
          {p.total > 0 && <Text style={styles.stoneMeta}>{`${p.done}/${p.total} done`}</Text>}
        </View>
        {p.items.length === 0 ? (
          <Pressable onPress={p.onAdd} style={styles.stoneRow} accessibilityRole="button" accessibilityLabel="Plan your day">
            <Text style={styles.stoneMeta}>Plan your day: add a routine or a to-do</Text>
          </Pressable>
        ) : (
          p.items.map((it, i) => (
            <Pressable
              key={it.key}
              style={styles.stoneRow}
              onPress={it.onPress}
              onLongPress={it.onLongPress}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: it.done }}
              accessibilityLabel={it.title}
            >
              <View style={styles.thumbStone}>
                <SceneArt width={46} height={46} variant={['calm', 'rain', 'waves', 'brown'][i % 4]} />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.stoneRowTitle, it.done && styles.rowDone]} numberOfLines={1}>
                  {it.title}
                </Text>
                <Text style={styles.stoneMeta} numberOfLines={1}>
                  {it.meta}
                </Text>
              </View>
              <View style={[styles.stoneRowButton, it.done && styles.stoneRowButtonDone]}>
                <Ionicons
                  name={it.done ? 'checkmark' : 'play'}
                  size={13}
                  color={it.done ? colors.onPrimary : colors.text}
                  style={it.done ? undefined : styles.playNudge}
                />
              </View>
            </Pressable>
          ))
        )}
      </Glass>
    </View>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} disabled={!onAction} style={styles.sectionActionBtn} accessibilityRole={onAction ? 'button' : 'text'}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
    barRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.7)',
    },
    avatarText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#FFFFFF' },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconBtnStart: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
    iconBtnEnd: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center', marginVertical: -12 },
    sectionActionBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    calendar: { marginTop: 14 },

    // Lavender
    lavGreet: { marginTop: 14, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    lavName: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.4 },
    searchRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    search: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
    searchText: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    filter: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    lavHero: {
      marginTop: 18,
      height: 200,
      borderRadius: 26,
      overflow: 'hidden',
      padding: 20,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      boxShadow: colors.shadow,
    },
    lavEyebrow: { fontFamily: fonts.bodyMedium, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
    lavHeroTitle: {
      marginTop: 4,
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 33,
      color: '#FFFFFF',
      letterSpacing: -0.5,
      maxWidth: '70%',
    },
    lavHeroMeta: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, color: '#FFFFFF' },
    lavPlay: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    dots: {
      position: 'absolute',
      bottom: 16,
      alignSelf: 'center',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
    },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
    dotActive: { width: 16, backgroundColor: '#FFFFFF' },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 2 },
    sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
    sectionAction: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    circles: { flexDirection: 'row', justifyContent: 'space-between' },
    circleItem: { alignItems: 'center', gap: 8, width: 66 },
    circle: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    circleLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
    rows: { gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 12 },
    emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
    thumb: { width: 48, height: 48, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
    rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    rowDone: { opacity: 0.6, textDecorationLine: 'line-through' },
    rowButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderWidth: 1,
      borderColor: colors.rim,
    },
    rowButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
    playNudge: { marginLeft: 2 },

    // Stone
    stoneTop: { flexDirection: 'row', marginTop: 22 },
    stoneGreet: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text, letterSpacing: 0.2 },
    stoneTagline: { marginTop: 10, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.muted, maxWidth: 220 },
    stoneBloom: { position: 'absolute', right: -6, top: -6 },
    stoneCard: { marginTop: 22, padding: 20, borderRadius: 28 },
    stoneCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stoneEyebrow: { fontFamily: fonts.body, fontSize: 14, letterSpacing: 0.6, color: colors.primary },
    stoneTitle: { marginTop: 10, fontFamily: fonts.display, fontSize: 26, lineHeight: 31, color: colors.text },
    stoneMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    stonePill: {
      marginTop: 18,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#D9CFBA',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.5)',
      boxShadow: '0px 6px 18px rgba(0,0,0,0.22)',
    },
    stonePillText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.onPrimary },
    stoneDate: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginBottom: 6 },
    stonePanel: { marginTop: 14, padding: 16, borderRadius: 24 },
    stonePanelTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    tiles: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    tileItem: { alignItems: 'center', gap: 8, width: 60, minHeight: 44 },
    tile: {
      width: 50,
      height: 50,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,250,235,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,250,235,0.2)',
    },
    tileWarm: { backgroundColor: 'rgba(201,179,122,0.38)', borderColor: 'rgba(244,230,191,0.4)' },
    tileLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    stoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    thumbStone: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
    stoneRowTitle: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    stoneRowButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,250,235,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(255,250,235,0.2)',
    },
    stoneRowButtonDone: { backgroundColor: colors.primary },
  });
