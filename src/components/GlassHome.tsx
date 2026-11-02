// Today's top half for the glass looks, laid out after the reference designs:
// Lavender follows the music-app home (search bar, art hero, category circles, list rows with art),
// Stone follows the meditation home (a light greeting in window light, recommendation card, category tiles).
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useRef } from 'react';
import { type AccessibilityActionEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { type Kind, type Theme, useStyles, useTheme } from '../theme';
import { SceneArt } from './Art';
import { Glass, GlassScroll } from './Glass';
import { alphaOf } from './glass/colour';
import { Dim, EASE_OUT, Enter, FadeSwap, Pop, Press, SelectFade, useReduceMotion } from './Motion';

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
  /** Stone: the day under the greeting ('Sunday 1 November'). */
  dayLine?: string;
  calendarOpen: boolean;
  calendar: ReactNode;
  onToggleCalendar: () => void;
  /** `next`: the hero is the next routine (its action ticks it off); otherwise it sums up the day. */
  hero: { eyebrow: string; title: string; meta: string; action: string; icon: IconName; next?: boolean; onAction: () => void };
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
  const { colors, radii, kinds: kindColours } = useTheme();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const allDone = p.total > 0 && p.done === p.total;
  const heroW = width - 32;
  return (
    <View>
      <View style={styles.lavTop}>
        <View style={styles.flex}>
          <Text style={styles.lavGreet}>{p.greeting}</Text>
          <Text style={styles.lavName} numberOfLines={1} accessibilityRole="header">
            {p.name}
          </Text>
        </View>
        <Glass tier="control" radius={22} style={styles.round} onPress={p.onStats} accessibilityLabel="Your week">
          <Ionicons name="stats-chart-outline" size={20} color={colors.text} />
        </Glass>
        <Press onPress={p.onSettings} style={styles.avatarBtn} accessibilityLabel="Settings">
          <View style={styles.lavAvatar}>
            <Text style={styles.avatarText}>{(p.name[0] ?? 'M').toUpperCase()}</Text>
          </View>
        </Press>
      </View>

      <View style={styles.searchRow}>
        <Glass tier="control" radius={26} style={styles.lavSearch} onPress={p.onAdd} accessibilityLabel="Add a routine, to-do or word">
          <Ionicons name="add-circle-outline" size={22} color={colors.muted} />
          <Text style={styles.searchText} numberOfLines={1}>
            Add a routine, to-do, word…
          </Text>
        </Glass>
        <Glass
          tier="control"
          radius={26}
          style={styles.lavFilter}
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
        <View style={styles.heroSlot}>
          <DoneBloom on={allDone} />
          <Glass tier="hero" radius={radii.hero} bloom style={styles.lavHero}>
            <FadeSwap
              on={allDone}
              duration={400}
              style={StyleSheet.absoluteFill}
              off={<SceneArt width={heroW} height={HERO_H} variant="dusk" />}
              onContent={<SceneArt width={heroW} height={HERO_H} variant="waves" />}
            />
            <LinearGradient
              colors={[alphaOf(colors.backdrop, 0.78), alphaOf(colors.backdrop, 0)]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 0.6 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.lavHeroTitle} numberOfLines={2}>
              {allDone ? 'All done for today' : p.hero.title}
            </Text>
            <Text style={styles.lavHeroMeta} numberOfLines={2}>
              {allDone ? 'Every routine ticked. Enjoy the rest of your day.' : `${p.hero.eyebrow} · ${p.hero.meta}`}
            </Text>
            <View style={styles.flex} />
            {!allDone && (
              <Press
                onPress={p.hero.onAction}
                style={styles.lavAction}
                haptic
                accessibilityLabel={p.hero.next ? `${p.hero.action}: ${p.hero.title}` : p.hero.action}
              >
                <Ionicons name={p.hero.icon} size={20} color={colors.onNode} />
                <Text style={styles.lavActionText}>{p.hero.action}</Text>
              </Press>
            )}
          </Glass>
        </View>
      </Enter>

      <SectionHead title="Categories" action="See all" onAction={p.onSeeAll} />
      {/* Spread across a wide phone; on a narrow one (360dp and under) the row runs to the screen's edge and
          scrolls sideways, so no circle or label is cut off at the margin. */}
      <GlassScroll horizontal showsHorizontalScrollIndicator={false} style={styles.circlesScroll} contentContainerStyle={styles.circles}>
        {p.categories.map((c) => (
          <View key={c.label} style={styles.circleItem}>
            <Glass
              tier="control"
              radius={28}
              tint={alphaOf(kindColours[c.kind].color, 0.36)}
              style={styles.circle}
              onPress={c.onPress}
              accessibilityLabel={c.label}
              accessibilityState={c.active !== undefined ? { selected: c.active } : undefined}
            >
              <SelectFade on={!!c.active} radius={28} style={styles.doneFill} />
              <Pop done={!!c.active}>
                <FadeSwap
                  on={!!c.active}
                  off={<Ionicons name={c.icon} size={24} color={colors.text} />}
                  onContent={<Ionicons name="checkmark" size={24} color={colors.onDone} />}
                />
              </Pop>
            </Glass>
            <Text style={styles.circleLabel} numberOfLines={2}>
              {c.label}
            </Text>
          </View>
        ))}
      </GlassScroll>

      <SectionHead title="Today" action={p.total ? `${p.done}/${p.total} done` : undefined} pill />
      <View style={styles.rows}>
        {p.items.length === 0 ? (
          <Glass style={styles.emptyRow}>
            <Text style={styles.emptyTitle}>Nothing planned yet</Text>
            <Text style={styles.rowMeta}>Add a routine or a to-do, and it shows up here at its time.</Text>
            <Press onPress={p.onAdd} style={styles.whitePill} haptic accessibilityLabel="Add a routine">
              <Ionicons name="add" size={18} color={colors.onNode} />
              <Text style={styles.whitePillText}>Add a routine</Text>
            </Press>
          </Glass>
        ) : (
          p.items.map((it, i) => (
            <Enter key={it.key} index={i + 1}>
              <Glass
                radius={radii.row}
                style={styles.row}
                receded={it.done}
                onPress={it.nav ? it.onPress : it.onLongPress}
                accessibilityLabel={it.nav ? `${it.title}, ${it.meta}` : `Edit ${it.title}`}
                accessibilityHint={it.nav ? 'Opens it' : undefined}
                {...rowActions(it)}
              >
                <Dim on={it.done} style={[styles.thumb, { backgroundColor: it.color ?? colors.node }]}>
                  <Ionicons name={(it.icon ?? 'ellipse-outline') as 'sunny'} size={22} color={colors.onKind} />
                </Dim>
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

const HERO_H = 212;

/** The reward when the whole day is ticked: a rose light opens behind the hero once, 600ms ease-out (a fade
 *  alone under reduced motion). Already done when the screen opens: it is simply there. */
function DoneBloom({ on }: { on: boolean }) {
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const o = useSharedValue(on ? 1 : 0);
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timing = { duration: 600, easing: EASE_OUT, reduceMotion: ReduceMotion.Never };
    if (on && !reduced) {
      s.set(0.96);
      s.set(withTiming(1, timing));
    }
    o.set(withTiming(on ? 1 : 0, timing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  const anim = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ scale: s.get() }] }));
  return <Animated.View pointerEvents="none" style={[styles.doneBloom, anim]} />;
}

/** The tick at a row's end: an empty ring (a checkbox, not a play button) in a 44 target; when done the look's
 *  done fill fades into the ring with a check. */
function RowCheck({ item: it }: { item: HomeItem }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Press
      onPress={it.onPress}
      style={styles.rowButton}
      overlay={colors.material.pressFill}
      haptic
      accessibilityRole="checkbox"
      accessibilityState={{ checked: it.done }}
      accessibilityLabel={`Mark ${it.title} done`}
    >
      <Pop done={it.done} style={styles.tickRing}>
        <SelectFade on={it.done} radius={15} bleed={1.5} style={styles.doneFill} />
        <FadeSwap on={it.done} off={null} onContent={<Ionicons name="checkmark" size={18} color={colors.onDone} />} />
      </Pop>
    </Press>
  );
}

function StoneHome(p: Props) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const allDone = p.total > 0 && p.done === p.total;
  // Five 64dp tiles fit the panel from about 392dp. Narrower, the row scrolls sideways with 62dp slots: just
  // wide enough for "Groceries" beside "Language", and the fifth tile peeks in at the panel's edge.
  const { width } = useWindowDimensions();
  const slot = width - 32 >= 16 + 5 * 64 + 8 + 16 ? 64 : 62;
  return (
    <View>
      <View style={styles.bar}>
        <Glass tier="control" radius={22} style={styles.round} onPress={p.onStats} accessibilityLabel="Your week">
          <Ionicons name="stats-chart-outline" size={18} color={colors.text} />
        </Glass>
        <View style={styles.barEnd}>
          <Glass
            tier="control"
            radius={22}
            style={styles.round}
            onPress={p.onToggleCalendar}
            accessibilityLabel={p.calendarOpen ? 'Hide calendar' : 'Show calendar'}
            accessibilityState={{ expanded: p.calendarOpen }}
          >
            <FadeSwap
              on={p.calendarOpen}
              off={<Ionicons name="calendar-outline" size={18} color={colors.text} />}
              onContent={<Ionicons name="close" size={18} color={colors.text} />}
            />
          </Glass>
          <Glass tier="control" radius={22} style={styles.round} onPress={p.onSettings} accessibilityLabel="Settings">
            <Ionicons name="menu" size={18} color={colors.text} />
          </Glass>
        </View>
      </View>

      <View style={styles.stoneTop}>
        <Text style={styles.stoneGreet} accessibilityRole="header">
          {p.greeting},{'\n'}
          {p.name}
        </Text>
        {p.dayLine ? <Text style={styles.stoneDay}>{p.dayLine}</Text> : null}
        <Text style={styles.stoneTagline}>{p.tagline}</Text>
      </View>

      {p.calendarOpen && <Glass style={styles.calendar}>{p.calendar}</Glass>}

      <View>
        <Enter index={0}>
          <Glass tier="hero" radius={radii.hero} style={styles.stoneCard}>
            <Text style={styles.stoneTitle} numberOfLines={2}>
              {allDone ? 'All done' : p.hero.title}
            </Text>
            <Text style={styles.stoneHeroMeta} numberOfLines={2}>
              {allDone ? `Rest well, ${p.name}` : p.hero.next ? `${p.hero.eyebrow} · ${p.hero.meta}` : p.hero.meta}
            </Text>
            {allDone ? (
              <Press
                onPress={p.onAdd}
                style={styles.ghostPill}
                overlay={colors.material.pressFill}
                accessibilityLabel="Add a routine or a to-do"
              >
                <Ionicons name="add" size={18} color={colors.text} />
                <Text style={styles.ghostPillText}>Add something</Text>
              </Press>
            ) : (
              <Press
                onPress={p.hero.onAction}
                style={styles.stonePill}
                overlay={colors.material.pressFill}
                haptic
                accessibilityLabel={p.hero.action}
              >
                <Ionicons name={p.hero.icon} size={18} color={colors.onPrimary} />
                <Text style={styles.stonePillText}>{p.hero.action}</Text>
              </Press>
            )}
          </Glass>
        </Enter>
      </View>

      <Enter index={1}>
        <Glass style={styles.stonePanel}>
          <Text style={styles.stonePanelTitle} accessibilityRole="header">
            Categories
          </Text>
          <GlassScroll horizontal showsHorizontalScrollIndicator={false} style={styles.tilesScroll} contentContainerStyle={styles.tiles}>
            {p.categories.map((c) => {
              const warm = !!c.active;
              return (
                <Press
                  key={c.label}
                  outerStyle={[styles.tileSlot, { width: slot }]}
                  style={styles.tileItem}
                  onPress={c.onPress}
                  accessibilityLabel={c.active ? `${c.label}, done today` : c.label}
                >
                  <View style={styles.tile}>
                    <SelectFade on={warm} radius={16} bleed={1} style={styles.tileWarm} />
                    <Pop done={warm}>
                      <FadeSwap
                        on={warm}
                        off={<Ionicons name={c.icon} size={22} color={colors.text} />}
                        onContent={<Ionicons name="checkmark" size={22} color={colors.onWarmTile} />}
                      />
                    </Pop>
                  </View>
                  <Text style={styles.tileLabel}>{c.label}</Text>
                </Press>
              );
            })}
          </GlassScroll>
        </Glass>
      </Enter>

      <Enter index={2}>
        <Glass style={styles.stoneList}>
          <View style={styles.stoneListHead}>
            <Text style={styles.stonePanelTitle} accessibilityRole="header">
              Today
            </Text>
            {p.total > 0 && <Text style={styles.stoneCount}>{`${p.done} of ${p.total} done`}</Text>}
          </View>
          {p.items.map((it) => (
            <View key={it.key}>
              <View style={styles.divider} />
              <Press
                style={styles.stoneRow}
                overlay={colors.material.pressFill}
                haptic={!it.nav}
                onPress={it.onPress}
                onLongPress={it.onLongPress}
                accessibilityRole={it.nav ? 'button' : 'checkbox'}
                accessibilityState={it.nav ? undefined : { checked: it.done }}
                accessibilityLabel={`${it.title}, ${it.meta}`}
                accessibilityHint={it.nav ? 'Opens it' : it.onLongPress ? 'Press and hold to edit' : undefined}
                accessibilityActions={it.onLongPress ? [{ name: 'activate' }, { name: 'longpress', label: 'Edit' }] : undefined}
                onAccessibilityAction={
                  it.onLongPress ? (e) => (e.nativeEvent.actionName === 'longpress' ? it.onLongPress?.() : it.onPress()) : undefined
                }
              >
                <Dim on={it.done} to={0.6} style={styles.stoneTile}>
                  <Ionicons name={(it.icon ?? 'ellipse-outline') as 'sunny'} size={20} color={colors.accent} />
                </Dim>
                <View style={styles.flex}>
                  <Text style={[styles.stoneRowTitle, it.done && styles.stoneRowDone]} numberOfLines={1}>
                    {it.title}
                  </Text>
                  <Text style={[styles.stoneRowMeta, it.done && styles.stoneMetaDone]} numberOfLines={1}>
                    {it.meta}
                  </Text>
                </View>
                {it.nav ? (
                  <View style={styles.stoneNav}>
                    <SelectFade on={it.done} radius={20} style={styles.doneFill} />
                    <FadeSwap
                      on={it.done}
                      off={<Ionicons name="chevron-forward" size={18} color={colors.muted} />}
                      onContent={<Ionicons name="checkmark" size={16} color={colors.onDone} />}
                    />
                  </View>
                ) : (
                  <View style={styles.stoneRing}>
                    <SelectFade on={it.done} radius={20} bleed={1.5} style={styles.doneFill} />
                    <Pop done={it.done}>
                      <FadeSwap
                        on={it.done}
                        off={<View style={styles.ringEmpty} />}
                        onContent={<Ionicons name="checkmark" size={16} color={colors.onDone} />}
                      />
                    </Pop>
                  </View>
                )}
              </Press>
            </View>
          ))}
          <View style={styles.divider} />
          <Press
            style={styles.stoneRow}
            overlay={colors.material.pressFill}
            onPress={p.onAdd}
            accessibilityLabel="Add a routine or a to-do"
          >
            <View style={styles.stoneTile}>
              <Ionicons name="add" size={22} color={colors.accent} />
            </View>
            <Text style={[styles.stoneRowMeta, styles.flex]}>
              {p.items.length === 0 ? 'Plan your day: add a routine or a to-do' : 'Add a routine or a to-do'}
            </Text>
          </Press>
        </Glass>
      </Enter>
    </View>
  );
}

function SectionHead({ title, action, onAction, pill }: { title: string; action?: string; onAction?: () => void; pill?: boolean }) {
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
        ) : pill ? (
          <Glass tier="control" radius={14} style={styles.countPill}>
            <Text style={styles.countText}>{action}</Text>
          </Glass>
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
    avatarText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    sectionActionBtn: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
    calendar: { marginTop: 14, padding: 8 },
    chevron: { marginRight: 8 },

    // Lavender
    lavTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    lavGreet: { fontFamily: fonts.body, fontSize: 16, lineHeight: 21, color: colors.muted },
    lavName: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.6 },
    avatarBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    lavAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.litRim,
      backgroundImage: `linear-gradient(160deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: colors.material.control.shadow,
    },
    searchRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    lavSearch: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
    searchText: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    lavFilter: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    heroSlot: { marginTop: 18 },
    lavHero: { height: HERO_H, padding: 20 },
    doneBloom: {
      position: 'absolute',
      left: -24,
      right: -24,
      top: 40,
      bottom: -48,
      backgroundImage: `radial-gradient(50% 50% at 50% 55%, ${alphaOf(colors.accent, 0.55)}, ${alphaOf(colors.accent, 0)})`,
    },
    lavHeroTitle: {
      fontFamily: fonts.display,
      fontSize: 32,
      lineHeight: 36,
      color: colors.text,
      letterSpacing: -0.6,
      maxWidth: '78%',
    },
    lavHeroMeta: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.text, maxWidth: '72%' },
    lavAction: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 48,
      paddingLeft: 16,
      paddingRight: 20,
      borderRadius: 24,
      backgroundImage: `linear-gradient(180deg, ${colors.node}, ${alphaOf(colors.node, 0.86)})`,
      boxShadow: colors.actionGlow,
    },
    lavActionText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onNode },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, minHeight: 44 },
    sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.text },
    sectionAction: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    countPill: { height: 28, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
    countText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
    circlesScroll: { marginHorizontal: -16, marginVertical: -8, flexGrow: 0 },
    circles: { flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
    circleItem: { alignItems: 'center', gap: 8, width: 72 },
    circle: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
    doneFill: { backgroundImage: `linear-gradient(180deg, ${colors.doneFill[0]}, ${colors.doneFill[1]})` },
    circleLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, color: colors.muted, textAlign: 'center' },
    rows: { gap: 10, marginTop: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 12, minHeight: 66 },
    emptyRow: { padding: 18, gap: 6 },
    emptyTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
    whitePill: {
      marginTop: 10,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 22,
      backgroundColor: colors.node,
      boxShadow: colors.material.control.shadow,
    },
    whitePillText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onNode },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `inset 0px 1px 0px ${alphaOf(colors.node, 0.6)}`,
    },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text },
    rowMeta: { marginTop: 2, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    rowDone: { fontFamily: fonts.body, color: colors.faint, textDecorationLine: 'line-through' },
    rowButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    tickRing: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
      backgroundColor: colors.material.inset.fill,
    },

    // Stone
    barEnd: { flexDirection: 'row', gap: 10 },
    stoneTop: { marginTop: 26, paddingRight: 40 },
    stoneGreet: { fontFamily: 'DMSans_300Light', fontSize: 32, lineHeight: 38, color: colors.text, letterSpacing: -0.2 },
    stoneDay: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    stoneTagline: { marginTop: 14, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.muted, maxWidth: 210 },
    stoneCard: { marginTop: 26, paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20 },
    stoneTitle: { fontFamily: 'DMSans_300Light', fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: -0.2, maxWidth: '76%' },
    stoneHeroMeta: { marginTop: 6, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, maxWidth: '76%' },
    stonePill: {
      marginTop: 20,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: alphaOf(colors.text, 0.55),
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: `inset 0px 1px 0px ${alphaOf(colors.text, 0.75)}, ${colors.litGlow}`,
    },
    stonePillText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.onPrimary },
    ghostPill: {
      marginTop: 20,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      backgroundColor: colors.material.inset.fill,
    },
    ghostPillText: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text },
    stonePanel: { marginTop: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 },
    stonePanelTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.text },
    tilesScroll: { marginHorizontal: -16, marginTop: 6, flexGrow: 0 },
    tiles: { flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, gap: 2 },
    tileSlot: { width: 64 },
    tileItem: { alignItems: 'center', gap: 8, minHeight: 44, borderRadius: radii.inset, paddingBottom: 2 },
    tile: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    tileWarm: { backgroundColor: colors.warmTile, borderWidth: 1, borderColor: alphaOf(colors.onWarmTile, 0.45) },
    tileLabel: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, color: colors.muted, textAlign: 'center' },
    stoneList: { marginTop: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
    stoneListHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 },
    stoneCount: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: 58, backgroundColor: colors.material.inset.border },
    stoneRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingVertical: 10, borderRadius: radii.inset },
    stoneTile: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    stoneRowTitle: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
    stoneRowMeta: { marginTop: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
    stoneRowDone: { color: colors.faint, textDecorationLine: 'line-through' },
    stoneMetaDone: { color: colors.faint },
    stoneRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.controlBorder,
    },
    ringEmpty: { width: 16, height: 16 },
    stoneNav: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  });
