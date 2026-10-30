import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOUNDS, useSounds } from '../lib/sounds';
import { Ambience, SceneArt } from './Art';
import { BlurTargetContext, Glass } from './Glass';
import { type Theme, useStyles, useTheme } from '../theme';

/** Art for a sound: a soft gradient tile with its icon. */
export function SoundArt({ icon, size, id }: { icon: string; size: number; id?: string }) {
  const { kinds, glass } = useTheme();
  if (glass) {
    return (
      <View style={{ width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden' }}>
        <SceneArt width={size} height={size} variant={id} />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={[kinds.routines.color, kinds.chinese.color, kinds.gym.color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.22, alignItems: 'center', justifyContent: 'center', opacity: 0.92 }}
    >
      <Ionicons name={icon as 'rainy'} size={size * 0.38} color="#FFFFFF" />
    </LinearGradient>
  );
}

/** Small player above the tab bar once a sound has been started. */
export function MiniPlayer({ bottom }: { bottom: number }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();
  if (!s.started) return null;
  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.mini, { bottom }]}
      onPress={() => s.setSheetOpen(true)}
      accessibilityLabel="Open focus sounds"
    >
      <SoundArt icon={s.current.icon} id={s.current.id} size={38} />
      <View style={styles.flex}>
        <Text style={styles.miniTitle}>{s.current.name}</Text>
        <Text style={styles.miniSub}>{s.playing ? 'Playing' : 'Paused'} · Focus sounds</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={s.toggle}
        hitSlop={10}
        style={styles.miniButton}
        accessibilityLabel={s.playing ? 'Pause' : 'Play'}
      >
        <Ionicons name={s.playing ? 'pause' : 'play'} size={18} color={colors.onPrimary} />
      </Pressable>
    </Pressable>
  );
}

/** Full "now playing" sheet with the sound list. */
export function NowPlaying() {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const s = useSounds();
  const pct = Math.min(1, s.position / s.length);
  const glass = useTheme().glass;

  if (glass) {
    return (
      <Modal visible={s.sheetOpen} animationType="slide" onRequestClose={() => s.setSheetOpen(false)}>
        <GlassPlayer />
      </Modal>
    );
  }

  return (
    <Modal visible={s.sheetOpen} animationType="slide" transparent onRequestClose={() => s.setSheetOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          style={StyleSheet.absoluteFill}
          onPress={() => s.setSheetOpen(false)}
          accessibilityLabel="Close"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" onPress={() => s.setSheetOpen(false)} hitSlop={10} accessibilityLabel="Close player">
              <Ionicons name="chevron-down" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.center}>
              <Text style={styles.eyebrow}>Now playing</Text>
              <Text style={type.small}>Focus sounds · loops forever</Text>
            </View>
            <View style={styles.spacer} />
          </View>

          <View style={styles.art}>
            <SoundArt icon={s.current.icon} id={s.current.id} size={240} />
          </View>
          <Text style={styles.name}>{s.current.name}</Text>
          <Text style={type.small}>{s.current.subtitle}</Text>

          <View style={styles.track}>
            <View style={[styles.fill, { flex: pct }]} />
            <View style={styles.knob} />
            <View style={{ flex: 1 - pct }} />
          </View>
          <View style={styles.times}>
            <Text style={styles.time}>{sec(s.position)}</Text>
            <Text style={styles.time}>{sec(s.length)}</Text>
          </View>

          <View style={styles.controls}>
            <Pressable accessibilityRole="button" onPress={() => s.skip(-1)} hitSlop={10} accessibilityLabel="Previous sound">
              <Ionicons name="play-skip-back" size={26} color={colors.text} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.bigButton}
              onPress={s.toggle}
              accessibilityLabel={s.playing ? 'Pause' : 'Play'}
            >
              <Ionicons name={s.playing ? 'pause' : 'play'} size={30} color={colors.onPrimary} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => s.skip(1)} hitSlop={10} accessibilityLabel="Next sound">
              <Ionicons name="play-skip-forward" size={26} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.list}>
            {SOUNDS.map((x) => {
              const active = x.id === s.current.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={x.id}
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => s.play(x.id)}
                >
                  <SoundArt icon={x.icon} id={x.id} size={44} />
                  <View style={styles.flex}>
                    <Text style={type.bodyMedium}>{x.name}</Text>
                    <Text style={type.small}>{x.subtitle}</Text>
                  </View>
                  {active && s.playing ? <Ionicons name="volume-medium" size={18} color={colors.text} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  const target = useRef<ComponentRef<typeof View>>(null);
  const s = useSounds();
  const stone = name === 'stone';
  const pct = Math.min(1, s.position / s.length);
  // Artwork fills the width but leaves room for the controls on short phones.
  const art = Math.min(width - (stone ? 64 : 72), height * 0.42);
  const close = () => s.setSheetOpen(false);
  const iconColor = stone ? colors.text : '#FFFFFF';

  return (
    <View style={styles.root}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={colors.gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} />
        <Ambience />
      </BlurTargetView>
      <BlurTargetContext.Provider value={target}>
        <View style={[styles.body, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.top}>
            {stone ? (
              <Glass radius={22} style={styles.round} onPress={close} accessibilityLabel="Close player">
                <Ionicons name="chevron-back" size={20} color={iconColor} />
              </Glass>
            ) : (
              <Pressable onPress={close} style={styles.round} accessibilityRole="button" accessibilityLabel="Close player">
                <Ionicons name="chevron-down" size={26} color={iconColor} />
              </Pressable>
            )}
            <View style={styles.topCenter}>
              <Text style={styles.topTitle}>Now Playing</Text>
              {!stone && <Text style={styles.topSub}>Focus sounds · loops until you stop</Text>}
            </View>
            {stone ? (
              <Glass radius={22} style={styles.round} onPress={s.cycleTimer} accessibilityLabel={timerLabel(s.timer)}>
                <Ionicons name={s.timer ? 'moon' : 'moon-outline'} size={18} color={iconColor} />
              </Glass>
            ) : (
              <Pressable onPress={s.cycleTimer} style={styles.round} accessibilityRole="button" accessibilityLabel={timerLabel(s.timer)}>
                <Ionicons name={s.timer ? 'moon' : 'moon-outline'} size={20} color={iconColor} />
              </Pressable>
            )}
          </View>

          <View style={styles.artWrap}>
            {stone ? (
              <Glass radius={26} style={styles.frame}>
                <View style={[styles.artClip, { width: art - 16, height: art - 16, borderRadius: 20 }]}>
                  <SceneArt width={art - 16} height={art - 16} variant={s.current.id} />
                </View>
              </Glass>
            ) : (
              <View style={[styles.artClip, styles.artGlow, { width: art, height: art, borderRadius: 28 }]}>
                <SceneArt width={art} height={art} variant={s.current.id} />
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

          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="Loop progress"
            accessibilityValue={{ min: 0, max: Math.round(s.length), now: Math.round(s.position) }}
          >
            <View style={styles.rail} />
            <View style={[styles.fill, { width: `${pct * 100}%` }]} />
            <View style={[styles.knob, { left: `${pct * 100}%` }]} />
          </View>
          <View style={styles.times}>
            <Text style={styles.time}>{sec(s.position)}</Text>
            <Text style={styles.time}>{sec(s.length)}</Text>
          </View>

          <View style={styles.controls}>
            <Control stone={stone} icon="shuffle" label="Shuffle to another sound" onPress={s.shuffle} small />
            <Control stone={stone} icon="play-skip-back" label="Previous sound" onPress={() => s.skip(-1)} />
            <Pressable
              onPress={s.toggle}
              style={[styles.big, stone ? styles.bigStone : styles.bigLavender]}
              accessibilityRole="button"
              accessibilityLabel={s.playing ? 'Pause' : 'Play'}
            >
              <Ionicons
                name={s.playing ? 'pause' : 'play'}
                size={30}
                color={stone ? colors.onPrimary : colors.onPrimary}
                style={s.playing ? undefined : styles.playNudge}
              />
            </Pressable>
            <Control stone={stone} icon="play-skip-forward" label="Next sound" onPress={() => s.skip(1)} />
            <Control stone={stone} icon={s.timer ? 'moon' : 'moon-outline'} label={timerLabel(s.timer)} onPress={s.cycleTimer} small />
          </View>

          <View style={styles.flex} />
          <Glass radius={24} style={styles.picker}>
            {SOUNDS.map((x) => {
              const active = x.id === s.current.id;
              return (
                <Pressable
                  key={x.id}
                  onPress={() => s.play(x.id)}
                  style={[styles.pick, active && styles.pickActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Play ${x.name}`}
                >
                  <Ionicons name={x.icon} size={20} color={active ? colors.onSelected : colors.text} />
                  <Text style={[styles.pickText, active && styles.pickTextActive]} numberOfLines={1}>
                    {x.name}
                  </Text>
                </Pressable>
              );
            })}
          </Glass>
        </View>
      </BlurTargetContext.Provider>
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
  const glyph = <Ionicons name={icon as 'shuffle'} size={small ? 18 : 22} color={stone ? colors.text : '#FFFFFF'} />;
  // Stone sets each control in its own glass circle; Lavender keeps them bare and bright.
  return stone ? (
    <Glass radius={26} style={styles.control} onPress={onPress} accessibilityLabel={label}>
      {glyph}
    </Glass>
  ) : (
    <Pressable onPress={onPress} style={styles.control} accessibilityRole="button" accessibilityLabel={label}>
      {glyph}
    </Pressable>
  );
}

const makeGlassStyles = ({ colors, fonts, name }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { flex: 1, paddingHorizontal: 24 },
    flex: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    round: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    topCenter: { flex: 1, alignItems: 'center' },
    topTitle: { fontFamily: name === 'stone' ? fonts.body : fonts.bodyBold, fontSize: 16, color: colors.text },
    topSub: { marginTop: 2, fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    artWrap: { alignItems: 'center', marginTop: 24 },
    frame: { padding: 8 },
    artClip: { overflow: 'hidden' },
    artGlow: { boxShadow: `0px 18px 40px ${colors.glow}66` },
    info: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28 },
    title: {
      fontFamily: fonts.display,
      fontSize: name === 'stone' ? 32 : 26,
      lineHeight: name === 'stone' ? 38 : 32,
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
      backgroundColor: colors.primarySoft,
    },
    timerText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    track: { height: 24, justifyContent: 'center', marginTop: 20 },
    rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.border },
    fill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.accent },
    knob: {
      position: 'absolute',
      width: 14,
      height: 14,
      marginLeft: -7,
      borderRadius: 7,
      backgroundColor: name === 'stone' ? colors.accent : '#FFFFFF',
      boxShadow: `0px 0px 10px ${colors.accent}`,
    },
    times: { flexDirection: 'row', justifyContent: 'space-between' },
    time: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    control: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
    big: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
    bigLavender: { backgroundColor: '#FFFFFF', boxShadow: `0px 8px 28px ${colors.glow}` },
    bigStone: { backgroundColor: colors.primary, boxShadow: '0px 8px 24px rgba(230,214,179,0.35)' },
    playNudge: { marginLeft: 4 },
    picker: { flexDirection: 'row', padding: 6, gap: 6, marginTop: 20 },
    pick: { flex: 1, minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 },
    pickActive: { backgroundColor: colors.selected },
    pickText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
    pickTextActive: { color: colors.onSelected },
  });

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    mini: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 8,
      paddingRight: 12,
      borderRadius: 20,
      backgroundColor: colors.sheet,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    },
    miniTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
    miniSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
    miniButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
    sheet: { backgroundColor: colors.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '95%' },
    topRow: { flexDirection: 'row', alignItems: 'center' },
    center: { flex: 1, alignItems: 'center' },
    spacer: { width: 24 },
    eyebrow: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
    art: { alignItems: 'center', marginVertical: 22 },
    name: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
    track: { flexDirection: 'row', alignItems: 'center', height: 14, marginTop: 18 },
    fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
    knob: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accent,
      marginLeft: -2,
      boxShadow: `0px 0px 10px ${colors.accent}`,
    },
    times: { flexDirection: 'row', justifyContent: 'space-between' },
    time: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44, marginTop: 12 },
    bigButton: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primary,
      shadowColor: colors.glow,
      shadowOpacity: 0.9,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 4 },
      elevation: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { marginTop: 20, gap: 6 },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 16 },
    itemActive: { backgroundColor: colors.primarySoft },
  });

/** Where floating buttons sit: clear of the floating tab bar and the mini player. */
export function useFabBottom(): number {
  const { glass } = useTheme();
  const { started } = useSounds();
  return (glass ? 100 : 24) + (started ? 64 : 0);
}
