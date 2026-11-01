import { Ionicons } from '@expo/vector-icons';
import { Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Segmented } from './Hub';
import Animated from 'react-native-reanimated';
import { Dim, FadeSwap, rise, Press, SelectFade } from './Motion';
import { Sheet } from './Sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOUNDS, useSounds } from '../lib/sounds';
import { SceneArt } from './Art';
import { Glass, WorldFrame } from './Glass';
import { MINI_HEIGHT, useBar } from './glass/chrome';
import { alphaOf } from './glass/colour';
import { type Theme, useStyles, useTheme } from '../theme';

/** Art for a sound: the look's own scene for it (rain, waves, focus), cropped to a rounded tile. */
export function SoundArt({ size, id, radius }: { icon?: string; size: number; id?: string; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.22, overflow: 'hidden' }}>
      <SceneArt width={size} height={size} variant={id} />
    </View>
  );
}

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
        accessibilityLabel="Open focus sounds"
      >
        <SoundArt icon={s.current.icon} id={s.current.id} size={38} />
        <View style={styles.flex}>
          <Text style={styles.miniTitle} numberOfLines={1}>
            {s.current.name}
          </Text>
          <Text style={styles.miniSub} numberOfLines={1}>
            {s.playing ? 'Playing' : 'Paused'} · Focus sounds
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

/** Full "now playing" sheet with the sound list. */
export function NowPlaying() {
  const { colors, type, radii, glass, name } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();

  if (glass) {
    return (
      <Modal
        visible={s.sheetOpen}
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => s.setSheetOpen(false)}
      >
        <GlassPlayer />
      </Modal>
    );
  }

  return (
    <Sheet visible={s.sheetOpen} title="Now playing" onClose={() => s.setSheetOpen(false)}>
      <Text style={type.small}>Focus sounds · loops until you stop</Text>
      <View style={styles.art}>
        {name === 'paper' ? (
          // Paper frames the scene like a print under milk glass: a wide white mat and a soft, deep shadow.
          <View style={styles.paperFrame}>
            <SoundArt id={s.current.id} size={204} radius={20} />
          </View>
        ) : name === 'pine' ? (
          // Pine frames the night scene in a thin mint edge of glass over a deep shadow on the floor.
          <View style={styles.pineFrame}>
            <SoundArt id={s.current.id} size={220} radius={48} />
          </View>
        ) : (
          <SoundArt id={s.current.id} size={220} />
        )}
      </View>
      <Text style={styles.name}>{s.current.name}</Text>
      <Text style={type.small}>{s.current.subtitle}</Text>

      <Progress position={s.position} length={s.length} />

      <View style={styles.controls}>
        <Press style={styles.side} overlay={colors.material.pressFill} onPress={() => s.skip(-1)} accessibilityLabel="Previous sound">
          <Ionicons name="play-skip-back" size={24} color={colors.text} />
        </Press>
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
        <Press style={styles.side} overlay={colors.material.pressFill} onPress={() => s.skip(1)} accessibilityLabel="Next sound">
          <Ionicons name="play-skip-forward" size={24} color={colors.text} />
        </Press>
      </View>

      <View style={styles.list}>
        {SOUNDS.map((x) => {
          const active = x.id === s.current.id;
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
    </Sheet>
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

const sec = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

/**
 * Full-screen player for the glass looks: large artwork, the sound's name, a progress line,
 * round transport controls and a glass bar for picking a sound.
 */
function GlassPlayer() {
  const { colors, name } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const s = useSounds();
  const stone = name === 'stone';
  // Artwork fills the width but leaves room for the controls on short phones.
  const art = Math.min(width - (stone ? 64 : 72), height * 0.42);
  const close = () => s.setSheetOpen(false);
  const iconColor = colors.text;

  return (
    <View style={styles.root}>
      {/* The player is a world of its own, with the same moving light as the screens. */}
      <WorldFrame>
        <View style={[styles.body, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.top}>
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
              {!stone && <Text style={styles.topSub}>Focus sounds · loops until you stop</Text>}
            </View>
            {/* The sleep timer lives in the transport row; this keeps the title centred. */}
            <View style={styles.round} />
          </View>

          <View style={styles.artWrap}>
            {stone ? (
              // Stone frames the stones in a lit glass mount; the scene crossfades when the sound changes.
              <Glass tier="hero" radius={30} style={styles.frame}>
                <View style={[styles.artClip, { width: art - 20, height: art - 20, borderRadius: 22 }]}>
                  <FadeSwapScene id={s.current.id} size={art - 20} />
                </View>
              </Glass>
            ) : (
              <View style={[styles.artClip, styles.artGlow, { width: art, height: art, borderRadius: 32 }]}>
                <FadeSwapScene id={s.current.id} size={art} />
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
                {s.current.subtitle}
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
            <Progress position={s.position} length={s.length} />
          </View>

          <View style={styles.controls}>
            <Control stone={stone} icon="shuffle" label="Shuffle to another sound" onPress={s.shuffle} small />
            <Control stone={stone} icon="play-skip-back" label="Previous sound" onPress={() => s.skip(-1)} />
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
            <Control stone={stone} icon="play-skip-forward" label="Next sound" onPress={() => s.skip(1)} />
            <Control stone={stone} icon={s.timer ? 'moon' : 'moon-outline'} label={timerLabel(s.timer)} onPress={s.cycleTimer} small />
          </View>

          <View style={styles.flex} />
          <View style={styles.picker}>
            <Segmented
              stacked
              accessibilityLabel="Sound"
              options={SOUNDS.map((x) => ({ key: x.id, label: x.name, icon: x.icon }))}
              value={s.current.id}
              onChange={(id) => s.play(id)}
            />
          </View>
        </View>
      </WorldFrame>
    </View>
  );
}

/** The sound's art; a new sound's scene fades in over the old one instead of cutting. */
function FadeSwapScene({ id, size }: { id: string; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      {SOUNDS.map((x) => (
        <Dim key={x.id} on={x.id !== id} to={0} style={StyleSheet.absoluteFill}>
          <SceneArt width={size} height={size} variant={x.id} />
        </Dim>
      ))}
    </View>
  );
}

function timerLabel(minutes: number): string {
  return minutes ? `Sleep timer: ${minutes} minutes. Tap to change` : 'Sleep timer off. Tap to set';
}

function Control({
  stone,
  icon,
  label,
  onPress,
  small,
}: {
  stone: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeGlassStyles);
  const glyph = <Ionicons name={icon as 'shuffle'} size={small ? 18 : 22} color={colors.text} />;
  // Stone sets each control in its own glass circle; Lavender keeps them bare and bright.
  return stone ? (
    <Glass tier="control" radius={26} style={styles.control} onPress={onPress} accessibilityLabel={label}>
      {glyph}
    </Glass>
  ) : (
    <Press onPress={onPress} style={styles.control} overlay={colors.material.pressFill} accessibilityLabel={label}>
      {glyph}
    </Press>
  );
}

const makeGlassStyles = ({ colors, fonts, name }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, paddingHorizontal: 24 },
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    topCenter: { flex: 1, alignItems: 'center' },
    topTitle: { fontFamily: name === 'stone' ? fonts.body : fonts.bodyBold, fontSize: 16, color: colors.text },
    topSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    artWrap: { alignItems: 'center', marginTop: 24 },
    frame: { padding: 9 },
    artClip: { overflow: 'hidden' },
    // Lavender's art is the hero: its rose light spills down into the world below it.
    artGlow: { boxShadow: `${colors.material.shadowPane}, 0px 24px 56px -10px ${alphaOf(colors.accent, 0.5)}` },
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
    picker: { marginTop: 20 },
  });

const makeStyles = ({ colors, fonts, type, radii, name }: Theme) =>
  StyleSheet.create({
    paperFrame: {
      padding: 8,
      borderRadius: 28,
      backgroundColor: alphaOf(colors.material.rimTop, 0.7),
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}, ${colors.material.shadowHero}`,
    },
    pineFrame: {
      borderRadius: 49,
      borderWidth: 1,
      borderColor: colors.material.rimTop,
      borderBottomColor: colors.material.rimBottom,
      boxShadow: colors.material.shadowHero,
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
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32, marginTop: 12 },
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
    list: { marginTop: 20, gap: 6 },
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
