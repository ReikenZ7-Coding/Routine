// The desktop shell: one world for the whole window (the wide art), the floating sidebar on the left, the top
// bar's pieces of glass, and the routed page in the content area. Popovers, the command palette and the side
// panel forms sit above; the keyboard shortcuts live here. The phone app never draws any of this.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname } from 'expo-router';
import { type ComponentRef, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { WideContext } from '../Art';
import { WorldFrame } from '../Glass';
import { EASE_OUT, FADE } from '../Motion';
import { dayPlan, dueNow, navCounts, needsYou, nextUp } from '../../lib/day';
import { currentLanguage } from '../../lib/language';
import type { Routine } from '../../lib/routines';
import { SOUNDS, useSounds } from '../../lib/sounds';
import { newId, useStore } from '../../lib/store';
import { THEME_OPTIONS, type Theme, useStyles, useTheme } from '../../theme';
import { type AddKind, type ShellApi, ShellContext, type ShellPanel } from './api';
import { Hover } from './Hover';
import { SHELL, useShellMetrics } from './layout';
import { MOD, NAV_ITEMS, type NavItem, longDate, pageOf, useNow } from './nav';
import { type Command, Palette } from './Palette';
import { Panels } from './Panels';
import { Popover } from './Popover';
import { Sidebar } from './Sidebar';
import { BellMenu, type Crumb, LookMenu, type Menu, NewMenu, TopBar } from './TopBar';

const KEY = 'routine.desktop.v1';
const SLIDE = { duration: 260, easing: EASE_OUT };
const DIM = { duration: 200, easing: EASE_OUT, ...FADE };

/** The desktop opens on Overview the first time it loads at the root; after that Today is "/" like on the phone. */
let landed = false;

export function DesktopShell({
  children,
  after,
}: {
  children: ReactNode;
  /** Drawn over everything (the player, the look's crossfade). */ after?: ReactNode;
}) {
  const m = useShellMetrics();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const store = useStore();
  const { routines, inbox, groceries, gym, language, settings, today, updateInbox, updateSettings, ready } = store;
  const sounds = useSounds();
  const now = useNow();
  const pathname = usePathname();
  const page = pageOf(pathname);

  // Sidebar: docked and remembered on a comfortable window; a rail that opens over the content on a compact one.
  const [docked, setDocked] = useState(true);
  const [overlay, setOverlay] = useState(false);
  const expanded = m.compact ? overlay : docked;
  const width = useSharedValue(expanded ? SHELL.sidebar : SHELL.rail);
  const rail = useSharedValue(expanded ? 0 : 1);
  const dim = useSharedValue(0);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as { sidebar?: string }) : null;
        if (saved?.sidebar === 'collapsed') setDocked(false);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    width.set(withTiming(expanded ? SHELL.sidebar : SHELL.rail, SLIDE));
    rail.set(withTiming(expanded ? 0 : 1, SLIDE));
    dim.set(withTiming(m.compact && overlay ? 1 : 0, DIM));
  }, [expanded, m.compact, overlay, width, rail, dim]);
  useEffect(() => setOverlay(false), [pathname, m.compact]);

  const toggleSidebar = useCallback(() => {
    if (m.compact) {
      setOverlay((o) => !o);
      return;
    }
    setDocked((d) => {
      AsyncStorage.setItem(KEY, JSON.stringify({ sidebar: d ? 'collapsed' : 'expanded' })).catch(() => {});
      return !d;
    });
  }, [m.compact]);

  // First load at the root goes to Overview, the desktop's home.
  useEffect(() => {
    if (landed) return;
    landed = true;
    if (pathname === '/') router.replace('/overview');
  }, [pathname]);

  const [menu, setMenu] = useState<Menu>(null);
  const [palette, setPalette] = useState(false);
  const [panel, setPanel] = useState<ShellPanel>(null);
  const [editing, setEditing] = useState<Routine | undefined>();
  const open = useCallback((p: ShellPanel, routine?: Routine) => {
    setMenu(null);
    setEditing(routine);
    setPanel(p);
  }, []);
  const api = useMemo<ShellApi>(
    () => ({ expanded, toggleSidebar, openPalette: () => setPalette(true), open }),
    [expanded, toggleSidebar, open],
  );

  const state = useMemo(() => ({ routines, inbox, groceries, gym, language }), [routines, inbox, groceries, gym, language]);
  const plan = useMemo(() => dayPlan(state, today, today), [state, today]);
  const counts = useMemo(() => navCounts(state, today), [state, today]);
  const needs = useMemo(() => needsYou(state, today, now), [state, today, now]);
  const due = useMemo(() => dueNow(state, today, now), [state, today, now]);
  const next = nextUp(plan, today, now);
  const studying = currentLanguage(language);

  const go = useCallback((href: NavItem['href']) => {
    setMenu(null);
    router.navigate(href);
  }, []);
  const add = useCallback(
    (k: AddKind) => {
      setMenu(null);
      if (k === 'word' && !studying) router.navigate('/language');
      else open(k);
    },
    [open, studying],
  );

  // Ctrl+K, Ctrl+N, Ctrl+B, Ctrl+1..9 and Ctrl+, from anywhere; R, T, G, W while the New menu is open; Esc
  // closes the compact sidebar's overlay.
  const keys = useRef({ add, go, toggleSidebar, open, menu, overlay, palette, panel });
  keys.current = { add, go, toggleSidebar, open, menu, overlay, palette, panel };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === 'k') {
          e.preventDefault();
          setMenu(null);
          setPalette(true);
        } else if (key === 'n') {
          e.preventDefault();
          setPalette(false);
          setMenu((v) => (v === 'new' ? null : 'new'));
        } else if (key === 'b') {
          e.preventDefault();
          k.toggleSidebar();
        } else if (key === ',') {
          e.preventDefault();
          k.open('settings');
        } else if (/^[1-9]$/.test(key) && NAV_ITEMS[Number(key) - 1]) {
          e.preventDefault();
          k.go(NAV_ITEMS[Number(key) - 1].href);
        }
        return;
      }
      if (k.menu === 'new' && !mod && !e.altKey) {
        const pick = ({ r: 'routine', t: 'todo', g: 'grocery', w: 'word' } as Record<string, AddKind>)[e.key.toLowerCase()];
        if (pick) {
          e.preventDefault();
          k.add(pick);
        }
      }
      if (e.key === 'Escape' && k.overlay && !k.menu && !k.palette && !k.panel) setOverlay(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const crumbs: Crumb[] = [{ label: 'Symphony OS', href: '/overview' }, { label: page?.label ?? 'Overview' }];
  if (page?.key === 'language' && studying) crumbs.push({ label: studying.name });
  if (page?.key === 'overview') crumbs[0] = { label: 'Symphony OS' };

  const commands = useMemo<Command[]>(() => {
    const goTo: Command[] = NAV_ITEMS.map((i, n) => ({
      id: `go-${i.key}`,
      group: 'Go to',
      icon: i.icon,
      title: i.label,
      hint: `${MOD} ${n + 1}`,
      words: i.key === 'overview' ? 'home' : undefined,
      run: () => go(i.href),
    }));
    goTo.push(
      { id: 'go-settings', group: 'Go to', icon: 'settings-outline', title: 'Settings', hint: `${MOD} ,`, run: () => open('settings') },
      { id: 'go-week', group: 'Go to', icon: 'stats-chart-outline', title: 'Your week', meta: 'The last 7 days', run: () => open('stats') },
    );
    const adds: Command[] = [
      { id: 'add-routine', group: 'Add', icon: 'repeat', title: 'Routine', meta: 'Something you do regularly', run: () => add('routine') },
      { id: 'add-todo', group: 'Add', icon: 'checkbox-outline', title: 'To-do for today', run: () => add('todo') },
      { id: 'add-grocery', group: 'Add', icon: 'basket-outline', title: 'Grocery item', run: () => add('grocery') },
      studying
        ? { id: 'add-word', group: 'Add', icon: 'language-outline', title: `${studying.name} word`, run: () => add('word') }
        : {
            id: 'add-word',
            group: 'Add',
            icon: 'language-outline',
            title: 'A language',
            meta: 'Pick one to learn',
            run: () => add('word'),
          },
    ];
    const looks: Command[] = THEME_OPTIONS.map((o) => ({
      id: `look-${o.name}`,
      group: 'Look',
      icon: 'color-palette-outline',
      title: `${o.label} look`,
      meta: o.description,
      checked: settings.theme === o.name,
      run: () => {
        updateSettings({ theme: o.name });
        (globalThis as { symphonyDesktop?: { setLook?: (n: string) => void } }).symphonyDesktop?.setLook?.(o.name);
      },
    }));
    const sound = sounds.current;
    const dos: Command[] = [
      {
        id: 'do-play',
        group: 'Do',
        icon: sounds.playing ? 'pause' : 'play',
        title: sounds.playing ? `Pause ${sound.name}` : `Play ${sound.name}`,
        meta: sound.subtitle,
        run: sounds.toggle,
      },
      ...SOUNDS.filter((s) => !(sound.kind === 'sound' && sound.id === s.id)).map<Command>((s) => ({
        id: `do-sound-${s.id}`,
        group: 'Do',
        icon: s.icon,
        title: `Play ${s.name}`,
        meta: s.subtitle,
        run: () => sounds.play(s.id),
      })),
      {
        id: 'do-timer',
        group: 'Do',
        icon: 'moon-outline',
        title: 'Sleep timer',
        meta: sounds.timer ? `${sounds.timer} min, press for the next step` : 'Off, press for 15 min',
        run: sounds.cycleTimer,
      },
      {
        id: 'do-focus',
        group: 'Do',
        icon: 'timer-outline',
        title: 'Focus timer',
        meta: studying ? `15 or 25 min, on ${studying.name}` : 'On the Language page',
        run: () => go('/language'),
      },
      {
        id: 'do-sidebar',
        group: 'Do',
        icon: expanded ? 'chevron-back' : 'chevron-forward',
        title: expanded ? 'Collapse the sidebar' : 'Expand the sidebar',
        hint: `${MOD} B`,
        run: toggleSidebar,
      },
      {
        id: 'do-backup',
        group: 'Do',
        icon: 'archive-outline',
        title: 'Make a backup',
        meta: 'Backup and restore',
        run: () => open('backup'),
      },
    ];
    return [...goTo, ...adds, ...looks, ...dos];
  }, [go, open, add, studying, settings.theme, updateSettings, sounds, expanded, toggleSidebar]);

  const things = useMemo<Command[]>(() => {
    const out: Command[] = [];
    for (const r of routines)
      out.push({ id: `r-${r.id}`, group: 'Your things', icon: 'repeat', title: r.name, meta: 'Routine', run: () => open('routine', r) });
    for (const t of inbox.filter((i) => !i.doneOn))
      out.push({
        id: `i-${t.id}`,
        group: 'Your things',
        icon: 'checkbox-outline',
        title: t.title,
        meta: 'To-do, in the inbox',
        run: () => go('/inbox'),
      });
    for (const g of groceries)
      out.push({
        id: `g-${g.id}`,
        group: 'Your things',
        icon: 'basket-outline',
        title: g.name,
        meta: 'Groceries',
        run: () => go('/groceries'),
      });
    for (const w of language.words.filter((x) => !studying || x.lang === studying.id))
      out.push({
        id: `w-${w.id}`,
        group: 'Your things',
        icon: 'language-outline',
        title: w.hanzi,
        meta: w.meaning,
        words: w.pinyin,
        run: () => go('/language'),
      });
    for (const t of store.music.tracks)
      out.push({
        id: `t-${t.id}`,
        group: 'Your things',
        icon: 'musical-note-outline',
        title: t.title,
        meta: 'Your music',
        run: () => sounds.playTrack(t.id),
      });
    for (const l of store.music.links)
      out.push({ id: `l-${l.id}`, group: 'Your things', icon: 'list-outline', title: l.name, meta: 'Playlist', run: () => go('/music') });
    return out;
  }, [routines, inbox, groceries, language.words, studying, store.music, open, go, sounds]);

  const toInbox = (text: string) => {
    updateInbox((items) => [{ id: newId(), title: text, createdAt: new Date().toISOString() }, ...items]);
    go('/inbox');
  };

  // Content: right of the docked sidebar (or of the rail on a compact window), under the top bar's row.
  const contentLeft = useAnimatedStyle(() => ({ left: m.inset + (m.compact ? SHELL.rail : width.get()) }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));
  const content = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    // The page fades out over 16 dp as it scrolls up under the top bar, so nothing passes through the breadcrumbs.
    const node = content.current as unknown as { style?: CSSStyleDeclaration } | null;
    if (Platform.OS !== 'web' || !node?.style) return;
    const mask = 'linear-gradient(180deg, transparent 0px, #000 16px)';
    node.style.setProperty('mask-image', mask);
    node.style.setProperty('-webkit-mask-image', mask);
  }, []);

  const [skip, setSkip] = useState(false);
  const skipToContent = () => {
    if (typeof document === 'undefined') return;
    const first = document.querySelector<HTMLElement>('#main [tabindex="0"]');
    first?.focus();
  };

  const menuTop = m.barTop + 48;
  const menuBox = { top: menuTop, right: m.pad };

  return (
    <WideContext.Provider value>
      <ShellContext.Provider value={api}>
        <View style={styles.root}>
          <WorldFrame>
            <Hover
              onPress={skipToContent}
              onFocusChange={setSkip}
              role="link"
              outerStyle={[styles.skip, { opacity: skip ? 1 : 0, pointerEvents: skip ? 'auto' : 'none' }]}
              style={styles.skipInner}
              radius={12}
              accessibilityLabel="Skip to content"
            >
              <Text style={styles.skipText}>Skip to content</Text>
            </Hover>

            {/* Tab order follows the spec: the skip link, the sidebar, the top bar, then the page; zIndex keeps the
                painting order (page, bar, dim, sidebar) whatever the order here. */}
            <View style={[styles.side, { top: m.inset, left: m.inset, bottom: m.inset }]}>
              <Sidebar
                width={width}
                rail={rail}
                expanded={expanded}
                current={page?.key}
                counts={counts}
                needs={needs}
                plan={plan}
                upNextLine={next?.line}
                name={settings.name}
                playing={sounds.playing}
                date={longDate(today)}
                onToggle={toggleSidebar}
                onGo={go}
                onSettings={() => open('settings')}
              />
            </View>

            <Animated.View style={[styles.bar, { top: m.barTop, right: m.pad }, contentLeft]}>
              <View style={[styles.barInner, { paddingLeft: m.pad }]}>
                <TopBar
                  crumbs={crumbs}
                  menu={menu}
                  onMenu={setMenu}
                  onSearch={() => setPalette(true)}
                  due={due.length}
                  compact={m.compact}
                />
              </View>
            </Animated.View>

            {m.compact ? (
              <Animated.View
                style={[StyleSheet.absoluteFill, styles.dim, { backgroundColor: colors.backdrop }, dimStyle]}
                pointerEvents={overlay ? 'auto' : 'none'}
              >
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setOverlay(false)} accessible={false} focusable={false} />
              </Animated.View>
            ) : null}

            <Animated.View ref={content} nativeID="main" role="main" style={[styles.content, { top: m.pageTop }, contentLeft]}>
              {ready ? children : null}
            </Animated.View>

            <Popover visible={menu === 'look'} onClose={() => setMenu(null)} label="Look" width={380} style={menuBox} role="menu">
              <LookMenu onDone={() => setMenu(null)} />
            </Popover>
            <Popover visible={menu === 'bell'} onClose={() => setMenu(null)} label="Reminders" width={360} style={menuBox} role="menu">
              <BellMenu due={due} onDone={() => setMenu(null)} />
            </Popover>
            <Popover visible={menu === 'new'} onClose={() => setMenu(null)} label="New" width={340} style={menuBox} role="menu">
              <NewMenu onAdd={add} />
            </Popover>
          </WorldFrame>
          <Palette visible={palette} onClose={() => setPalette(false)} commands={commands} things={things} onInbox={toInbox} />
          <Panels panel={panel} editing={editing} onOpen={(p) => open(p)} onClose={() => setPanel(null)} />
          {after}
        </View>
      </ShellContext.Provider>
    </WideContext.Provider>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: { position: 'absolute', right: 0, bottom: 0, zIndex: 1 },
    bar: { position: 'absolute', zIndex: 2 },
    barInner: { flex: 1 },
    dim: { zIndex: 3 },
    side: { position: 'absolute', zIndex: 4 },
    skip: { position: 'absolute', top: 12, left: 96, zIndex: 50 },
    skipInner: { height: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
    skipText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.onPrimary },
  });
