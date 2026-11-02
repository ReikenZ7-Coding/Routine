import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Segmented } from './Segmented';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { FieldError } from './Field';
import { Dim, FadeSwap, rise, Press, SelectFade } from './Motion';
import { MusicForms, type MusicForm, MusicHeading, MusicLibrary } from './MusicLibrary';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clock } from '../lib/music';
import { type NowItem, SOUNDS, useSounds } from '../lib/sounds';
import { SceneArt } from './Art';
import { Glass, GlassScroll, WorldFrame } from './Glass';
import { MINI_HEIGHT, useBar } from './glass/chrome';
import { WorldFade } from './glass/WorldFade';
import { alphaOf } from './glass/colour';
import { type Theme, useStyles, useTheme } from '../theme';

/** Art for a sound: the look's own scene for it (rain, waves, focus), cropped to a rounded tile. One of your
 *  songs shows the look's calm scene under a frosted note. */
export function SoundArt({ size, id, radius, track }: { icon?: string; size: number; id?: string; radius?: number; track?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.22, overflow: 'hidden' }}>
      <SceneArt width={size} height={size} variant={track ? 'calm' : id} />
      {track ? <NoteMark size={size} /> : null}
    </View>
  );
}

/** The frosted note laid over a song's scene, scaled to the art. */
function NoteMark({ size }: { size: number }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const disc = Math.round(size * 0.42);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.noteWrap]}>
      <View style={[styles.noteDisc, { width: disc, height: disc, borderRadius: disc / 2 }]}>
        <Ionicons name="musical-notes" size={Math.round(disc * 0.48)} color={colors.text} />
      </View>
    </View>
  );
}

const isTrack = (c: NowItem) => c.kind === 'track';

/** Small player above the tab bar once a sound has been started. */
export function MiniPlayer({ bottom }: { bottom: number }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();
  if (!s.started) return null;
  return (
    <Animated.View entering={MINI_IN} style={[styles.miniSpot, { bottom }]}>
      <Glass
        tier="chrome"
        radius={24}
        tint={colors.material.chromeTint}
        style={styles.mini}
        onPress={() => s.setSheetOpen(true)}
        accessibilityLabel={`Open the player, ${s.current.name}`}
      >
        <SoundArt id={s.current.id} track={isTrack(s.current)} size={38} />
        <View style={styles.flex}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {s.current.name}
          </Text>
          <Text style={styles.miniSub} numberOfLines={1}>
            {s.playing ? 'Playing' : 'Paused'} · {isTrack(s.current) ? 'Your music' : 'Focus sounds'}
          </Text>
        </View>
        <Press
          onPress={s.toggle}
          style={styles.miniButton}
          overlay={colors.material.pressFill}
          haptic
          accessibilityLabel={s.playing ? 'Pause' : 'Play'}
        >
          <FadeSwap
            on={s.playing}
            off={<Ionicons name="play" size={18} color={colors.onPrimary} style={styles.miniNudge} />}
            onContent={<Ionicons name="pause" size={18} color={colors.onPrimary} />}
          />
        </Press>
      </Glass>
    </Animated.View>
  );
}

const MINI_IN = rise();

/** The player, the same in every look: full screen in the look's own world. Your music and playlist links sit
 *  under the focus sounds; their forms open over it. */
export function NowPlaying() {
  const s = useSounds();
  const [form, setForm] = useState<MusicForm>(null);
  return (
    <>
      <Modal
        visible={s.sheetOpen}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => s.setSheetOpen(false)}
      >
        <Player onForm={setForm} />
      </Modal>
      <MusicForms form={form} onClose={() => setForm(null)} />
    </>
  );
}

type Sounds = ReturnType<typeof useSounds>;

/** The line over the player: what kind of thing is playing. */
function topLine(s: Sounds): string {
  if (!isTrack(s.current)) return 'Focus sounds · loops until you stop';
  return s.queuePlace ? `Your music · ${s.queuePlace.at} of ${s.queuePlace.of}` : 'Your music';
}

/** The line under the title: a sound's description, or what plays next. */
function subLine(s: Sounds): string {
  if (!isTrack(s.current)) return s.current.subtitle;
  if (s.upNext) return `Next: ${s.upNext}`;
  return s.queuePlace && s.queuePlace.of > 1 ? 'Last song. Turn on repeat to keep going' : 'Plays to the end';
}

function shuffleProps(s: Sounds): { label: string; onPress: () => void; active?: boolean; toggle?: boolean } {
  if (!isTrack(s.current)) return { label: 'Shuffle to another sound', onPress: s.shuffle };
  return { label: 'Shuffle', onPress: s.shuffle, active: s.shuffleOn, toggle: true };
}

/**
 * Repeat for songs. A focus sound always loops, so its slot shows a quiet loop mark instead (not a button), and
 * the row keeps five controls either way; the two crossfade when you switch between a sound and a song.
 */
function RepeatSlot() {
  const s = useSounds();
  const { colors } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const track = isTrack(s.current);
  return (
    <View>
      <View
        pointerEvents={track ? 'auto' : 'none'}
        importantForAccessibility={track ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!track}
      >
        <Dim on={!track} to={0}>
          <Control icon="repeat" label="Repeat all" onPress={s.toggleRepeat} active={s.repeatOn} toggle small />
        </Dim>
      </View>
      <Dim on={track} to={0} style={StyleSheet.absoluteFill}>
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          accessible={!track}
          accessibilityLabel="Focus sounds loop"
          importantForAccessibility={track ? 'no-hide-descendants' : 'yes'}
          accessibilityElementsHidden={track}
        >
          <View style={styles.control}>
            <Ionicons name="infinite" size={20} color={colors.muted} />
          </View>
        </View>
      </Dim>
    </View>
  );
}

/** A song gets a seek bar; a focus sound's loop shows its progress only. */
function Timeline() {
  const s = useSounds();
  return isTrack(s.current) ? (
    <Seek position={s.position} length={s.length} onSeek={s.seek} label={s.current.name} />
  ) : (
    <Progress position={s.position} length={s.length} />
  );
}

/**
 * Loop progress: a 4px track in the look's track colour, the fill and a 14px knob, in a 44-tall row. It shows
 * progress only (the loop cannot be scrubbed), so the row is one readable progress bar.
 */
function Progress({ position, length }: { position: number; length: number }) {
  const styles = useStyles(makeProgressStyles);
  const pct = length > 0 ? Math.min(1, position / length) : 0;
  return (
    <View>
      <View
        style={styles.row}
        accessibilityRole="progressbar"
        accessibilityLabel={`Loop progress, ${sec(position)} of ${sec(length)}`}
        accessibilityValue={{ min: 0, max: Math.round(length), now: Math.round(position) }}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        <View style={[styles.knob, { left: `${pct * 100}%` }]} />
      </View>
      <View style={styles.times} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.time}>{sec(position)}</Text>
        <Text style={styles.time}>{sec(length)}</Text>
      </View>
    </View>
  );
}

const makeProgressStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    row: { height: 44, justifyContent: 'center' },
    rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.track },
    fill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.accent },
    knob: {
      position: 'absolute',
      width: 14,
      height: 14,
      marginLeft: -7,
      borderRadius: 7,
      backgroundColor: colors.accent,
      // A ring of the glass's top rim lifts the knob off the track.
      borderWidth: 2,
      borderColor: colors.material.rimTop,
      boxShadow: colors.material.control.shadow,
    },
    times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
    time: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
  });

const sec = (n: number) => clock(n);

/**
 * A song's seek bar: the same rail, fill and knob as the loop's progress, but it can be dragged or tapped to a
 * point. While a finger is down the knob follows it and the time shows where it will land; screen readers get
 * an adjustable control that steps ten seconds at a time.
 */
function Seek({ position, length, onSeek, label }: { position: number; length: number; onSeek: (s: number) => void; label: string }) {
  const styles = useStyles(makeProgressStyles);
  const [drag, setDrag] = useState<number | null>(null);
  const width = useRef(0);
  const startX = useRef(0);
  const latest = useRef({ length, onSeek });
  latest.current = { length, onSeek };
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = (x: number) => (width.current > 0 ? Math.max(0, Math.min(1, x / width.current)) * latest.current.length : 0);
  // The bar claims a touch only once it moves sideways, so a scroll that starts on it still scrolls the player;
  // a plain tap seeks through the Pressable inside. Once a drag has started it keeps the touch to the end.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => latest.current.length > 0 && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e, g) => {
          if (settle.current) clearTimeout(settle.current);
          startX.current = e.nativeEvent.locationX - g.dx;
          setDrag(at(startX.current + g.dx));
        },
        onPanResponderMove: (_, g) => setDrag(at(startX.current + g.dx)),
        onPanResponderRelease: (_, g) => {
          const to = at(startX.current + g.dx);
          latest.current.onSeek(to);
          setDrag(to);
          // Hold the knob where it was let go until the player catches up, so it never jumps back.
          settle.current = setTimeout(() => setDrag(null), 450);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const shown = drag ?? position;
  const pct = length > 0 ? Math.min(1, shown / length) : 0;
  const step = (d: number) => onSeek(Math.max(0, Math.min(length, position + d)));
  const tap = (e: GestureResponderEvent) => {
    if (!(latest.current.length > 0)) return;
    if (settle.current) clearTimeout(settle.current);
    const to = at(e.nativeEvent.locationX);
    latest.current.onSeek(to);
    setDrag(to);
    settle.current = setTimeout(() => setDrag(null), 450);
  };
  return (
    <View>
      <View
        style={styles.row}
        onLayout={(e: LayoutChangeEvent) => (width.current = e.nativeEvent.layout.width)}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Position in ${label}`}
        accessibilityValue={{ min: 0, max: Math.round(length), now: Math.round(position), text: `${sec(position)} of ${sec(length)}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 10 : -10)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={tap} accessible={false} focusable={false} />
        <View pointerEvents="none" style={styles.rail} />
        <View pointerEvents="none" style={[styles.fill, { width: `${pct * 100}%` }]} />
        <View pointerEvents="none" style={[styles.knob, { left: `${pct * 100}%` }]} />
      </View>
      <View style={styles.times} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.time}>{sec(shown)}</Text>
        <Text style={styles.time}>{length > 0 ? sec(length) : '–:––'}</Text>
      </View>
    </View>
  );
}

/**
 * The full-screen player: a top bar (close, "Now Playing" and what is playing, the sleep timer), large artwork,
 * the name, the seek bar, the transport row, then (scrolling) the focus sounds, your music and your playlist
 * links. The bar at the top stays put.
 */
function Player({ onForm }: { onForm: (f: MusicForm) => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const s = useSounds();
  const track = isTrack(s.current);
  // The bar stays put over the scroll; once the page moves, an opaque band of the world fades in behind it.
  const scrollY = useSharedValue(0);
  const [barHeight, setBarHeight] = useState(insets.top + 56);
  // Artwork fills the width but leaves room for the controls on short phones.
  const art = Math.min(width - 72, height * 0.4);
  const close = () => s.setSheetOpen(false);
  const scene = track ? 'calm' : s.current.id;

  return (
    <View style={styles.root}>
      {/* The player opens in its own window on Android: it states the look's status bar style again there, so
          Paper's dark icons stay dark over its light world. */}
      <StatusBar style={colors.statusBar} />
      {/* The player is a world of its own, with the same moving light as the screens. */}
      <WorldFrame>
        <View style={styles.bar} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
          <WorldFade top={0} solid={barHeight} scroll={scrollY} />
          <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
            <Round icon="chevron-down" label="Close player" onPress={close} />
            <View style={styles.topCenter}>
              <Text style={styles.topTitle}>Now Playing</Text>
              <Text style={styles.topSub} numberOfLines={1}>
                {topLine(s)}
              </Text>
            </View>
            <Round icon={s.timer ? 'moon' : 'moon-outline'} label={timerLabel(s.timer)} onPress={s.cycleTimer} />
          </View>
        </View>

        <GlassScroll
          style={styles.flex}
          offsetOut={scrollY}
          contentContainerStyle={[styles.body, { paddingTop: barHeight, paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.artWrap}>
            <View style={[styles.artClip, styles.artLift, { width: art, height: art, borderRadius: 32 }]}>
              <FadeSwapScene id={scene} size={art} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.artRim]} />
            </View>
          </View>

          <View style={styles.info}>
            <View style={styles.flex}>
              <Text style={styles.title} numberOfLines={1}>
                {s.current.name}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subLine(s)}
              </Text>
            </View>
            {/* The badge fades in and out with the timer; it keeps the last minutes it showed while it fades. */}
            <TimerBadge minutes={s.timer} />
          </View>

          <View style={styles.progress}>
            <Timeline />
            <FieldError message={s.playError} />
          </View>

          <View style={styles.controls}>
            <Control icon="shuffle" {...shuffleProps(s)} small />
            <Control icon="play-skip-back" label={track ? 'Previous song' : 'Previous sound'} onPress={() => s.skip(-1)} />
            <Press
              onPress={s.toggle}
              style={styles.big}
              overlay={colors.material.pressFill}
              haptic
              accessibilityLabel={s.playing ? 'Pause' : 'Play'}
            >
              <Ionicons
                name={s.playing ? 'pause' : 'play'}
                size={30}
                color={colors.onNode}
                style={s.playing ? undefined : styles.playNudge}
              />
            </Press>
            <Control icon="play-skip-forward" label={track ? 'Next song' : 'Next sound'} onPress={() => s.skip(1)} />
            <RepeatSlot />
          </View>

          <View style={styles.picker}>
            <MusicHeading title="Focus sounds" />
            <Segmented
              stacked
              accessibilityLabel="Focus sound"
              options={SOUNDS.map((x) => ({ key: x.id, label: x.name, icon: x.icon }))}
              value={track ? '' : s.current.id}
              onChange={(id) => s.play(id)}
            />
          </View>
          <MusicLibrary onForm={onForm} />
        </GlassScroll>
      </WorldFrame>
    </View>
  );
}

/** A round button in the player's top bar, a bare glyph in every look. */
function Round({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeGlassStyles);
  return (
    <Press onPress={onPress} style={styles.round} overlay={colors.material.pressFill} accessibilityLabel={label}>
      <Ionicons name={icon as 'moon'} size={22} color={colors.text} />
    </Press>
  );
}

/** The sleep timer's minutes beside the title: fades in when a timer is set and out when it ends. */
function TimerBadge({ minutes }: { minutes: number }) {
  const { colors } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const [shown, setShown] = useState(minutes);
  useEffect(() => {
    if (minutes) setShown(minutes);
  }, [minutes]);
  if (!shown) return null;
  return (
    <Dim on={!minutes} to={0}>
      <View
        style={styles.timerBadge}
        accessibilityElementsHidden={!minutes}
        importantForAccessibility={minutes ? 'auto' : 'no-hide-descendants'}
      >
        <Ionicons name="moon" size={12} color={colors.text} />
        <Text style={styles.timerText}>{shown} min</Text>
      </View>
    </Dim>
  );
}

/** The art; a new sound's scene (or a song's calm scene and note) fades in over the old one instead of cutting. */
function FadeSwapScene({ id, size }: { id: string; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      {[...SOUNDS.map((x) => x.id), 'calm'].map((v) => (
        <Dim key={v} on={v !== id} to={0} style={StyleSheet.absoluteFill}>
          <SceneArt width={size} height={size} variant={v} />
          {v === 'calm' ? <NoteMark size={size} /> : null}
        </Dim>
      ))}
    </View>
  );
}

function timerLabel(minutes: number): string {
  return minutes ? `Sleep timer: ${minutes} minutes. Tap to change` : 'Sleep timer off. Tap to set';
}

/**
 * A round transport control, a bare glyph in every look. A toggle (shuffle or repeat for songs) shows its on state three ways at once, so it
 * never rests on a faint fill alone: a lit inset disc, the glyph in the accent, and an accent dot under it (as
 * music players do). The accent is gated at 3:1 on the disc (scripts/check-contrast.py, "player toggle").
 */
function Control({
  icon,
  label,
  onPress,
  small,
  active,
  toggle,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  small?: boolean;
  active?: boolean;
  toggle?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const a11y = toggle
    ? { accessibilityLabel: `${label}, ${active ? 'on' : 'off'}`, accessibilityState: { checked: !!active } }
    : { accessibilityLabel: label };
  const size = small ? 18 : 22;
  const glyph = toggle ? (
    <>
      <SelectFade on={!!active} radius={24} style={styles.controlOn} />
      <FadeSwap
        on={!!active}
        off={<Ionicons name={icon as 'shuffle'} size={size} color={colors.text} />}
        onContent={<Ionicons name={icon as 'shuffle'} size={size} color={colors.accent} />}
      />
      <Dim on={!active} to={0} style={styles.onDot}>
        <View style={styles.onDotFill} />
      </Dim>
    </>
  ) : (
    <Ionicons name={icon as 'shuffle'} size={size} color={colors.text} />
  );
  return (
    <Press onPress={onPress} style={styles.control} overlay={colors.material.pressFill} {...a11y}>
      {glyph}
    </Press>
  );
}

const makeGlassStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { paddingHorizontal: 24 },
    flex: { flex: 1 },
    bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 3 },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingBottom: 4,
      zIndex: 3,
    },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topCenter: { flex: 1, alignItems: 'center' },
    topTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
    topSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    artWrap: { alignItems: 'center', marginTop: 16 },
    artClip: { overflow: 'hidden' },
    // The art rests on the world in the look's hero shadow (Lavender's carries its rose light).
    artLift: { boxShadow: colors.material.shadowHero },
    artRim: {
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.material.rimRight,
      borderTopColor: colors.material.rimTop,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    info: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28 },
    title: {
      fontFamily: fonts.display,
      fontSize: 26,
      lineHeight: 32,
      color: colors.text,
      letterSpacing: -0.4,
    },
    subtitle: { marginTop: 4, fontFamily: fonts.body, fontSize: 16, color: colors.muted },
    timerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
    },
    timerText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    progress: { marginTop: 10 },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    // 48 across, so the row (four controls and the 76 play disc) fits the 272dp a 320dp phone leaves.
    control: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    controlOn: {
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.litRim,
    },
    onDot: { position: 'absolute', bottom: 8, alignSelf: 'center' },
    onDotFill: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
    // The play disc in the look's node colour (its ink is onNode, gated at 4.5:1), with the action glow.
    big: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.node,
      backgroundImage: `linear-gradient(180deg, ${colors.node}, ${alphaOf(colors.node, 0.84)})`,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.actionGlow}`,
    },
    playNudge: { marginLeft: 4 },
    picker: { marginTop: 16 },
  });

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    miniSpot: { position: 'absolute', left: 16, right: 16 },
    mini: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, paddingRight: 8 },
    miniTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
    miniSub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    miniButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniNudge: { marginLeft: 2 },
    noteWrap: { alignItems: 'center', justifyContent: 'center' },
    noteDisc: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.rimTop,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.material.control.shadow}`,
    },
  });

/** The bottom padding a screen's scroll needs so its last card can rise clear of the tab bar, the mini player
 *  and (with `fab`) the floating button. */
export function useContentBottom(fab = false): number {
  return useFabBottom() + (fab ? 56 + 24 : 16);
}

/** Where floating buttons sit: clear of the tab bar and, once a sound has started, the mini player. */
export function useFabBottom(): number {
  const bar = useBar();
  const { started } = useSounds();
  return bar.bottom + bar.height + 16 + (started ? MINI_HEIGHT + 10 : 0);
}
