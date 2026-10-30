// Built-in focus sounds (made for this app, so they work offline) and one shared player,
// so a sound keeps going while you move between tabs.
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

interface SoundState {
  current: Sound;
  playing: boolean;
  /** Play a sound (or the current one). */
  play: (id?: string) => void;
  pause: () => void;
  toggle: () => void;
  skip: (dir: 1 | -1) => void;
  /** Seconds into the loop and loop length, for the progress bar. */
  position: number;
  length: number;
  /** Started at least once this session, so the mini player shows. */
  started: boolean;
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  /** Play a different sound picked at random. */
  shuffle: () => void;
  /** Sleep timer in minutes (0 = off); cycling steps through off, 15, 30 and 60. */
  timer: number;
  cycleTimer: () => void;
}

export const TIMER_STEPS = [0, 15, 30, 60];

const SoundContext = createContext<SoundState | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [timer, setTimer] = useState(0);
  const player = useAudioPlayer(SOUNDS[0].source);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    player.loop = true;
  }, [player]);

  const select = useCallback(
    (i: number, thenPlay: boolean) => {
      const next = (i + SOUNDS.length) % SOUNDS.length;
      if (next !== index) {
        player.replace(SOUNDS[next].source);
        player.loop = true;
        setIndex(next);
      }
      if (thenPlay) {
        player.play();
        setStarted(true);
      }
    },
    [index, player],
  );

  // The sleep timer pauses the sound when it runs out, then switches itself off.
  useEffect(() => {
    if (!timer) return;
    const id = setTimeout(() => {
      player.pause();
      setTimer(0);
    }, timer * 60_000);
    return () => clearTimeout(id);
  }, [timer, player]);

  const value = useMemo<SoundState>(
    () => ({
      current: SOUNDS[index],
      playing: status.playing,
      play: (id) => select(id ? SOUNDS.findIndex((s) => s.id === id) : index, true),
      pause: () => player.pause(),
      toggle: () => (status.playing ? player.pause() : select(index, true)),
      skip: (dir) => select(index + dir, status.playing),
      position: status.currentTime ?? 0,
      length: status.duration || 22,
      started,
      sheetOpen,
      setSheetOpen,
      shuffle: () => select(index + 1 + Math.floor(Math.random() * (SOUNDS.length - 1)), true),
      timer,
      cycleTimer: () => setTimer((t) => TIMER_STEPS[(TIMER_STEPS.indexOf(t) + 1) % TIMER_STEPS.length]),
    }),
    [index, status.playing, status.currentTime, status.duration, select, player, started, sheetOpen, timer],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSounds(): SoundState {
  const s = useContext(SoundContext);
  if (!s) throw new Error('useSounds must be used inside SoundProvider');
  return s;
}
