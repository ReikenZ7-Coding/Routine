// The desktop sidebar: one floating glass object in two widths, the labelled panel (264) and the icon rail (72).
// Structure from a labelled floating sidebar, contents from a rail-and-panel dashboard: the brand row, the pages in
// groups with real counts, "Needs you", today's progress and the person's card (which opens Settings). The
// current page wears the tab bar's glass drop, which flows between items on the same two springs. Icons sit at
// the same place in both widths, so docking and collapsing only changes the width and fades the words.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentRef, Fragment, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  type SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { DayPlan, NavCounts, Need } from '../../lib/day';
import { THEME_OPTIONS, type Theme, useStyles, useTheme } from '../../theme';
import { Glass } from '../Glass';
import { EASE_OUT, FADE, useReduceMotion } from '../Motion';
import { Hover } from './Hover';
import { moveFocus } from './Popover';
import { NAV, type NavItem, type PageKey } from './nav';
import { SHELL } from './layout';

const LEAD = { stiffness: 320, damping: 26, mass: 0.8 };
const TRAIL = { stiffness: 150, damping: 20, mass: 1 };
const BLINK = { duration: 120, easing: EASE_OUT, ...FADE };
const PAD = 12;
const ITEM = 40;
const GAP = 4;
const GROUP = 34;
/** The nav starts this far under the brand row; in the rail the expand button sits in between. */
const NAV_TOP = 20;
const NAV_TOP_RAIL = 64;
const NEED_ROW = 40;

export interface SidebarProps {
  /** The sidebar's width, animated by the shell. */
  width: SharedValue<number>;
  /** 0 labelled, 1 rail; animated by the shell with the width. */
  rail: SharedValue<number>;
  expanded: boolean;
  current?: PageKey;
  counts: NavCounts;
  needs: Need[];
  plan: DayPlan;
  upNextLine?: string;
  name: string;
  playing: boolean;
  date: string;
  onToggle: () => void;
  onGo: (href: NavItem['href']) => void;
  onSettings: () => void;
}

export function Sidebar(p: SidebarProps) {
  const { colors, name: look } = useTheme();
  const styles = useStyles(makeStyles);
  const reduced = useReduceMotion();
  const navRef = useRef<ComponentRef<typeof View>>(null);
  const [rows, setRows] = useState<Partial<Record<PageKey, { y: number; h: number }>>>({});
  const [navY, setNavY] = useState(0);
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const top = useSharedValue(0);
  const bottom = useSharedValue(0);
  const shown = useSharedValue(1);
  const flash = useSharedValue(0);
  const placed = useRef(false);
  const last = useRef<number>(-1);

  const labelled = useAnimatedStyle(() => ({ opacity: interpolate(p.rail.get(), [0, 0.45], [1, 0], 'clamp') }));
  const railOnly = useAnimatedStyle(() => ({ opacity: interpolate(p.rail.get(), [0.55, 1], [0, 1], 'clamp') }));
  const widthStyle = useAnimatedStyle(() => ({ width: p.width.get() }));
  const navTop = useAnimatedStyle(() => ({ marginTop: NAV_TOP + (NAV_TOP_RAIL - NAV_TOP) * p.rail.get() }));

  const order = NAV.flatMap((g) => g.items.map((i) => i.key));
  const at = p.current ? order.indexOf(p.current) : -1;
  const row = p.current ? rows[p.current] : undefined;
  useEffect(() => {
    if (!row) {
      shown.set(withTiming(0, BLINK));
      return;
    }
    const t = row.y;
    const b = row.y + row.h;
    if (!placed.current || last.current < 0) {
      placed.current = true;
      top.set(t);
      bottom.set(b);
      shown.set(withTiming(1, BLINK));
    } else if (reduced) {
      shown.set(
        withTiming(0, BLINK, (done) => {
          'worklet';
          if (!done) return;
          top.set(t);
          bottom.set(b);
          shown.set(withTiming(1, BLINK));
        }),
      );
    } else if (at !== last.current) {
      const down = at > last.current;
      const settle = (done?: boolean) => {
        'worklet';
        if (done)
          flash.set(
            withSequence(
              withTiming(0.6, { duration: 100, easing: EASE_OUT, ...FADE }),
              withTiming(0, { duration: 220, easing: EASE_OUT, ...FADE }),
            ),
          );
      };
      bottom.set(withSpring(b, down ? LEAD : TRAIL, down ? undefined : settle));
      top.set(withSpring(t, down ? TRAIL : LEAD, down ? settle : undefined));
    } else {
      top.set(t);
      bottom.set(b);
    }
    last.current = at;
  }, [at, row?.y, row?.h, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const drop = useAnimatedStyle(() => ({ top: top.get(), height: bottom.get() - top.get(), opacity: shown.get() }));
  const glint = useAnimatedStyle(() => ({ top: top.get(), height: bottom.get() - top.get(), opacity: flash.get() }));

  // Up and Down move between the pages, as in any list of tabs.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = navRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && moveFocus(node as never, e.key)) e.preventDefault();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, []);

  const showTip = (label: string, key: PageKey, now: boolean) => {
    if (!p.expanded || tip) {
      const r = rows[key];
      if (!r) return;
      if (tipTimer.current) clearTimeout(tipTimer.current);
      const go = () => setTip({ label, y: navY + r.y + r.h / 2 });
      if (now) go();
      else tipTimer.current = setTimeout(go, 400);
    }
  };
  const hideTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip(null), 100);
  };

  const lookLabel = THEME_OPTIONS.find((o) => o.name === look)?.label ?? 'Lavender';
  const initial = (p.name.trim()[0] ?? '').toUpperCase();

  return (
    <Animated.View style={[styles.wrap, widthStyle]}>
      <Glass tier="chrome" radius={SHELL.radius} tint={colors.material.chromeTint} style={StyleSheet.absoluteFill}>
        <View style={styles.inner}>
          {/* Brand row: the mark, the name and today's date, and the collapse button. */}
          <View style={styles.brand}>
            <View style={styles.mark} accessible={false}>
              <Text style={styles.markText}>S</Text>
            </View>
            <Animated.View style={[styles.brandText, labelled]} pointerEvents={p.expanded ? 'auto' : 'none'}>
              <Text style={styles.brandName} numberOfLines={1}>
                Symphony OS
              </Text>
              <Text style={styles.brandDate} numberOfLines={1}>
                {p.date}
              </Text>
            </Animated.View>
            <Animated.View style={labelled} pointerEvents={p.expanded ? 'auto' : 'none'}>
              <ToggleButton expanded onPress={p.onToggle} hidden={!p.expanded} />
            </Animated.View>
          </View>
          <Animated.View style={[styles.railToggle, railOnly]} pointerEvents={p.expanded ? 'none' : 'auto'}>
            <ToggleButton expanded={false} onPress={p.onToggle} hidden={p.expanded} />
          </Animated.View>

          <Animated.View style={navTop} onLayout={(e: LayoutChangeEvent) => setNavY(e.nativeEvent.layout.y)}>
            <View ref={navRef} role="navigation" aria-label="Sections">
              <Animated.View pointerEvents="none" style={[styles.drop, drop]} />
              <Animated.View pointerEvents="none" style={[styles.drop, styles.glint, glint]} />
              {NAV.map((group, gi) => (
                <Fragment key={gi}>
                  {group.label ? (
                    <View style={styles.group}>
                      <Animated.Text style={[styles.groupLabel, labelled]} numberOfLines={1}>
                        {group.label}
                      </Animated.Text>
                      <Animated.View style={[styles.hairline, railOnly]} />
                    </View>
                  ) : null}
                  {group.items.map((item) => {
                    const n = item.count ? p.counts[item.count.of] : 0;
                    const dot = (item.key === 'overview' && p.needs.length > 0) || (item.key === 'music' && p.playing);
                    const label = `${item.label}${n > 0 && item.count ? `, ${n} ${item.count.says}` : ''}${
                      item.key === 'music' && p.playing ? ', playing' : ''
                    }`;
                    const on = item.key === p.current;
                    return (
                      <View
                        key={item.key}
                        style={styles.itemSlot}
                        onLayout={(e) => {
                          const { y } = e.nativeEvent.layout;
                          setRows((r) => {
                            const prev = r[item.key];
                            return prev && prev.y === y && prev.h === ITEM ? r : { ...r, [item.key]: { y, h: ITEM } };
                          });
                        }}
                      >
                        <Hover
                          onPress={() => p.onGo(item.href)}
                          style={styles.item}
                          radius={ITEM / 2}
                          role="link"
                          accessibilityLabel={label}
                          aria={{ 'aria-current': on ? 'page' : undefined }}
                          onHoverChange={(h) => (h ? showTip(label, item.key, false) : hideTip())}
                          onFocusChange={(f) => (f ? showTip(label, item.key, true) : hideTip())}
                        >
                          <Ionicons
                            name={(on ? item.iconActive : item.icon) as 'home'}
                            size={20}
                            color={on ? colors.material.drop.ink : colors.text}
                            style={styles.itemIcon}
                          />
                          <Animated.View style={[styles.itemLabelBox, labelled]}>
                            <Text style={[styles.itemLabel, on && { color: colors.material.drop.ink }]} numberOfLines={1}>
                              {item.label}
                            </Text>
                            {item.key === 'music' && p.playing ? <View style={styles.playDot} /> : null}
                          </Animated.View>
                          {n > 0 ? (
                            <Animated.View style={[styles.count, labelled]}>
                              <Text style={styles.countText}>{n}</Text>
                            </Animated.View>
                          ) : null}
                          {n > 0 || dot ? <Animated.View style={[styles.railDot, railOnly]} /> : null}
                        </Hover>
                      </View>
                    );
                  })}
                </Fragment>
              ))}
            </View>
          </Animated.View>

          {/* The free space: Needs you, as many rows as fit (none on Overview, which shows the full list). */}
          <Animated.View style={[styles.flex, labelled]} pointerEvents={p.expanded ? 'box-none' : 'none'}>
            {p.current !== 'overview' ? <NeedsBlock needs={p.needs} onGo={p.onGo} hidden={!p.expanded} /> : null}
          </Animated.View>

          {/* Laid out at the panel's width in both widths, so its lines never rewrap in the rail and push the user
              button out of the glass; the rail clips it like the other labelled content. */}
          <Animated.View style={[styles.panelWidth, labelled]} pointerEvents={p.expanded ? 'auto' : 'none'}>
            <Progress plan={p.plan} line={p.upNextLine} onPress={() => p.onGo('/')} hidden={!p.expanded} />
          </Animated.View>

          <Hover onPress={p.onSettings} style={styles.user} radius={16} accessibilityLabel={`Settings${p.name ? `, ${p.name}` : ''}`}>
            <View style={styles.userDisc}>
              {initial ? <Text style={styles.userInitial}>{initial}</Text> : <Ionicons name="person" size={18} color={colors.onNode} />}
            </View>
            <Animated.View style={[styles.flex, labelled]}>
              <Text style={styles.userName} numberOfLines={1}>
                {p.name || 'Your settings'}
              </Text>
              <Text style={styles.userLook} numberOfLines={1}>
                {lookLabel} look
              </Text>
            </Animated.View>
            <Animated.View style={labelled}>
              <Ionicons name="settings-outline" size={18} color={colors.muted} />
            </Animated.View>
          </Hover>
        </View>
      </Glass>
      {tip && !p.expanded ? <Tooltip label={tip.label} y={tip.y} /> : null}
    </Animated.View>
  );
}

function ToggleButton({ expanded, onPress, hidden }: { expanded: boolean; onPress: () => void; hidden: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View aria-hidden={hidden}>
      <Glass
        tier="control"
        radius={18}
        onPress={hidden ? undefined : onPress}
        style={styles.toggle}
        accessibilityLabel={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        accessibilityState={{ expanded }}
      >
        <Ionicons name={expanded ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.text} />
      </Glass>
    </View>
  );
}

function NeedsBlock({ needs, onGo, hidden }: { needs: Need[]; onGo: (href: NavItem['href']) => void; hidden: boolean }) {
  const { kinds } = useTheme();
  const styles = useStyles(makeStyles);
  const [room, setRoom] = useState(0);
  const go = (n: Need) =>
    onGo(n.to === 'today' ? '/' : n.to === 'inbox' ? '/inbox' : n.to === 'language' ? '/language' : n.to === 'gym' ? '/gym' : '/groceries');
  // Rows that fit under the label; one slot goes to the link to Overview when the list is longer.
  const fit = Math.max(0, Math.floor((room - 30) / NEED_ROW));
  const shown = needs.length > fit ? Math.max(0, Math.min(3, fit) - 1) : Math.min(3, needs.length);
  const rest = needs.length - shown;
  return (
    <View style={styles.needs} onLayout={(e) => setRoom(e.nativeEvent.layout.height)} role="complementary" aria-label="Needs you">
      {room >= 30 + NEED_ROW || needs.length === 0 ? (
        <>
          <Text style={styles.needsLabel}>Needs you</Text>
          {needs.length === 0 ? (
            <Text style={styles.needsEmpty}>Nothing needs you right now.</Text>
          ) : (
            <>
              {needs.slice(0, shown).map((n) => (
                <Hover
                  key={n.key}
                  onPress={() => go(n)}
                  focusable={!hidden}
                  style={styles.needRow}
                  radius={12}
                  accessibilityLabel={`${n.title}, ${n.meta}`}
                >
                  <Ionicons name={n.icon as 'time'} size={16} color={kinds[n.kind].text} />
                  <Text style={styles.needTitle} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text style={styles.needFact} numberOfLines={1}>
                    {n.fact}
                  </Text>
                </Hover>
              ))}
              {rest > 0 ? (
                <Hover
                  onPress={() => onGo('/overview')}
                  focusable={!hidden}
                  style={styles.needRow}
                  radius={12}
                  role="link"
                  accessibilityLabel={`${rest} more on Overview`}
                >
                  <Ionicons name="arrow-forward" size={16} color={kinds.routines.text} />
                  <Text style={styles.needMore} numberOfLines={1}>
                    {shown === 0 ? `${needs.length} things need you` : `${rest} more on Overview`}
                  </Text>
                </Hover>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </View>
  );
}

function Progress({ plan, line, onPress, hidden }: { plan: DayPlan; line?: string; onPress: () => void; hidden: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const all = plan.total > 0 && plan.done === plan.total;
  const sub = plan.total === 0 ? 'A clear day' : all ? 'Trail complete' : (line ?? `${plan.total - plan.done} still to do`);
  const segments = plan.total > 0 && plan.total <= 16;
  return (
    <Hover
      onPress={onPress}
      focusable={!hidden}
      style={styles.progress}
      radius={16}
      accessibilityLabel={`Today, ${plan.done} of ${plan.total} done. ${sub}. Open today`}
    >
      <View style={styles.progressHead}>
        <Text style={styles.progressTitle}>Today</Text>
        <Text style={styles.progressCount}>
          {plan.done} of {plan.total}
        </Text>
      </View>
      <View style={styles.segments}>
        {segments ? (
          Array.from({ length: plan.total }, (_, i) => (
            <View key={i} style={[styles.segment, { backgroundColor: i < plan.done ? colors.accent : colors.track }]} />
          ))
        ) : (
          <View style={[styles.segment, { backgroundColor: colors.track }]}>
            <View style={[styles.segmentFill, { width: `${plan.total ? (plan.done / plan.total) * 100 : 0}%` }]} />
          </View>
        )}
      </View>
      <Text style={styles.progressLine} numberOfLines={1}>
        {sub}
      </Text>
    </Hover>
  );
}

function Tooltip({ label, y }: { label: string; y: number }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(withTiming(1, { duration: 120, easing: EASE_OUT, ...FADE }));
  }, [v, label, y]);
  const anim = useAnimatedStyle(() => ({ opacity: v.get() }));
  return (
    <Animated.View pointerEvents="none" style={[styles.tip, { top: y - 18 }, anim]} aria-hidden>
      <Glass tier="sheet" topOnly={false} radius={12} style={[styles.tipGlass, { boxShadow: colors.material.shadowFloat }]}>
        <Text style={styles.tipText} numberOfLines={1}>
          {label}
        </Text>
      </Glass>
    </Animated.View>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minHeight: 0 },
    wrap: { position: 'absolute', top: 0, bottom: 0, left: 0 },
    inner: { flex: 1, padding: PAD, overflow: 'hidden' },
    panelWidth: { width: SHELL.sidebar - 2 * PAD },
    brand: { flexDirection: 'row', alignItems: 'center', height: 40, gap: 10, paddingLeft: 4 },
    mark: {
      width: 40,
      height: 40,
      borderRadius: radii.inset,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    markText: { fontFamily: fonts.display, fontSize: 20, color: colors.onPrimary, marginTop: -1 },
    brandText: { flex: 1, minWidth: 0 },
    brandName: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 20, color: colors.text },
    brandDate: { ...type.small, color: colors.muted },
    toggle: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    railToggle: { position: 'absolute', top: PAD + 40 + 8, left: PAD + 6 },
    drop: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderRadius: ITEM / 2,
      backgroundImage: `linear-gradient(180deg, ${(colors.material.drop.side ?? colors.material.drop.fill).join(', ')})`,
      borderWidth: 1,
      borderColor: colors.material.drop.rimSide,
      borderTopColor: colors.material.drop.rim,
      boxShadow: colors.material.drop.shadow,
    },
    glint: { backgroundImage: undefined, backgroundColor: 'transparent', borderColor: colors.material.pressRim, boxShadow: undefined },
    group: { height: GROUP, justifyContent: 'flex-end', paddingBottom: GAP },
    groupLabel: { ...type.label, fontSize: 13, paddingLeft: 14, position: 'absolute', left: 0, right: 0, bottom: GAP + 2 },
    hairline: { position: 'absolute', left: 12, width: 24, bottom: 14, height: 1, backgroundColor: colors.border },
    itemSlot: { height: ITEM + GAP, paddingBottom: GAP },
    item: { height: ITEM, borderRadius: ITEM / 2, flexDirection: 'row', alignItems: 'center' },
    itemIcon: { marginLeft: 14, width: 20 },
    itemLabelBox: { position: 'absolute', left: 48, right: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
    itemLabel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.text, flexShrink: 1 },
    playDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
    count: {
      position: 'absolute',
      right: 8,
      minWidth: 28,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      ...insetBox,
    },
    countText: { ...type.badge, color: colors.text, fontVariant: ['tabular-nums'] },
    railDot: {
      position: 'absolute',
      left: 30,
      top: 8,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
    needs: { flex: 1, minHeight: 0, justifyContent: 'flex-end', paddingBottom: 12, overflow: 'hidden' },
    needsLabel: { ...type.label, fontSize: 13, paddingLeft: 14, marginBottom: 6 },
    needsEmpty: { ...type.small, paddingLeft: 14, paddingRight: 8 },
    needRow: { height: NEED_ROW, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 10 },
    needTitle: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text },
    needFact: { ...type.small, fontVariant: ['tabular-nums'] },
    needMore: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    progress: { padding: 12, borderRadius: 16, marginBottom: 8, ...insetBox },
    progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    progressTitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    progressCount: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
    segments: { flexDirection: 'row', gap: 3, marginTop: 8, marginBottom: 8, height: 6 },
    segment: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    segmentFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent, borderRadius: 3 },
    progressLine: { ...type.small },
    user: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: 6,
      paddingRight: 12,
      borderRadius: 16,
      ...insetBox,
    },
    userDisc: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.node, alignItems: 'center', justifyContent: 'center' },
    userInitial: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.onNode },
    userName: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 20, color: colors.text },
    userLook: { ...type.small },
    tip: { position: 'absolute', left: SHELL.rail + 8, zIndex: 30 },
    tipGlass: { paddingHorizontal: 12, height: 36, justifyContent: 'center' },
    tipText: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  });
};
