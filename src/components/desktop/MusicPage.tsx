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
import { SoundArt } from '../NowPlaying';
import { Hover } from './Hover';
import { Fig, GlassButton, Page, Panel, Row } from './Page';

export function MusicPage() {
  const { colors } = useTheme();
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
        <Row match>
          <Panel span={5} index={0} tier="hero" bloom>
            <View style={styles.player}>
              <SoundArt size={160} id={current.kind === 'sound' ? current.id : undefined} track={current.kind === 'track'} radius={20} />
              <Text style={styles.title} numberOfLines={2} role="heading" aria-level={2}>
                {started ? current.name : 'Nothing playing yet'}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {started ? current.subtitle : 'Pick a focus sound or one of your songs.'}
              </Text>
              <View style={styles.transport}>
                <Hover onPress={() => sounds.skip(-1)} squeeze style={styles.round} accessibilityLabel="Previous">
                  <Ionicons name="play-skip-back" size={18} color={colors.text} />
                </Hover>
                <Hover
                  onPress={sounds.toggle}
                  squeeze
                  light={false}
                  style={styles.play}
                  accessibilityLabel={playing ? `Pause ${current.name}` : `Play ${current.name}`}
                >
                  <Ionicons name={playing ? 'pause' : 'play'} size={24} color={colors.onPrimary} />
                </Hover>
                <Hover onPress={() => sounds.skip(1)} squeeze style={styles.round} accessibilityLabel="Next">
                  <Ionicons name="play-skip-forward" size={18} color={colors.text} />
                </Hover>
              </View>
              <Hover
                onPress={sounds.cycleTimer}
                style={styles.timer}
                radius={18}
                accessibilityLabel={
                  sounds.timer ? `Sleep timer, ${sounds.timer} minutes. Press for the next step` : 'Sleep timer, off. Press for 15 minutes'
                }
              >
                <Ionicons name="moon-outline" size={16} color={colors.text} />
                <Text style={styles.timerText}>{sounds.timer ? `Sleep in ${sounds.timer} min` : 'Sleep timer off'}</Text>
              </Hover>
            </View>
          </Panel>
          <Panel span={7} index={1} title="Focus sounds" subtitle="Quiet rooms to work in">
            {SOUNDS.map((s) => {
              const on = current.kind === 'sound' && current.id === s.id;
              return (
                <Hover
                  key={s.id}
                  onPress={() => (on ? sounds.toggle() : sounds.play(s.id))}
                  style={styles.soundRow}
                  radius={12}
                  accessibilityLabel={on && playing ? `Pause ${s.name}` : `Play ${s.name}`}
                >
                  <SoundArt size={48} id={s.id} radius={12} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{s.name}</Text>
                    <Text style={styles.rowMeta}>{s.subtitle}</Text>
                  </View>
                  <Ionicons name={on && playing ? 'pause' : 'play'} size={20} color={colors.text} />
                </Hover>
              );
            })}
          </Panel>
        </Row>
        <Row>
          <Panel span={12} index={2}>
            <MusicLibrary onForm={setForm} />
          </Panel>
        </Row>
        {sounds.importing ? (
          <Text style={styles.meta}>
            Importing {sounds.importing.done} of {sounds.importing.total}…
          </Text>
        ) : null}
        <Text style={styles.meta}>On this computer, imported songs last for this visit.</Text>
      </Page>
      <MusicForms form={form} onClose={() => setForm(null)} />
    </>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) => {
  const inset = colors.material.inset;
  const insetBox = { backgroundColor: inset.fill, borderWidth: 1, borderColor: inset.border, borderTopColor: inset.borderTop };
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    player: { alignItems: 'center', gap: 8, paddingVertical: 8 },
    title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.text, textAlign: 'center', marginTop: 8 },
    meta: { ...type.small, textAlign: 'center' },
    transport: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...insetBox },
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
    soundRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 8, marginHorizontal: -8 },
    rowTitle: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 21, color: colors.text },
    rowMeta: { ...type.small },
  });
};
