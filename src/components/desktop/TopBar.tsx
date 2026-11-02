// The desktop top bar: no bar of its own, just pieces of control glass on the world. Breadcrumbs on the left; on
// the right the search pill (it opens the command palette, Ctrl+K), the look picker, the reminders bell and the
// screen's one primary action, "New". The look, bell and New menus open as popovers under their buttons.
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type Role, StyleSheet, Text, View } from 'react-native';
import type { DueItem } from '../../lib/day';
import { currentLanguage } from '../../lib/language';
import { tapRoutine } from '../../lib/routines';
import { useStore } from '../../lib/store';
import { THEME_OPTIONS, type Theme, type ThemeName, useStyles, useTheme } from '../../theme';
import { Glass } from '../Glass';
import { SelectFade } from '../Motion';
import { Swatch } from '../SettingsSheet';
import type { AddKind } from './api';
import { Hover } from './Hover';
import { type Href, IN_APP, MOD } from './nav';
import { primaryHover } from './layout';

export type Menu = 'look' | 'bell' | 'new' | null;

export interface Crumb {
  label: string;
  href?: Href;
}

export function TopBar({
  crumbs,
  menu,
  onMenu,
  onSearch,
  due,
  compact,
}: {
  crumbs: Crumb[];
  menu: Menu;
  onMenu: (m: Menu) => void;
  onSearch: () => void;
  due: number;
  compact: boolean;
}) {
  const { colors, name } = useTheme();
  const styles = useStyles(makeStyles);
  const look = THEME_OPTIONS.find((o) => o.name === name)?.label ?? 'Lavender';
  const toggle = (m: Menu) => onMenu(menu === m ? null : m);
  return (
    <View style={styles.bar} role="banner">
      <View style={styles.crumbs} role="navigation" aria-label="Breadcrumbs">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <View key={`${c.label}-${i}`} style={styles.crumbRow}>
              {i > 0 ? <Ionicons name="chevron-forward" size={12} color={colors.faint} /> : null}
              {last || !c.href ? (
                <Text style={last ? styles.crumbLast : styles.crumb} numberOfLines={1} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </Text>
              ) : (
                <Hover
                  onPress={() => router.navigate(c.href!)}
                  style={styles.crumbLink}
                  radius={8}
                  role="link"
                  accessibilityLabel={c.label}
                >
                  <Text style={styles.crumb} numberOfLines={1}>
                    {c.label}
                  </Text>
                </Hover>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.right}>
        <Glass
          tier="control"
          radius={20}
          onPress={onSearch}
          style={[styles.search, { width: compact ? 300 : 360 }]}
          accessibilityLabel={`Search or jump to, ${MOD}+K`}
          accessibilityHint="Opens the command palette"
        >
          <Ionicons name="search" size={18} color={colors.muted} />
          <Text style={styles.searchText} numberOfLines={1}>
            Search or jump to…
          </Text>
          <View style={styles.kbd}>
            <Text style={styles.kbdText}>{MOD} K</Text>
          </View>
        </Glass>
        <Glass
          tier="control"
          radius={20}
          onPress={() => toggle('look')}
          style={styles.round}
          accessibilityLabel={`Change look, now ${look}`}
          accessibilityState={{ expanded: menu === 'look' }}
          aria={{ 'aria-haspopup': 'menu' }}
        >
          <Ionicons name="color-palette-outline" size={20} color={colors.text} />
        </Glass>
        <Glass
          tier="control"
          radius={20}
          onPress={() => toggle('bell')}
          style={styles.round}
          accessibilityLabel={due > 0 ? `Reminders, ${due} due now` : 'Reminders, nothing due'}
          accessibilityState={{ expanded: menu === 'bell' }}
          aria={{ 'aria-haspopup': 'menu' }}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {due > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{due}</Text>
            </View>
          ) : null}
        </Glass>
        <Hover
          onPress={() => toggle('new')}
          squeeze
          lightFill={primaryHover(colors.onPrimary)}
          style={styles.newBtn}
          accessibilityLabel={`New: a routine, to-do, grocery item or word${IN_APP ? `, ${MOD}+N` : ''}`}
          accessibilityState={{ expanded: menu === 'new' }}
          aria={{ 'aria-haspopup': 'menu' }}
        >
          <Ionicons name="add" size={20} color={colors.onPrimary} />
          <Text style={styles.newText}>New</Text>
        </Hover>
      </View>
    </View>
  );
}

/** The four looks as their Settings swatches, two by two; choosing one runs the look's crossfade. */
export function LookMenu({ onDone }: { onDone: () => void }) {
  const { colors, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const { settings, updateSettings } = useStore();
  const choose = (look: ThemeName) => {
    updateSettings({ theme: look });
    // The Windows app's title bar follows the look at once.
    (globalThis as { symphonyDesktop?: { setLook?: (n: string) => void } }).symphonyDesktop?.setLook?.(look);
    onDone();
  };
  return (
    <View>
      <Text style={styles.menuLabel}>Look</Text>
      <View style={styles.looks}>
        {THEME_OPTIONS.map((o) => {
          const on = settings.theme === o.name;
          return (
            <Hover
              key={o.name}
              onPress={() => choose(o.name)}
              outerStyle={styles.lookSlot}
              style={styles.look}
              radius={radii.inset}
              role={'menuitemradio' as Role}
              accessibilityLabel={`${o.label} look. ${o.description}`}
              aria={{ 'aria-checked': on }}
            >
              <SelectFade on={on} radius={radii.inset} bleed={1} style={{ borderWidth: 2, borderColor: colors.litRim }} />
              <Swatch look={o.name} />
              <View style={styles.lookText}>
                <Text style={styles.lookName}>{o.label}</Text>
                {on ? <Ionicons name="checkmark" size={16} color={colors.text} /> : null}
              </View>
              <Text style={styles.lookDesc} numberOfLines={2}>
                {o.description}
              </Text>
            </Hover>
          );
        })}
      </View>
    </View>
  );
}

/** What has come up: reminders whose time passed and timed steps still open. Ticking one off here is ticking it on Today. */
export function BellMenu({ due, onDone }: { due: DueItem[]; onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { routines, updateRoutines, today } = useStore();
  return (
    <View>
      <Text style={styles.menuLabel}>Reminders</Text>
      {due.length === 0 ? (
        <Text style={styles.menuEmpty}>Nothing is due right now. Reminders you set on a routine show here when they come up.</Text>
      ) : (
        due.map((d) => {
          const r = routines.find((x) => x.id === d.routine);
          const counter = !!r?.target && r.target > 1;
          return (
            <Hover
              key={d.key}
              onPress={() => {
                if (!r) return;
                if (counter) {
                  onDone();
                  router.navigate('/');
                } else updateRoutines((rs) => rs.map((x) => (x.id === r.id ? tapRoutine(x, today) : x)));
              }}
              style={styles.menuRow}
              radius={12}
              role="menuitem"
              accessibilityLabel={counter ? `${d.title}, ${d.line}. Open today` : `Tick off ${d.title}, ${d.line}`}
            >
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {d.line}
                </Text>
              </View>
              {counter ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : <View style={styles.tick} />}
            </Hover>
          );
        })
      )}
      <Text style={styles.menuFoot}>On this computer, reminders show here while Symphony OS is open.</Text>
    </View>
  );
}

/** The Add sheet's four choices; R, T, G and W pick one while the menu is open. */
export function NewMenu({ onAdd }: { onAdd: (k: AddKind) => void }) {
  const { kinds, colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { language } = useStore();
  const studying = currentLanguage(language);
  const rows: [AddKind, string, string, string, string, string][] = [
    ['routine', 'repeat', 'Routine', 'Repeats on a schedule', kinds.routines.text, 'R'],
    ['todo', 'checkbox', 'To-do', 'A one-off task for today', kinds.inbox.text, 'T'],
    ['grocery', 'basket', 'Grocery item', 'Goes on your shopping list', kinds.groceries.text, 'G'],
    studying
      ? ['word', 'language', `${studying.name} word`, 'A new flashcard to practise', kinds.chinese.text, 'W']
      : ['word', 'language', 'A language', 'Pick one to learn', kinds.chinese.text, 'W'],
  ];
  return (
    <View>
      {rows.map(([key, icon, title, sub, ink, letter]) => (
        <Hover
          key={key}
          onPress={() => onAdd(key)}
          style={styles.menuRow}
          radius={12}
          role="menuitem"
          accessibilityLabel={`${title}. ${sub}`}
          aria={{ 'aria-keyshortcuts': letter }}
        >
          <View style={styles.pebble}>
            <Ionicons name={icon as 'add'} size={20} color={ink} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {sub}
            </Text>
          </View>
          <View style={styles.kbd}>
            <Text style={[styles.kbdText, { color: colors.muted }]}>{letter}</Text>
          </View>
        </Hover>
      ))}
    </View>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    bar: { flexDirection: 'row', alignItems: 'center', height: 40, gap: 16 },
    crumbs: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
    crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
    crumbLink: { paddingHorizontal: 6, paddingVertical: 4, marginHorizontal: -6 },
    crumb: { ...type.small, color: colors.onSlabMuted },
    crumbLast: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.text },
    right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    search: { height: 40, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6 },
    searchText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.muted },
    kbd: { height: 26, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center', ...insetBox },
    kbdText: { ...type.label, fontSize: 13, lineHeight: 16, color: colors.text },
    round: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: 2,
      right: 0,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      backgroundColor: colors.node,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 14, color: colors.onNode, fontVariant: ['tabular-nums'] },
    newBtn: {
      height: 40,
      borderRadius: 20,
      paddingLeft: 14,
      paddingRight: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.actionGlow}`,
    },
    newText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
    menuLabel: { ...type.label, paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
    menuEmpty: { ...type.small, paddingHorizontal: 10, paddingBottom: 12 },
    menuFoot: {
      ...type.small,
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 6,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 4,
    },
    menuRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 8 },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowMeta: { ...type.small },
    tick: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.controlBorder },
    pebble: { width: 40, height: 40, borderRadius: radii.inset, alignItems: 'center', justifyContent: 'center', ...insetBox },
    looks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    lookSlot: { width: '48.5%' },
    look: { padding: 6, borderRadius: radii.inset, gap: 6 },
    lookText: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    lookName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
    lookDesc: { ...type.small, paddingHorizontal: 4, paddingBottom: 4 },
  });
};
