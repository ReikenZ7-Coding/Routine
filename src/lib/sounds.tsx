// One shared player for the built-in focus sounds (made for this app, so they work offline) and the person's own
// imported music, so playback keeps going while you move between tabs and with the screen off.
//
// - Focus sounds loop until you stop them. Your songs play through a queue: the next song at the end, back to
//   the first with repeat on, in a shuffled order with shuffle on.
// - On Android, sustained background playback needs the player to hold the media controls (the notification and
//   lock screen) and exclusive audio focus; the expo-audio plugin adds the media playback service (app.json).
import { type AudioPlayer, type AudioSource, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import {
  type PlaylistLink,
  type Track,
  afterEnd,
  clampSeek,
  isAudioFile,
  otherIndex,
  playOrder,
  previousRestarts,
  stepIn,
  storedFileName,
  titleFromFileName,
  webFallback,
} from './music';
import { deleteCopy, hasFile, keepCopy } from './musicFiles';
import { newId, useStore } from './store';

export interface Sound {
  id: string;
  name: string;
  subtitle: string;
  icon: 'rainy' | 'water' | 'cloudy-night';
  source: number;
}

export const SOUNDS: Sound[] = [
  { id: 'rain', name: 'Soft Rain', subtitle: 'Steady rain on a window', icon: 'rainy', source: require('../../assets/sounds/rain.wav') },
  { id: 'waves', name: 'Ocean Waves', subtitle: 'Slow waves rolling in', icon: 'water', source: require('../../assets/sounds/waves.wav') },
  { id: 'brown', name: 'Deep Focus', subtitle: 'Warm brown noise', icon: 'cloudy-night', source: require('../../assets/sounds/brown.wav') },
];

/** What is loaded in the player: a focus sound or one of your songs. */
export interface NowItem {
  kind: 'sound' | 'track';
  id: string;
  name: string;
  subtitle: string;
}

export interface ImportProgress {
  done: number;
  total: number;
}

interface SoundState {
  current: NowItem;
  playing: boolean;
  /** Play a focus sound (or the current item). */
  play: (id?: string) => void;
  /** Play one of your songs. */
  playTrack: (id: string) => void;
  pause: () => void;
  toggle: () => void;
  /** Next or previous: sounds and songs both wrap round; previous restarts a song a few seconds in. */
  skip: (dir: 1 | -1) => void;
  /** Seconds into the sound or song, and its length, for the progress bar. */
  position: number;
  length: number;
  /** Jump to a point in the current song. */
  seek: (seconds: number) => void;
  /** Started at least once this session, so the mini player shows. */
  started: boolean;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  /** Sounds: play a different one picked at random. Songs: turn the shuffled order on or off. */
  shuffle: () => void;
  shuffleOn: boolean;
  repeatOn: boolean;
  /** The song that plays after this one (none after the last song with repeat off, or for a focus sound). */
  upNext?: string;
  /** Where the current song sits in the queue, counted from 1, and how long the queue is. */
  queuePlace?: { at: number; of: number };
  toggleRepeat: () => void;
  /** Sleep timer in minutes (0 = off); cycling steps through off, 15, 30 and 60. */
  timer: number;
  cycleTimer: () => void;
  /** Songs whose file is not on this phone (listed in a backup from another phone). */
  missing: Set<string>;
  /** Why the current song could not play, in plain words. */
  playError?: string;
  /** Pick songs and copy them into Routine. */
  importMusic: () => void;
  importing: ImportProgress | null;
  /** What went wrong in the last import (one line per file), until the next import or dismissal. */
  importNotes: string[];
  clearImportNotes: () => void;
  removeTrack: (id: string) => void;
  /** Pauses Routine's own sound and hands the link to its app. Resolves to an error message, if it failed. */
  openLink: (link: PlaylistLink) => Promise<string | undefined>;
}

export const TIMER_STEPS = [0, 15, 30, 60];

const SoundContext = createContext<SoundState | null>(null);

type Selection = { kind: 'sound'; index: number } | { kind: 'track'; id: string };

const soundItem = (s: Sound): NowItem => ({ kind: 'sound', id: s.id, name: s.name, subtitle: s.subtitle });
const trackItem = (t: Track): NowItem => ({ kind: 'track', id: t.id, name: t.title, subtitle: 'Your music' });

/** Holds the media controls on Android (needed to keep playing in the background), with the item's name. */
function claimMediaControls(player: AudioPlayer, item: NowItem, active: { current: boolean }) {
  if (Platform.OS === 'web') return;
  const metadata = { title: item.name, artist: item.kind === 'sound' ? 'Routine · Focus sounds' : 'Routine' };
  try {
    if (active.current) player.updateLockScreenMetadata(metadata);
    else {
      player.setActiveForLockScreen(true, metadata);
      active.current = true;
    }
  } catch {
    // Older players without media controls still play in the foreground.
  }
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const { music, updateMusic } = useStore();
  const [sel, setSel] = useState<Selection>({ kind: 'sound', index: 0 });
  const [started, setStarted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [timer, setTimer] = useState(0);
  const [importing, setImporting] = useState<ImportProgress | null>(null);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const player = useAudioPlayer(SOUNDS[0].source, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const controls = useRef(false);

  const tracks = music.tracks;
  const ids = useMemo(() => tracks.map((t) => t.id), [tracks]);
  const currentTrack = sel.kind === 'track' ? tracks.find((t) => t.id === sel.id) : undefined;
  const current: NowItem = currentTrack ? trackItem(currentTrack) : soundItem(SOUNDS[sel.kind === 'sound' ? sel.index : 0]);

  // The shuffled order is made once when shuffle turns on (starting with the song playing), then keeps its
  // order as songs are added (at the end) or removed.
  const [shuffled, setShuffled] = useState<string[]>([]);
  useEffect(() => {
    if (!music.shuffle) return;
    setShuffled((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return kept.length ? [...kept, ...added] : playOrder(ids, sel.kind === 'track' ? sel.id : undefined, true);
    });
    // Only a change in shuffle or in the songs reorders; the selection is read when shuffle turns on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music.shuffle, ids]);
  const order = music.shuffle && shuffled.length === ids.length ? shuffled : ids;

  const missing = useMemo(() => new Set(tracks.filter((t) => !hasFile(t.uri)).map((t) => t.id)), [tracks]);

  useEffect(() => {
    setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true, interruptionMode: 'doNotMix' }).catch(() => {});
    player.loop = true;
  }, [player]);

  const load = useCallback(
    (next: Selection, source: AudioSource, item: NowItem, thenPlay: boolean) => {
      const same =
        next.kind === sel.kind &&
        (next.kind === 'sound' ? next.index === (sel as { index: number }).index : next.id === (sel as { id: string }).id);
      if (!same) {
        player.replace(source);
        setSel(next);
      }
      // Focus sounds loop; songs end and the queue moves on.
      player.loop = next.kind === 'sound';
      if (thenPlay) {
        player.play();
        setStarted(true);
        claimMediaControls(player, item, controls);
      } else if (!same && controls.current) claimMediaControls(player, item, controls);
    },
    [sel, player],
  );

  const selectSound = useCallback(
    (i: number, thenPlay: boolean) => {
      const index = (i + SOUNDS.length) % SOUNDS.length;
      load({ kind: 'sound', index }, SOUNDS[index].source, soundItem(SOUNDS[index]), thenPlay);
    },
    [load],
  );

  const selectTrack = useCallback(
    (id: string, thenPlay: boolean) => {
      const t = tracks.find((x) => x.id === id);
      if (!t || missing.has(id)) return;
      load({ kind: 'track', id }, { uri: t.uri }, trackItem(t), thenPlay);
    },
    [tracks, missing, load],
  );

  // When a song ends, play the next one (or stop after the last, unless repeat is on). The listener reads the
  // latest queue through a ref, so it never acts on a stale order.
  const onEnd = useRef<() => void>(() => {});
  onEnd.current = () => {
    if (sel.kind !== 'track') return;
    const next = afterEnd(
      order.filter((id) => !missing.has(id)),
      sel.id,
      music.repeat,
    );
    if (!next) {
      player.pause();
      player.seekTo(0).catch(() => {});
      return;
    }
    if (next === sel.id) {
      player.seekTo(0).catch(() => {});
      player.play();
    } else selectTrack(next, true);
  };
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) onEnd.current();
    });
    return () => sub.remove();
  }, [player]);

  // Learn a song's length the first time it loads, so the list can show it.
  useEffect(() => {
    if (!currentTrack || !status.isLoaded || !(status.duration > 0)) return;
    const d = Math.round(status.duration);
    if (currentTrack.duration === d) return;
    updateMusic((m) => ({ ...m, tracks: m.tracks.map((t) => (t.id === currentTrack.id ? { ...t, duration: d } : t)) }));
  }, [currentTrack, status.isLoaded, status.duration, updateMusic]);

  // If the song playing is removed, fall back to the first focus sound, paused.
  useEffect(() => {
    if (sel.kind === 'track' && !tracks.some((t) => t.id === sel.id)) {
      player.pause();
      player.replace(SOUNDS[0].source);
      player.loop = true;
      setSel({ kind: 'sound', index: 0 });
    }
  }, [sel, tracks, player]);

  // The sleep timer pauses playback when it runs out, then switches itself off.
  useEffect(() => {
    if (!timer) return;
    const id = setTimeout(() => {
      player.pause();
      setTimer(0);
    }, timer * 60_000);
    return () => clearTimeout(id);
  }, [timer, player]);

  const importMusic = useCallback(async () => {
    if (importing) return;
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    } catch {
      setImportNotes(["Couldn't open your files. Try again in a moment."]);
      return;
    }
    if (picked.canceled || !picked.assets?.length) return;
    const assets = picked.assets;
    const notes: string[] = [];
    const added: Track[] = [];
    setImportNotes([]);
    setImporting({ done: 0, total: assets.length });
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (!isAudioFile(a.name, a.mimeType)) {
        notes.push(`“${a.name}” isn't a music file, so it was skipped.`);
      } else {
        const id = newId();
        try {
          const uri = await keepCopy(a.uri, storedFileName(id, a.name));
          added.push({ id, title: titleFromFileName(a.name), uri, addedAt: new Date().toISOString() });
        } catch {
          notes.push(`“${a.name}” couldn't be copied. Check there's space on your phone, then try again.`);
        }
      }
      setImporting({ done: i + 1, total: assets.length });
    }
    if (added.length) updateMusic((m) => ({ ...m, tracks: [...m.tracks, ...added] }));
    setImportNotes(notes);
    setImporting(null);
  }, [importing, updateMusic]);

  const removeTrack = useCallback(
    (id: string) => {
      const t = tracks.find((x) => x.id === id);
      if (!t) return;
      if (sel.kind === 'track' && sel.id === id) player.pause();
      updateMusic((m) => ({ ...m, tracks: m.tracks.filter((x) => x.id !== id) }));
      deleteCopy(t.uri);
    },
    [tracks, sel, player, updateMusic],
  );

  const openLink = useCallback(
    async (link: PlaylistLink) => {
      player.pause();
      try {
        await Linking.openURL(link.url);
        return undefined;
      } catch {
        // A spotify: link on a phone without the app opens on the web instead.
        const web = webFallback(link.url);
        if (web) {
          try {
            await Linking.openURL(web);
            return undefined;
          } catch {
            // Fall through to the message.
          }
        }
        return "Couldn't open that link. Check it opens in your browser, then save it again.";
      }
    },
    [player],
  );

  const playing = status.playing;
  const position = status.currentTime ?? 0;
  const playable = useMemo(() => order.filter((id) => !missing.has(id)), [order, missing]);
  const nextId = sel.kind === 'track' ? afterEnd(playable, sel.id, music.repeat) : undefined;
  const upNext = nextId && nextId !== (sel as { id?: string }).id ? tracks.find((t) => t.id === nextId)?.title : undefined;
  const queuePlace =
    sel.kind === 'track' && playable.includes(sel.id) ? { at: playable.indexOf(sel.id) + 1, of: playable.length } : undefined;
  const value = useMemo<SoundState>(
    () => ({
      current,
      playing,
      play: (id) => {
        if (id)
          return selectSound(
            Math.max(
              0,
              SOUNDS.findIndex((s) => s.id === id),
            ),
            true,
          );
        if (sel.kind === 'track') selectTrack(sel.id, true);
        else selectSound(sel.index, true);
      },
      playTrack: (id) => selectTrack(id, true),
      pause: () => player.pause(),
      toggle: () => {
        if (playing) return player.pause();
        if (sel.kind === 'track') selectTrack(sel.id, true);
        else selectSound(sel.index, true);
      },
      skip: (dir) => {
        if (sel.kind === 'sound') return selectSound(sel.index + dir, playing);
        if (dir === -1 && previousRestarts(position)) {
          player.seekTo(0).catch(() => {});
          return;
        }
        const next = stepIn(playable, sel.id, dir);
        if (next) selectTrack(next, playing);
      },
      position,
      length: status.duration || (sel.kind === 'sound' ? 22 : (currentTrack?.duration ?? 0)),
      seek: (seconds) => {
        player.seekTo(clampSeek(seconds, status.duration || 0)).catch(() => {});
      },
      started,
      sheetOpen,
      setSheetOpen,
      shuffle: () => {
        if (sel.kind === 'sound') return selectSound(otherIndex(sel.index, SOUNDS.length), true);
        setShuffled([]);
        updateMusic((m) => ({ ...m, shuffle: !m.shuffle }));
      },
      shuffleOn: music.shuffle,
      repeatOn: music.repeat,
      upNext,
      queuePlace,
      toggleRepeat: () => updateMusic((m) => ({ ...m, repeat: !m.repeat })),
      timer,
      cycleTimer: () => setTimer((t) => TIMER_STEPS[(TIMER_STEPS.indexOf(t) + 1) % TIMER_STEPS.length]),
      missing,
      playError:
        sel.kind === 'track' && status.error
          ? "This song couldn't be played. The file may be damaged, or in a format this phone can't play."
          : undefined,
      importMusic: () => {
        importMusic();
      },
      importing,
      importNotes,
      clearImportNotes: () => setImportNotes([]),
      removeTrack,
      openLink,
    }),
    // `current` is derived from sel and the songs, which are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sel,
      currentTrack,
      playing,
      position,
      status.duration,
      status.error,
      playable,
      upNext,
      queuePlace?.at,
      queuePlace?.of,
      missing,
      music.shuffle,
      music.repeat,
      selectSound,
      selectTrack,
      player,
      started,
      sheetOpen,
      timer,
      importing,
      importNotes,
      importMusic,
      removeTrack,
      openLink,
      updateMusic,
    ],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSounds(): SoundState {
  const s = useContext(SoundContext);
  if (!s) throw new Error('useSounds must be used inside SoundProvider');
  return s;
}
