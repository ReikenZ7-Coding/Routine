import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SOUNDS, useSounds } from '../lib/sounds';
import { SceneArt } from './Art';
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
    <Pressable accessibilityRole="button" style={[styles.mini, { bottom }]} onPress={() => s.setSheetOpen(true)} accessibilityLabel="Open focus sounds">
      <SoundArt icon={s.current.icon} id={s.current.id} size={38} />
      <View style={styles.flex}>
        <Text style={styles.miniTitle}>{s.current.name}</Text>
        <Text style={styles.miniSub}>{s.playing ? 'Playing' : 'Paused'} · Focus sounds</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={s.toggle} hitSlop={10} style={styles.miniButton} accessibilityLabel={s.playing ? 'Pause' : 'Play'}>
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
  const sec = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;

  return (
    <Modal visible={s.sheetOpen} animationType="slide" transparent onRequestClose={() => s.setSheetOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => s.setSheetOpen(false)} accessibilityLabel="Close" />
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
            <Pressable accessibilityRole="button" style={styles.bigButton} onPress={s.toggle} accessibilityLabel={s.playing ? 'Pause' : 'Play'}>
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
                <Pressable accessibilityRole="button" key={x.id} style={[styles.item, active && styles.itemActive]} onPress={() => s.play(x.id)}>
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
    miniTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
    miniSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
    miniButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
    sheet: { backgroundColor: colors.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '95%' },
    topRow: { flexDirection: 'row', alignItems: 'center' },
    center: { flex: 1, alignItems: 'center' },
    spacer: { width: 24 },
    eyebrow: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
    art: { alignItems: 'center', marginVertical: 22 },
    name: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
    track: { flexDirection: 'row', alignItems: 'center', height: 14, marginTop: 18 },
    fill: { height: 4, borderRadius: 2, backgroundColor: colors.text },
    knob: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.text, marginLeft: -2 },
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
