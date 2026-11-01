// Today's top half for the glass looks, laid out after the reference designs:
// Lavender follows the music-app home (search bar, art hero, category circles, list rows with art),
// Stone follows the meditation home (light greeting with a flower, recommendation card, category tiles).
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { type AccessibilityActionEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { type Kind, type Theme, useStyles, useTheme } from '../theme';
import { Magnolia, SceneArt } from './Art';
import { Glass } from './Glass';
import { alphaOf } from './glass/colour';
import { Enter, FadeSwap, Pop, Press, SelectFade } from './Motion';

type IconName = keyof typeof Ionicons.glyphMap;

export interface HomeItem {
  key: string;
  title: string;
  meta: string;
  done: boolean;
  /** Ionicons name shown on the row's colour tile. */
  icon?: string;
  /** The kind's colour: a pastel wash on the row's tile. */
  color?: string;
  /** Opens another screen (the workout, practice, the shopping list) instead of ticking off. */
  nav?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export interface HomeCategory {
  label: string;
  icon: IconName;
  /** The kind it belongs to: its pastel tint on Lavender. */
  kind: Kind;
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

/** A row's screen-reader actions: tapping it edits, and "Mark done" ticks it without finding the small button. */
function rowActions(it: HomeItem) {
  if (it.nav || !it.onLongPress) return {};
  return {
    accessibilityActions: [{ name: 'activate' }, { name: 'toggle', label: it.done ? 'Mark not done' : 'Mark done' }],
    onAccessibilityAction: (e: AccessibilityActionEvent) => {
      if (e.nativeEvent.actionName === 'toggle') it.onPress();
      else it.onLongPress?.();
    },
  };
}

export function GlassHome(props: Props) {
  const { name } = useTheme();
  return name === 'stone' ? <StoneHome {...props} /> : <LavenderHome {...props} />;
}

function LavenderHome(p: Props) {
  const { colors, kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  return (
    <View>
      <View style={styles.bar}>
        <Press onPress={p.onStats} style={styles.iconBtn} overlay={colors.material.pressFill} accessibilityLabel="Your week">
          <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
        </Press>
        <Press onPress={p.onSettings} style={styles.iconBtn} accessibilityLabel="Settings">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(p.name[0] ?? 'M').toUpperCase()}</Text>
          </View>
        </Press>
      </View>

      <Text style={styles.lavGreet}>{p.greeting}</Text>
      <Text style={styles.lavName} numberOfLines={1} accessibilityRole="header">
        {p.name}
      </Text>

      <View style={styles.searchRow}>
        <Glass tier="control" radius={18} style={styles.search} onPress={p.onAdd} accessibilityLabel="Add a routine, to-do or word">
          <Ionicons name="add-circle-outline" size={20} color={colors.muted} />
          <Text style={styles.searchText}>Add a routine, to-do, word…</Text>
        </Glass>
        <Glass
          tier="control"
          radius={18}
          style={styles.filter}
          onPress={p.onToggleCalendar}
          accessibilityLabel={p.calendarOpen ? 'Hide calendar' : 'Show calendar'}
          accessibilityState={{ expanded: p.calendarOpen }}
        >
          <FadeSwap
            on={p.calendarOpen}
            off={<Ionicons name="calendar-outline" size={20} color={colors.text} />}
            onContent={<Ionicons name="close" size={20} color={colors.text} />}
          />
        </Glass>
      </View>
      {p.calendarOpen && <Glass style={styles.calendar}>{p.calendar}</Glass>}

      <Enter index={0}>
        <View style={styles.lavHero}>
          <View style={StyleSheet.absoluteFill}>
            <SceneArt width={width - 32} height={200} variant="dusk" />
          </View>
          <LinearGradient
            colors={[alphaOf(colors.backdrop, 0.74), alphaOf(colors.backdrop, 0)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 0.55 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.lavHeroTitle} numberOfLines={2}>
            {p.hero.title}
          </Text>
          <Text style={styles.lavHeroMeta} numberOfLines={2}>
            {p.hero.eyebrow} · {p.hero.meta}
          </Text>
          <View style={styles.flex} />
          <Glass tier="control" radius={22} style={styles.lavPlay} onPress={p.hero.onAction} accessibilityLabel={p.hero.action}>
            <Ionicons name={p.hero.icon} size={20} color={colors.text} />
          </Glass>
        </View>
      </Enter>

      <SectionHead title="Categories" action="See all" onAction={p.onSeeAll} />
      <View style={styles.circles}>
        {p.categories.map((c) => (
          <View key={c.label} style={styles.circleItem}>
            <Glass
              tier="control"
              radius={26}
              tint={kinds[c.kind].soft}
              style={styles.circle}
              onPress={c.onPress}
              accessibilityLabel={c.label}
              accessibilityState={c.active !== undefined ? { selected: c.active } : undefined}
            >
              <SelectFade on={!!c.active} radius={26} style={styles.circleOn} />
              <Pop done={!!c.active}>
                <FadeSwap
                  on={!!c.active}
                  off={<Ionicons name={c.icon} size={22} color={colors.text} />}
                  onContent={<Ionicons name="checkmark" size={22} color={colors.onPrimary} />}
                />
              </Pop>
            </Glass>
            <Text style={styles.circleLabel} numberOfLines={2}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>

      <SectionHead title="Today" action={p.total ? `${p.done}/${p.total} done` : undefined} />
      <View style={styles.rows}>
        {p.items.length === 0 ? (
          <Glass radius={18} style={styles.emptyRow} onPress={p.onAdd} accessibilityLabel="Plan your day">
            <Ionicons name="add-circle-outline" size={20} color={colors.text} />
            <Text style={styles.rowTitle}>Plan your day: add a routine or a to-do</Text>
          </Glass>
        ) : (
          p.items.map((it, i) => (
            <Enter key={it.key} index={i + 1}>
              <Glass
                radius={18}
                style={styles.row}
                receded={it.done}
                onPress={it.nav ? it.onPress : it.onLongPress}
                accessibilityLabel={it.nav ? `${it.title}, ${it.meta}` : `Edit ${it.title}`}
                accessibilityHint={it.nav ? 'Opens it' : undefined}
                {...rowActions(it)}
              >
                <View style={[styles.thumb, { backgroundColor: alphaOf(it.color ?? colors.text, 0.22) }]}>
                  <Ionicons name={(it.icon ?? 'ellipse-outline') as 'sunny'} size={22} color={colors.text} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.rowTitle, it.done && styles.rowDone]} numberOfLines={1}>
                    {it.title}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {it.meta}
                  </Text>
                </View>
                {it.nav ? (
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} style={styles.chevron} />
                ) : (
                  <RowCheck item={it} />
                )}
              </Glass>
            </Enter>
          ))
        )}
      </View>
    </View>
  );
}

/** The round tick at a row's end: a play glyph until done, then the look's done fill fades in with a check. */
function RowCheck({ item: it }: { item: HomeItem }) {
  const { colors, name } = useTheme();
  const styles = useStyles(makeStyles);
  const stone = name === 'stone';
  return (
    <Press
      onPress={it.onPress}
      style={stone ? styles.stoneRowButton : styles.rowButton}
      overlay={colors.material.pressFill}
      haptic
      accessibilityRole="checkbox"
      accessibilityState={{ checked: it.done }}
      accessibilityLabel={`Mark ${it.title} done`}
    >
      <SelectFade on={it.done} radius={22} bleed={1} style={styles.rowButtonDone} />
      <Pop done={it.done}>
        <FadeSwap
          on={it.done}
          off={<Ionicons name={stone ? 'play-outline' : 'play'} size={14} color={colors.text} style={styles.playNudge} />}
          onContent={<Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
        />
      </Pop>
    </Press>
  );
}

function StoneHome(p: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View>
      <View style={styles.bar}>
        <Press onPress={p.onStats} style={styles.iconBtnStart} accessibilityLabel="Your week">
          <Ionicons name="pulse" size={28} color={colors.text} />
        </Press>
        <Glass tier="control" radius={22} style={styles.round} onPress={p.onSettings} accessibilityLabel="Settings">
          <Ionicons name="menu" size={20} color={colors.text} />
        </Glass>
      </View>

      <View style={styles.stoneTop}>
        <View style={styles.flex}>
          <Text style={styles.stoneGreet} accessibilityRole="header">
            {p.greeting},{'\n'}
            {p.name}
          </Text>
          <Text style={styles.stoneTagline}>{p.tagline}</Text>
        </View>
        <View style={styles.stoneBloom} pointerEvents="none">
          <Magnolia width={92} />
        </View>
      </View>

      <Enter index={0}>
        <Glass tier="hero" style={styles.stoneCard}>
          <View style={styles.stoneCardHead}>
            <Text style={[styles.stoneTitle, styles.flex]} numberOfLines={2}>
              {p.hero.title}
            </Text>
            <Press
              onPress={p.onToggleCalendar}
              style={styles.iconBtnEnd}
              accessibilityLabel={p.calendarOpen ? 'Hide calendar' : 'Show calendar'}
              accessibilityState={{ expanded: p.calendarOpen }}
            >
              <FadeSwap
                on={p.calendarOpen}
                off={<Ionicons name="calendar-outline" size={20} color={colors.link} />}
                onContent={<Ionicons name="close" size={20} color={colors.link} />}
              />
            </Press>
          </View>
          <Text style={styles.stoneMeta} numberOfLines={2}>
            {p.hero.eyebrow} · {p.hero.meta}
          </Text>
          <Press
            onPress={p.hero.onAction}
            style={styles.stonePill}
            overlay={colors.material.pressFill}
            haptic
            accessibilityLabel={p.hero.action}
          >
            <Ionicons name={p.hero.icon === 'play' ? 'play-outline' : p.hero.icon} size={16} color={colors.onPrimary} />
            <Text style={styles.stonePillText}>{p.hero.action}</Text>
          </Press>
        </Glass>
      </Enter>
      {p.calendarOpen && (
        <Glass style={styles.calendar}>
          <Text style={styles.stoneDate}>{p.dateLabel}</Text>
          {p.calendar}
        </Glass>
      )}

      <Enter index={1}>
        <Glass style={styles.stonePanel}>
          <Text style={styles.stonePanelTitle} accessibilityRole="header">
            Categories
          </Text>
          <View style={styles.tiles}>
            {p.categories.map((c, i) => {
              const warm = c.active || i >= p.categories.length - 2;
              return (
                <Press key={c.label} outerStyle={styles.tileSlot} style={styles.tileItem} onPress={c.onPress} accessibilityLabel={c.label}>
                  <View style={styles.tile}>
                    <SelectFade on={warm} radius={16} bleed={1} style={styles.tileWarm} />
                    <FadeSwap
                      on={warm}
                      off={<Ionicons name={c.icon} size={20} color={colors.text} />}
                      onContent={<Ionicons name={c.active ? 'checkmark' : c.icon} size={20} color={colors.onWarmTile} />}
                    />
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={2}>
                    {c.label}
                  </Text>
                </Press>
              );
            })}
          </View>
        </Glass>
      </Enter>

      <Enter index={2}>
        <Glass style={styles.stonePanel}>
          <View style={styles.stoneCardHead}>
            <Text style={styles.stonePanelTitle} accessibilityRole="header">
              Today
            </Text>
            {p.total > 0 && <Text style={styles.stoneMeta}>{`${p.done}/${p.total} done`}</Text>}
          </View>
          {p.items.length === 0 ? (
            <Press onPress={p.onAdd} style={styles.stoneRow} accessibilityLabel="Plan your day">
              <Ionicons name="add-circle-outline" size={20} color={colors.text} />
              <Text style={styles.stoneMeta}>Plan your day: add a routine or a to-do</Text>
            </Press>
          ) : (
            p.items.map((it, i) => (
              <Press
                key={it.key}
                style={styles.stoneRow}
                overlay={colors.material.pressFill}
                haptic={!it.nav}
                onPress={it.onPress}
                onLongPress={it.onLongPress}
                accessibilityRole={it.nav ? 'button' : 'checkbox'}
                accessibilityState={it.nav ? undefined : { checked: it.done }}
                accessibilityLabel={it.nav ? `${it.title}, ${it.meta}` : `${it.title}, ${it.meta}`}
                accessibilityHint={it.nav ? 'Opens it' : it.onLongPress ? 'Press and hold to edit' : undefined}
                accessibilityActions={it.onLongPress ? [{ name: 'activate' }, { name: 'longpress', label: 'Edit' }] : undefined}
                onAccessibilityAction={
                  it.onLongPress ? (e) => (e.nativeEvent.actionName === 'longpress' ? it.onLongPress?.() : it.onPress()) : undefined
                }
              >
                <View style={[styles.thumbStone, it.done && styles.thumbDone]}>
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
                {it.nav ? (
                  <Ionicons name="chevron-forward" size={20} color={colors.muted} style={styles.chevron} />
                ) : (
                  <View style={styles.stoneRowButton}>
                    <SelectFade on={it.done} radius={22} bleed={1} style={styles.rowButtonDone} />
                    <FadeSwap
                      on={it.done}
                      off={<Ionicons name="play-outline" size={14} color={colors.text} style={styles.playNudge} />}
                      onContent={<Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
                    />
                  </View>
                )}
              </Press>
            ))
          )}
        </Glass>
      </Enter>
    </View>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        onAction ? (
          <Press onPress={onAction} style={styles.sectionActionBtn} accessibilityLabel={action}>
            <Text style={styles.sectionAction}>{action}</Text>
          </Press>
        ) : (
          <Text style={styles.sectionAction}>{action}</Text>
        )
      ) : null}
    </View>
  );
}

const makeStyles = ({ colors, fonts, radii }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.material.rimTop,
      backgroundImage: `linear-gradient(160deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    avatarText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    iconBtnStart: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
    iconBtnEnd: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center', marginTop: -6, marginRight: -4 },
    sectionActionBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    calendar: { marginTop: 14, padding: 8 },
    chevron: { marginRight: 8 },

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
      borderRadius: radii.hero,
      overflow: 'hidden',
      padding: 20,
      borderWidth: 1,
      borderColor: colors.material.rimLeft,
      borderTopColor: colors.material.rimTop,
      boxShadow: colors.material.shadowHero,
    },
    lavHeroTitle: {
      fontFamily: fonts.display,
      fontSize: 30,
      lineHeight: 34,
      color: colors.text,
      letterSpacing: -0.5,
      maxWidth: '72%',
    },
    lavHeroMeta: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.text, maxWidth: '72%' },
    lavPlay: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, minHeight: 44 },
    sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.text },
    sectionAction: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    circles: { flexDirection: 'row', justifyContent: 'space-between' },
    circleItem: { alignItems: 'center', gap: 8, flex: 1, maxWidth: 72 },
    circle: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    circleOn: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    circleLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, color: colors.text, textAlign: 'center' },
    rows: { gap: 10, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 12, minHeight: 64 },
    emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
    thumb: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
    rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    rowDone: { fontFamily: fonts.body, color: colors.faint, textDecorationLine: 'line-through' },
    rowButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.controlBorder,
    },
    rowButtonDone: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    playNudge: { marginLeft: 2 },

    // Stone
    stoneTop: { flexDirection: 'row', marginTop: 22 },
    stoneGreet: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text, letterSpacing: 0.2 },
    stoneTagline: { marginTop: 10, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.muted, maxWidth: 220 },
    stoneBloom: { position: 'absolute', right: -6, top: -6 },
    stoneCard: { marginTop: 22, padding: 20 },
    stoneCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    stoneTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 31, color: colors.text },
    stoneMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    stonePill: {
      marginTop: 18,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.material.control.shadow}`,
    },
    stonePillText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.onPrimary },
    stoneDate: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginBottom: 6, marginHorizontal: 8, marginTop: 6 },
    stonePanel: { marginTop: 14, padding: 16 },
    stonePanelTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    tiles: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    tileSlot: { flex: 1, maxWidth: 72 },
    tileItem: { alignItems: 'center', gap: 8, minHeight: 44, borderRadius: radii.inset },
    tile: {
      width: 50,
      height: 50,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    tileWarm: { backgroundColor: colors.warmTile },
    tileLabel: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.muted, textAlign: 'center' },
    stoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      minHeight: 56,
      paddingVertical: 5,
      borderRadius: radii.inset,
    },
    thumbStone: { width: 46, height: 46, borderRadius: 12, overflow: 'hidden' },
    thumbDone: { opacity: 0.6 },
    stoneRowTitle: { fontFamily: fonts.body, fontSize: 16, color: colors.text },
    stoneRowButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.controlBorder,
    },
  });
