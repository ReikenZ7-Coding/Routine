import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Segmented } from './Hub';
import { FadeSwap, Press, SelectFade } from './Motion';
import { Sheet } from './Sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOUNDS, useSounds } from '../lib/sounds';
import { SceneArt } from './Art';
import { Glass, WorldFrame } from './Glass';
import { MINI_HEIGHT, useBar } from './glass/chrome';
import { type Theme, useStyles, useTheme } from '../theme';

/** Art for a sound: the look's own scene for it (rain, waves, focus), cropped to a rounded tile. */
export function SoundArt({ size, id }: { icon?: string; size: number; id?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden' }}>
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
  const { colors, type, radii, glass } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();
  const pct = Math.min(1, s.position / s.length);

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
        <SoundArt id={s.current.id} size={220} />
      </View>
      <Text style={styles.name}>{s.current.name}</Text>
      <Text style={type.small}>{s.current.subtitle}</Text>

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
  const pct = Math.min(1, s.position / s.length);
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
            {stone ? (
              <Glass tier="control" radius={22} style={styles.round} onPress={s.cycleTimer} accessibilityLabel={timerLabel(s.timer)}>
                <Ionicons name={s.timer ? 'moon' : 'moon-outline'} size={18} color={iconColor} />
              </Glass>
            ) : (
              <Press
                onPress={s.cycleTimer}
                style={styles.round}
                overlay={colors.material.pressFill}
                accessibilityLabel={timerLabel(s.timer)}
              >
                <Ionicons name={s.timer ? 'moon' : 'moon-outline'} size={20} color={iconColor} />
              </Press>
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
                color={colors.onPrimary}
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
      backgroundColor: name === 'stone' ? colors.accent : colors.text,
      boxShadow: `0px 0px 10px ${colors.accent}`,
    },
    times: { flexDirection: 'row', justifyContent: 'space-between' },
    time: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    control: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    big: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
    bigLavender: { backgroundColor: colors.primary, boxShadow: `0px 8px 28px ${colors.glow}` },
    bigStone: { backgroundColor: colors.primary, boxShadow: '0px 8px 24px rgba(230,214,179,0.35)' },
    playNudge: { marginLeft: 4 },
    picker: { marginTop: 20 },
  });

const makeStyles = ({ colors, fonts, type, radii }: Theme) =>
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
    art: { alignItems: 'center', marginVertical: 20 },
    name: { ...type.sheetTitle },
    track: { height: 24, justifyContent: 'center', marginTop: 16 },
    rail: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.track },
    fill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.accent },
    knob: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: colors.accent },
    times: { flexDirection: 'row', justifyContent: 'space-between' },
    time: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, fontVariant: ['tabular-nums'] },
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
    itemActive: {
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.controlBorder,
    },
  });

/** Where floating buttons sit: clear of the tab bar and, once a sound has started, the mini player. */
export function useFabBottom(): number {
  const bar = useBar();
  const { started } = useSounds();
  return bar.bottom + bar.height + 16 + (started ? MINI_HEIGHT + 10 : 0);
}
