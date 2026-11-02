// Your own music and saved playlist links, shown in the player under the focus sounds. Rows sit on the look's
// glass panes; editing opens a sheet over the player (the player hands its forms to MusicForms, which draws them
// outside the player's modal).
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { type PlaylistLink, type Track, checkLink, clock, defaultLinkName, detectService, isSessionOnly, serviceLabel } from '../lib/music';
import { KEEPS_IMPORTS } from '../lib/musicFiles';
import { useSounds } from '../lib/sounds';
import { newId, useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { ActionChip } from './Chip';
import { Field, FieldError, Input } from './Field';
import { Glass } from './Glass';
import { Dim, EASE_OUT, FadeSwap, Press, SelectFade } from './Motion';
import { Divider } from './Section';
import { ConfirmDelete, Sheet } from './Sheet';

const SHOW = FadeIn.duration(200).easing(EASE_OUT);
const HIDE = FadeOut.duration(140).easing(EASE_OUT);
const GROW = LinearTransition.duration(240).easing(EASE_OUT);

/** Which form is open over the player. */
export type MusicForm = { kind: 'track'; id: string } | { kind: 'link'; id?: string } | null;

/** A section title on the bare world or a sheet, in the look's section voice, with an action on the right. */
export function MusicHeading({ title, right }: { title: string; right?: ReactNode }) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.heading}>
      <Text style={[type.sectionTitle, styles.headingText]} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

/** "Your music" and "Playlists". */
export function MusicLibrary({ onForm }: { onForm: (f: MusicForm) => void }) {
  return (
    <>
      <YourMusic onForm={onForm} />
      <Playlists onForm={onForm} />
    </>
  );
}

function addedLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Added today';
  return `Added ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

function trackMeta(t: Track, missing: boolean): string {
  if (missing) return 'Not on this phone. Import it again to play it';
  const parts = [t.duration ? clock(t.duration) : null, addedLabel(t.addedAt), isSessionOnly(t) ? 'for this visit' : null];
  return parts.filter(Boolean).join(' · ');
}

function YourMusic({ onForm }: { onForm: (f: MusicForm) => void }) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { music } = useStore();
  const s = useSounds();
  const tracks = music.tracks;
  const empty = tracks.length === 0;

  return (
    <View style={styles.section}>
      <MusicHeading
        title="Your music"
        right={<ActionChip icon="add" label="Import" onPress={s.importMusic} accessibilityLabel="Import music" />}
      />
      <Glass>
        <Animated.View layout={GROW}>
          {empty && !s.importing ? (
            // Empty: one line in the pane, with Import beside the heading. Each section says only what it adds.
            <Animated.View entering={SHOW} exiting={HIDE} style={styles.empty}>
              <Text style={type.hint}>Import songs from your phone. They play one after another, even with the screen off.</Text>
            </Animated.View>
          ) : (
            <View style={styles.rows}>
              {tracks.map((t, i) => (
                <View key={t.id}>
                  {i > 0 && <Divider inset={64} />}
                  <TrackRow track={t} onEdit={() => onForm({ kind: 'track', id: t.id })} />
                </View>
              ))}
            </View>
          )}
          {s.importing ? (
            <Animated.View entering={SHOW} exiting={HIDE} style={[styles.busy, !empty && styles.busyRule]}>
              <ActivityIndicator color={colors.text} />
              <Text style={type.body} accessibilityLiveRegion="polite">
                {s.importing.total > 1
                  ? `Copying ${Math.min(s.importing.done + 1, s.importing.total)} of ${s.importing.total} songs…`
                  : 'Copying your song…'}
              </Text>
            </Animated.View>
          ) : null}
          {s.importNotes.length ? (
            <Animated.View entering={SHOW} exiting={HIDE} style={styles.notes}>
              {s.importNotes.map((n, i) => (
                // Two files can share a name and a problem, so the line's place is its key.
                <FieldError key={i} message={n} />
              ))}
              <Button label="Dismiss" variant="plain" onPress={s.clearImportNotes} style={styles.dismiss} />
            </Animated.View>
          ) : null}
          {!KEEPS_IMPORTS && !empty ? (
            <View style={styles.footer}>
              <Text style={type.hint}>In the browser, imported songs play until you close the page. On your phone they stay.</Text>
            </View>
          ) : null}
        </Animated.View>
      </Glass>
    </View>
  );
}

function TrackRow({ track, onEdit }: { track: Track; onEdit: () => void }) {
  const { colors, type, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();
  const missing = s.missing.has(track.id);
  const active = s.current.kind === 'track' && s.current.id === track.id;
  const meta = trackMeta(track, missing);
  return (
    <View style={styles.row}>
      <Press
        outerStyle={styles.flex}
        style={styles.rowMain}
        overlay={colors.material.pressFill}
        onPress={missing ? onEdit : () => (active ? s.toggle() : s.playTrack(track.id))}
        onLongPress={onEdit}
        accessibilityState={{ selected: active }}
        accessibilityLabel={missing ? `${track.title}, not on this phone` : `${active && s.playing ? 'Pause' : 'Play'} ${track.title}`}
        accessibilityHint="Long press to rename or remove"
      >
        <SelectFade on={active} radius={radii.inset} style={styles.rowActive} />
        <Dim on={missing} style={styles.tile}>
          <FadeSwap
            on={active && s.playing}
            off={<Ionicons name="musical-note" size={20} color={colors.text} />}
            onContent={<Ionicons name="volume-medium" size={20} color={colors.text} />}
          />
        </Dim>
        <View style={styles.flex}>
          <Text style={type.bodyMedium} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={type.small} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </Press>
      <Press
        style={styles.more}
        overlay={colors.material.pressFill}
        onPress={onEdit}
        accessibilityLabel={`Rename or remove ${track.title}`}
      >
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Press>
    </View>
  );
}

function Playlists({ onForm }: { onForm: (f: MusicForm) => void }) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { music } = useStore();
  const links = music.links;
  const empty = links.length === 0;

  return (
    <View style={styles.section}>
      <MusicHeading
        title="Playlists"
        right={
          <ActionChip
            icon="link-outline"
            label="Add link"
            onPress={() => onForm({ kind: 'link' })}
            accessibilityLabel="Add a playlist link"
          />
        }
      />
      <Glass>
        <Animated.View layout={GROW}>
          {empty ? (
            <Animated.View entering={SHOW} exiting={HIDE} style={styles.empty}>
              <Text style={type.hint}>Save a share link from Spotify, YouTube Music or any music app to open it in one tap.</Text>
            </Animated.View>
          ) : (
            <View style={styles.rows}>
              {links.map((l, i) => (
                <View key={l.id}>
                  {i > 0 && <Divider inset={64} />}
                  <LinkRow link={l} onEdit={() => onForm({ kind: 'link', id: l.id })} />
                </View>
              ))}
            </View>
          )}
          {!empty ? (
            <View style={styles.footer}>
              <Text style={type.hint}>Opening a playlist pauses Allin's sound and hands over to its app.</Text>
            </View>
          ) : null}
        </Animated.View>
      </Glass>
    </View>
  );
}

function LinkRow({ link, onEdit }: { link: PlaylistLink; onEdit: () => void }) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const s = useSounds();
  const [error, setError] = useState<string | undefined>();
  const [opening, setOpening] = useState(false);
  const service = detectService(link.url);
  const where = service === 'link' ? defaultLinkName(link.url) : serviceLabel(service);
  const open = async () => {
    if (opening) return;
    setOpening(true);
    setError(await s.openLink(link));
    setOpening(false);
  };
  return (
    <View>
      <View style={styles.row}>
        <Press
          outerStyle={styles.flex}
          style={styles.rowMain}
          overlay={colors.material.pressFill}
          onPress={open}
          onLongPress={onEdit}
          accessibilityRole="link"
          accessibilityLabel={`Open ${link.name} in ${where}`}
          accessibilityHint="Long press to rename or delete"
        >
          <View style={styles.tile}>
            {opening ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name={service === 'link' ? 'link' : 'list'} size={20} color={colors.text} />
            )}
          </View>
          <View style={styles.flex}>
            <Text style={type.bodyMedium} numberOfLines={1}>
              {link.name}
            </Text>
            <View style={styles.serviceLine}>
              <Ionicons name="open-outline" size={14} color={colors.muted} />
              <Text style={[type.small, styles.flex]} numberOfLines={1}>
                {service === 'link' ? where : `Opens in ${where}`}
              </Text>
            </View>
          </View>
        </Press>
        <Press style={styles.more} overlay={colors.material.pressFill} onPress={onEdit} accessibilityLabel={`Edit ${link.name}`}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Press>
      </View>
      {error ? (
        <View style={styles.rowError}>
          <FieldError message={error} />
        </View>
      ) : null}
    </View>
  );
}

/** The forms the music sections open: rename or remove a song, add or edit a link. */
export function MusicForms({ form, onClose }: { form: MusicForm; onClose: () => void }) {
  const { music } = useStore();
  // Keep the last item while a sheet slides away, so its content does not blank out mid-exit.
  const lastTrack = useRef<Track | undefined>(undefined);
  const lastLink = useRef<{ link?: PlaylistLink } | undefined>(undefined);
  if (form?.kind === 'track') lastTrack.current = music.tracks.find((t) => t.id === form.id) ?? lastTrack.current;
  if (form?.kind === 'link') lastLink.current = { link: form.id ? music.links.find((l) => l.id === form.id) : undefined };
  return (
    <>
      <TrackSheet visible={form?.kind === 'track'} track={lastTrack.current} onClose={onClose} />
      <LinkSheet visible={form?.kind === 'link'} link={lastLink.current?.link} onClose={onClose} />
    </>
  );
}

function TrackSheet({ visible, track, onClose }: { visible: boolean; track?: Track; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const { type } = useTheme();
  const { updateMusic } = useStore();
  const s = useSounds();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setTitle(track?.title ?? '');
    setError(undefined);
  }, [visible, track]);

  const save = () => {
    if (!track) return;
    const name = title.trim();
    if (!name) return setError('Give the song a name.');
    updateMusic((m) => ({ ...m, tracks: m.tracks.map((t) => (t.id === track.id ? { ...t, title: name } : t)) }));
    onClose();
  };

  const missing = track ? s.missing.has(track.id) : false;
  return (
    <Sheet visible={visible} title="Edit song" onClose={onClose}>
      {track ? <Text style={type.hint}>{trackMeta(track, missing)}</Text> : null}
      <Field label="Name" error={error}>
        <Input
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(undefined);
          }}
          invalid={!!error}
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel="Song name"
        />
      </Field>
      <Button label="Save" onPress={save} style={styles.save} />
      {track ? (
        <ConfirmDelete
          label="Remove song"
          question={
            isSessionOnly(track)
              ? `Remove “${track.title}” from Allin?`
              : `Remove “${track.title}”? Allin's copy is deleted. The original file on your phone stays where it is.`
          }
          confirmLabel="Remove"
          onConfirm={() => {
            s.removeTrack(track.id);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

function LinkSheet({ visible, link, onClose }: { visible: boolean; link?: PlaylistLink; onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const { type, colors } = useTheme();
  const { updateMusic } = useStore();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!visible) return;
    setUrl(link?.url ?? '');
    setName(link?.name ?? '');
    setError(undefined);
  }, [visible, link]);

  const checked = checkLink(url);
  const service = 'url' in checked ? detectService(checked.url) : undefined;

  const save = () => {
    const c = checkLink(url);
    if ('error' in c) return setError(c.error);
    const label = name.trim() || defaultLinkName(c.url);
    if (link) {
      updateMusic((m) => ({ ...m, links: m.links.map((l) => (l.id === link.id ? { ...l, url: c.url, name: label } : l)) }));
    } else {
      updateMusic((m) => ({ ...m, links: [...m.links, { id: newId(), url: c.url, name: label, addedAt: new Date().toISOString() }] }));
    }
    onClose();
  };

  return (
    <Sheet visible={visible} title={link ? 'Edit playlist link' : 'Add a playlist link'} onClose={onClose}>
      <Text style={type.hint}>
        In Spotify, YouTube Music or another music app, tap Share on a playlist, copy the link and paste it here.
      </Text>
      <Field label="Link" error={error}>
        <Input
          value={url}
          onChangeText={(t) => {
            setUrl(t);
            setError(undefined);
          }}
          invalid={!!error}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          autoFocus={!link}
          placeholder="https://open.spotify.com/playlist/…"
          accessibilityLabel="Playlist link"
        />
      </Field>
      <Animated.View layout={GROW}>
        {service && !error ? (
          <Animated.View key={service} entering={SHOW} exiting={HIDE} style={styles.detected}>
            <Ionicons name="open-outline" size={16} color={colors.muted} />
            <Text style={type.small} accessibilityLiveRegion="polite">
              {service === 'link' ? 'Opens in your browser or the app it belongs to' : `Opens in ${serviceLabel(service)}`}
            </Text>
          </Animated.View>
        ) : null}
        <Field label="Name (optional)">
          <Input
            value={name}
            onChangeText={setName}
            placeholder={service ? defaultLinkName('url' in checked ? checked.url : '') : 'Morning run'}
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="Playlist name"
          />
        </Field>
        <Button label={link ? 'Save' : 'Save link'} onPress={save} style={styles.save} />
        {link ? (
          <ConfirmDelete
            label="Delete link"
            question={`Delete “${link.name}”? Only the link goes; the playlist itself stays in its app.`}
            onConfirm={() => {
              updateMusic((m) => ({ ...m, links: m.links.filter((l) => l.id !== link.id) }));
              onClose();
            }}
          />
        ) : null}
      </Animated.View>
    </Sheet>
  );
}

const makeStyles = ({ colors, radii }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    section: { marginTop: 28 },
    heading: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
      marginBottom: 6,
      paddingHorizontal: 2,
      gap: 12,
    },
    headingText: { flexShrink: 1 },
    rows: { padding: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 60, borderRadius: radii.inset },
    rowActive: {
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.selectRim ?? colors.material.inset.border,
      borderTopColor: colors.material.selectRim ?? colors.material.inset.borderTop,
    },
    tile: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.material.inset.fill,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
    },
    more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    serviceLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowError: { paddingHorizontal: 14, paddingBottom: 8 },
    empty: { paddingHorizontal: 16, paddingVertical: 14 },
    busy: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    busyRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    notes: { paddingHorizontal: 16, paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    dismiss: { alignSelf: 'flex-start', marginLeft: -12 },
    footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    detected: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    save: { marginTop: 24 },
  });
