// Music as a desktop page: what is playing, with its transport and the sleep timer, the three focus sounds,
// and the person's songs and playlist links (the phone's Now Playing library, at page width).
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { plural } from '../../lib/plural';
import { SOUNDS, useSounds } from '../../lib/sounds';
import { useStore } from '../../lib/store';
import { type Theme, useStyles, useTheme } from '../../theme';
import { MusicForms, type MusicForm, MusicLibrary } from '../MusicLibrary';
import { FieldError } from '../Field';
import { Control, FadeSwapScene, RepeatSlot, SoundArt, Timeline, TimerBadge, shuffleProps, subLine, topLine } from '../NowPlaying';
import { Hover } from './Hover';
import { useShellMetrics } from './layout';
import { Column, Fig, GlassButton, Page, Panel, Row, useSpan } from './Page';

export function MusicPage() {
  const styles = useStyles(makeStyles);
  const sounds = useSounds();
  const { music } = useStore();
  const [form, setForm] = useState<MusicForm>(null);
  const { current, playing, started } = sounds;
  const subtitle = started ? (
    <>
      <Fig>{current.name}</Fig> is {playing ? 'playing' : 'paused'} · <Fig>{plural(music.tracks.length, 'song')}</Fig> ·{' '}
      <Fig>{plural(music.links.length, 'playlist')}</Fig>
    </>
  ) : (
    'Focus sounds, your own songs and playlist links.'
  );
  return (
    <>
      <Page
        title="Music"
        subtitle={subtitle}
        actions={
          <>
            <GlassButton label="Import songs" icon="download-outline" onPress={sounds.importMusic} />
            <GlassButton label="Add a link" icon="link-outline" onPress={() => setForm({ kind: 'link' })} />
          </>
        }
      >
        <Row>
          <Panel span={5} index={0} tier="hero" bloom>
            <Player />
          </Panel>
          <Column span={7}>
            <Panel span={7} index={1} title="Focus sounds" subtitle="Quiet rooms to work in. They loop until you stop">
              <SoundTiles />
            </Panel>
            <Panel span={7} index={2}>
              <MusicLibrary onForm={setForm} />
              {sounds.importing ? (
                <Text style={[styles.rowMeta, styles.note]}>
                  Importing {sounds.importing.done} of {sounds.importing.total}…
                </Text>
              ) : null}
              <Text style={[styles.rowMeta, styles.note]}>On this computer, imported songs last for this visit.</Text>
            </Panel>
          </Column>
        </Row>
      </Page>
      <MusicForms form={form} onClose={() => setForm(null)} />
    </>
  );
}

/** The player, hero glass: the art (up to 320 square), what is playing, the seek bar, the transport and the sleep
 *  timer. Inside the page, so it can measure its span. */
function Player() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const sounds = useSounds();
  const { current, playing, started } = sounds;
  const m = useShellMetrics();
  const track = current.kind === 'track';
  const art = Math.max(160, Math.min(320, useSpan(5) - 2 * m.panelPad - 24));
  return (
    <View style={styles.player}>
      <View style={[styles.art, { width: art, height: art }]}>
        <FadeSwapScene id={track ? 'calm' : current.id} size={art} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.artRim]} />
      </View>
      <Text style={styles.top} numberOfLines={1}>
        {started ? topLine(sounds) : 'Nothing playing yet'}
      </Text>
      <View style={styles.info}>
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1} role="heading" aria-level={2}>
            {current.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {started ? subLine(sounds) : 'Press play, or pick a focus sound or one of your songs.'}
          </Text>
        </View>
        <TimerBadge minutes={sounds.timer} />
      </View>
      <View style={styles.timeline}>
        <Timeline />
        <FieldError message={sounds.playError} />
      </View>
      <View style={styles.transport}>
        <Control icon="shuffle" {...shuffleProps(sounds)} small />
        <Control icon="play-skip-back" label={track ? 'Previous song' : 'Previous sound'} onPress={() => sounds.skip(-1)} />
        <Hover
          onPress={sounds.toggle}
          squeeze
          light={false}
          style={styles.play}
          accessibilityLabel={playing ? `Pause ${current.name}` : `Play ${current.name}`}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={26} color={colors.onPrimary} style={playing ? undefined : styles.nudge} />
        </Hover>
        <Control icon="play-skip-forward" label={track ? 'Next song' : 'Next sound'} onPress={() => sounds.skip(1)} />
        <RepeatSlot />
      </View>
      <Hover
        onPress={sounds.cycleTimer}
        style={styles.timer}
        radius={18}
        accessibilityLabel={
          sounds.timer ? `Sleep timer, ${sounds.timer} minutes. Press for the next step` : 'Sleep timer, off. Press for 15 minutes'
        }
      >
        <Ionicons name={sounds.timer ? 'moon' : 'moon-outline'} size={16} color={colors.text} />
        <Text style={styles.timerText}>{sounds.timer ? `Sleep in ${sounds.timer} min` : 'Sleep timer off'}</Text>
      </Hover>
    </View>
  );
}

/** The three focus sounds as tiles with their scenes, sharing the panel's width. */
function SoundTiles() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const sounds = useSounds();
  const { current, playing } = sounds;
  const m = useShellMetrics();
  const tile = Math.max(96, Math.floor((useSpan(7) - 2 * m.panelPad - 24) / 3) - 20);
  return (
    <View style={styles.tiles}>
      {SOUNDS.map((x) => {
        const on = current.kind === 'sound' && current.id === x.id;
        return (
          <Hover
            key={x.id}
            onPress={() => (on ? sounds.toggle() : sounds.play(x.id))}
            outerStyle={styles.flex}
            style={[styles.tile, on && styles.tileOn]}
            radius={16}
            accessibilityLabel={on && playing ? `Pause ${x.name}` : `Play ${x.name}`}
            aria={{ 'aria-pressed': on && playing }}
          >
            <SoundArt size={tile} id={x.id} radius={12} />
            <View style={styles.tileText}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{x.name}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {x.subtitle}
                </Text>
              </View>
              <Ionicons name={on && playing ? 'pause' : 'play'} size={18} color={colors.text} />
            </View>
          </Hover>
        );
      })}
    </View>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    player: { alignItems: 'center', paddingVertical: 4 },
    art: { borderRadius: 28, overflow: 'hidden', boxShadow: colors.material.shadowHero },
    artRim: {
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.material.rimRight,
      borderTopColor: colors.material.rimTop,
      boxShadow: `inset 0px 1px 0px ${colors.material.innerTop}`,
    },
    top: { ...type.label, marginTop: 20, alignSelf: 'stretch' },
    info: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginTop: 6 },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text },
    meta: { ...type.small, marginTop: 2 },
    timeline: { alignSelf: 'stretch', marginTop: 12 },
    transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 8 },
    nudge: { marginLeft: 3 },
    tiles: { flexDirection: 'row', gap: 12 },
    tile: { padding: 10, gap: 10, borderRadius: 16, ...insetBox },
    tileOn: { borderColor: colors.litRim, borderTopColor: colors.litRim },
    tileText: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    note: { marginTop: 12 },
    play: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    timer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      marginTop: 8,
      ...insetBox,
    },
    timerText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowMeta: { ...type.small },
  });
};
