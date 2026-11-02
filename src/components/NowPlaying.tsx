import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Modal, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Segmented } from './Hub';
import Animated from 'react-native-reanimated';
import { Chip } from './Chip';
import { FieldError } from './Field';
import { Dim, FadeSwap, rise, Press, SelectFade } from './Motion';
import { MusicForms, type MusicForm, MusicHeading, MusicLibrary } from './MusicLibrary';
import { Sheet } from './Sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clock } from '../lib/music';
import { type NowItem, SOUNDS, useSounds } from '../lib/sounds';
import { SceneArt } from './Art';
import { Glass, GlassScroll, WorldFrame } from './Glass';
import { MINI_HEIGHT, useBar } from './glass/chrome';
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

/** The player: full screen in its own world on Lavender, Stone and Pine, a sheet of milk glass on Paper. Your
 *  music and playlist links sit under the focus sounds; their forms open over it. */
export function NowPlaying() {
  const { glass, name } = useTheme();
  const s = useSounds();
  const [form, setForm] = useState<MusicForm>(null);
  const forms = <MusicForms form={form} onClose={() => setForm(null)} />;

  // Lavender, Stone and Pine open a full-screen player in their own world (Pine's in the night forest, as on the
  // training hub it follows); Paper keeps a sheet of milk glass.
  if (glass || name === 'pine') {
    return (
      <>
        <Modal
          visible={s.sheetOpen}
          animationType="slide"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => s.setSheetOpen(false)}
        >
          <GlassPlayer onForm={setForm} />
        </Modal>
        {forms}
      </>
    );
  }

  // Paper: the player sheet steps aside while a form is up, and comes back when it closes.
  return (
    <>
      <Sheet visible={s.sheetOpen && !form} title="Now playing" onClose={() => s.setSheetOpen(false)}>
        <PaperPlayer onForm={setForm} />
      </Sheet>
      {forms}
    </>
  );
}

function PaperPlayer({ onForm }: { onForm: (f: MusicForm) => void }) {
  const { colors, type, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();
  const track = isTrack(s.current);
  return (
    <>
      <Text style={type.small}>{topLine(s)}</Text>
      <View style={styles.art}>
        {/* Paper frames the scene like a print under milk glass: a wide white mat and a soft, deep shadow. */}
        <View style={styles.paperFrame}>
          <SoundArt id={s.current.id} track={track} size={204} radius={20} />
        </View>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {s.current.name}
      </Text>
      <Text style={type.small}>{subLine(s)}</Text>

      <Timeline />
      <FieldError message={s.playError} />

      <View style={styles.controls}>
        <Control icon="shuffle" {...shuffleProps(s)} small />
        <Control icon="play-skip-back" label={track ? 'Previous song' : 'Previous sound'} onPress={() => s.skip(-1)} />
        <Press
          style={styles.bigButton}
          overlay={colors.material.pressFill}
          haptic
          onPress={s.toggle}
          accessibilityLabel={s.playing ? 'Pause' : 'Play'}
        >
          <Ionicons
            name={s.playing ? 'pause' : 'play'}
            size={30}
            color={colors.onPrimary}
            style={s.playing ? undefined : styles.playNudge}
          />
        </Press>
        <Control icon="play-skip-forward" label={track ? 'Next song' : 'Next sound'} onPress={() => s.skip(1)} />
        <RepeatSlot />
      </View>
      <View style={styles.timerRow}>
        <Chip
          label={s.timer ? `Sleep in ${s.timer} min` : 'Sleep timer'}
          active={!!s.timer}
          onPress={s.cycleTimer}
          accessibilityLabel={timerLabel(s.timer)}
        />
      </View>

      <MusicHeading title="Focus sounds" />
      <View style={styles.list}>
        {SOUNDS.map((x) => {
          const active = !track && x.id === s.current.id;
          return (
            <Press
              key={x.id}
              style={styles.item}
              overlay={colors.material.pressFill}
              onPress={() => s.play(x.id)}
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Play ${x.name}, ${x.subtitle}`}
            >
              <SelectFade on={active} radius={radii.inset} style={styles.itemActive} />
              <SoundArt id={x.id} size={44} />
              <View style={styles.flex}>
                <Text style={type.bodyMedium}>{x.name}</Text>
                <Text style={type.small}>{x.subtitle}</Text>
              </View>
              <FadeSwap on={active && s.playing} off={null} onContent={<Ionicons name="volume-medium" size={18} color={colors.text} />} />
            </Press>
          );
        })}
      </View>
      <MusicLibrary onForm={onForm} />
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

/** Repeat for songs; a focus sound always loops, so the slot fades away and holds the row's balance. */
function RepeatSlot() {
  const s = useSounds();
  const track = isTrack(s.current);
  return (
    <View
      pointerEvents={track ? 'auto' : 'none'}
      importantForAccessibility={track ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!track}
    >
      <Dim on={!track} to={0}>
        <Control icon="repeat" label="Repeat all" onPress={s.toggleRepeat} active={s.repeatOn} toggle small />
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

const makeProgressStyles = ({ colors, fonts, name }: Theme) =>
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
      // Paper: a white ring lifts the ink knob off the track.
      ...(name === 'paper' ? { borderWidth: 2, borderColor: colors.material.rimTop, boxShadow: colors.material.control.shadow } : null),
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
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.length > 0,
        onMoveShouldSetPanResponder: (_, g) => latest.current.length > 0 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          if (settle.current) clearTimeout(settle.current);
          startX.current = e.nativeEvent.locationX;
          setDrag(at(startX.current));
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
 * Full-screen player for the glass looks: large artwork, the name, a progress line, round transport controls,
 * then (scrolling) the focus sounds, your music and your playlist links. The bar at the top stays put.
 */
function GlassPlayer({ onForm }: { onForm: (f: MusicForm) => void }) {
  const { colors, name } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const s = useSounds();
  const stone = name === 'stone';
  const track = isTrack(s.current);
  // Artwork fills the width but leaves room for the controls on short phones.
  const art = Math.min(width - (stone ? 64 : 72), height * 0.4);
  const close = () => s.setSheetOpen(false);
  const iconColor = colors.text;
  const scene = track ? 'calm' : s.current.id;

  return (
    <View style={styles.root}>
      {/* The player is a world of its own, with the same moving light as the screens. */}
      <WorldFrame>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          {stone ? (
            <Glass tier="control" radius={22} style={styles.round} onPress={close} accessibilityLabel="Close player">
              <Ionicons name="chevron-back" size={20} color={iconColor} />
            </Glass>
          ) : (
            <Press onPress={close} style={styles.round} overlay={colors.material.pressFill} accessibilityLabel="Close player">
              <Ionicons name="chevron-down" size={26} color={iconColor} />
            </Press>
          )}
          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>Now Playing</Text>
            <Text style={styles.topSub} numberOfLines={1}>
              {topLine(s)}
            </Text>
          </View>
          {stone ? (
            <Glass tier="control" radius={22} style={styles.round} onPress={s.cycleTimer} accessibilityLabel={timerLabel(s.timer)}>
              <Ionicons name={s.timer ? 'moon' : 'moon-outline'} size={18} color={iconColor} />
            </Glass>
          ) : (
            <Press onPress={s.cycleTimer} style={styles.round} overlay={colors.material.pressFill} accessibilityLabel={timerLabel(s.timer)}>
              <Ionicons name={s.timer ? 'moon' : 'moon-outline'} size={20} color={iconColor} />
            </Press>
          )}
        </View>

        <GlassScroll style={styles.flex} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.artWrap}>
            {stone ? (
              // Stone frames the stones in a lit glass mount; the scene crossfades when the sound changes.
              <Glass tier="hero" radius={30} style={styles.frame}>
                <View style={[styles.artClip, { width: art - 20, height: art - 20, borderRadius: 22 }]}>
                  <FadeSwapScene id={scene} size={art - 20} />
                </View>
              </Glass>
            ) : (
              <View
                style={[styles.artClip, name === 'pine' ? styles.artLift : styles.artGlow, { width: art, height: art, borderRadius: 32 }]}
              >
                <FadeSwapScene id={scene} size={art} />
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.artRim]} />
              </View>
            )}
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
            {s.timer ? (
              <View style={styles.timerBadge}>
                <Ionicons name="moon" size={12} color={colors.text} />
                <Text style={styles.timerText}>{s.timer} min</Text>
              </View>
            ) : null}
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
              style={[styles.big, stone ? styles.bigStone : styles.bigLavender]}
              overlay={colors.material.pressFill}
              haptic
              accessibilityLabel={s.playing ? 'Pause' : 'Play'}
            >
              <Ionicons
                name={s.playing ? 'pause' : 'play'}
                size={30}
                color={stone ? colors.onPrimary : colors.onNode}
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
 * A round transport control. Stone sets each in its own glass circle; the other looks keep them bare and bright.
 * A toggle (shuffle or repeat for songs) shows its on state as a lit inset disc that fades in.
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
  const { colors, name } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const stone = name === 'stone';
  const a11y = toggle
    ? { accessibilityLabel: `${label}, ${active ? 'on' : 'off'}`, accessibilityState: { checked: !!active } }
    : { accessibilityLabel: label };
  const glyph = (
    <>
      {toggle ? <SelectFade on={!!active} radius={26} style={styles.controlOn} /> : null}
      <Ionicons name={icon as 'shuffle'} size={small ? 18 : 22} color={colors.text} />
    </>
  );
  return stone ? (
    <Glass tier="control" radius={26} style={styles.control} onPress={onPress} {...a11y}>
      {glyph}
    </Glass>
  ) : (
    <Press onPress={onPress} style={styles.control} overlay={colors.material.pressFill} {...a11y}>
      {glyph}
    </Press>
  );
}

const makeGlassStyles = ({ colors, fonts, name }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { paddingHorizontal: 24 },
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 4 },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topCenter: { flex: 1, alignItems: 'center' },
    topTitle: { fontFamily: name === 'stone' ? fonts.body : fonts.bodyBold, fontSize: 16, color: colors.text },
    topSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    artWrap: { alignItems: 'center', marginTop: 16 },
    frame: { padding: 9 },
    artClip: { overflow: 'hidden' },
    // Lavender's art is the hero: its rose light spills down into the world below it.
    artGlow: { boxShadow: `${colors.material.shadowPane}, 0px 24px 56px -10px ${alphaOf(colors.accent, 0.5)}` },
    // Pine's art rests on the night floor in a deep shadow; the mint play button keeps the one glow.
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
      fontSize: name === 'stone' ? 34 : 26,
      lineHeight: name === 'stone' ? 40 : 32,
      color: colors.text,
      letterSpacing: name === 'stone' ? 0 : -0.4,
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
    control: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    controlOn: {
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.litRim,
    },
    big: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
    bigLavender: {
      backgroundColor: colors.node,
      backgroundImage: `linear-gradient(180deg, ${colors.node}, ${alphaOf(colors.node, 0.84)})`,
      boxShadow: colors.actionGlow,
    },
    bigStone: {
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.material.control.shadow}`,
    },
    playNudge: { marginLeft: 4 },
    picker: { marginTop: 16 },
  });

const makeStyles = ({ colors, fonts, type, radii, name }: Theme) =>
  StyleSheet.create({
    paperFrame: {
      padding: 8,
      borderRadius: 28,
      backgroundColor: alphaOf(colors.material.rimTop, 0.7),
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.material.shadowHero}`,
    },
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
    art: { alignItems: 'center', marginVertical: 20 },
    name: { ...type.sheetTitle },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    timerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
    side: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    bigButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      boxShadow: colors.material.control.shadow,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playNudge: { marginLeft: 4 },
    list: { gap: 6 },
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
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 60, borderRadius: radii.inset },
    itemActive:
      name === 'paper'
        ? // Paper: the playing sound rises as a small pane of milk glass.
          {
            backgroundColor: colors.material.inset.fill,
            borderWidth: 1,
            borderColor: colors.material.inset.border,
            borderTopColor: colors.material.inset.borderTop,
            boxShadow: colors.material.shadowPane,
          }
        : {
            backgroundColor: colors.material.inset.fill,
            borderWidth: 1,
            borderColor: name === 'pine' ? colors.litRim : colors.controlBorder,
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
