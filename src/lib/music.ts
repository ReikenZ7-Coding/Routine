// Your own music and saved playlist links. Pure logic only (no React Native), so it can be tested in Node.
//
// Saved under routine.music.v1. Imported songs are copied into the app's own folder; this state holds their
// details (the audio itself never goes into the JSON backup). Playlist links are plain share links that open
// in the app they belong to: there is no streaming, sign-in or API here.

export interface Track {
  id: string;
  /** Shown name: the file name without its extension, until the person renames it. */
  title: string;
  /** Where the copy lives (file:// on a phone; a blob: URL on the web, which lasts only for the session). */
  uri: string;
  /** ISO time it was imported. */
  addedAt: string;
  /** Length in seconds, once the player has read it. */
  duration?: number;
}

export interface PlaylistLink {
  id: string;
  name: string;
  url: string;
  addedAt: string;
}

export interface MusicState {
  tracks: Track[];
  links: PlaylistLink[];
  /** After the last song, start again from the first. */
  repeat: boolean;
  /** Play your songs in a shuffled order. */
  shuffle: boolean;
}

export const EMPTY_MUSIC: MusicState = { tracks: [], links: [], repeat: false, shuffle: false };

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Reads whatever was saved (or nothing at all) as the current shape. Bad entries are dropped, never thrown. */
export function upgradeMusicState(raw: unknown): MusicState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_MUSIC, tracks: [], links: [] };
  const r = raw as Record<string, unknown>;
  const tracks = (Array.isArray(r.tracks) ? r.tracks : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object' && str(t.id) && str(t.uri))
    .map((t) => ({
      id: t.id as string,
      title: str(t.title) ? t.title : 'Untitled song',
      uri: t.uri as string,
      addedAt: str(t.addedAt) ? t.addedAt : new Date(0).toISOString(),
      ...(typeof t.duration === 'number' && t.duration > 0 ? { duration: t.duration } : null),
    }));
  const links = (Array.isArray(r.links) ? r.links : [])
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object' && str(l.id) && str(l.url))
    .map((l) => ({
      id: l.id as string,
      name: str(l.name) ? l.name : serviceLabel(detectService(l.url as string)),
      url: l.url as string,
      addedAt: str(l.addedAt) ? l.addedAt : new Date(0).toISOString(),
    }));
  return { tracks, links, repeat: r.repeat === true, shuffle: r.shuffle === true };
}

/** A web import points at a blob: URL that dies with the page, so it is never saved. */
export const isSessionOnly = (t: Track) => t.uri.startsWith('blob:');

/** What gets written to storage and into a backup: details only, and no session-only songs. */
export function musicToSave(m: MusicState): MusicState {
  return { ...m, tracks: m.tracks.filter((t) => !isSessionOnly(t)) };
}

/**
 * Restoring a backup. Links and the repeat and shuffle choices come from the backup. Songs already on this phone
 * stay (their files are here), and the backup's songs are added after them, so nothing on the phone is lost. An
 * older backup with no music part leaves the music as it is.
 */
export function mergeRestoredMusic(current: MusicState, backup: unknown): MusicState {
  if (backup === undefined || backup === null) return current;
  const b = upgradeMusicState(backup);
  const have = new Set(current.tracks.map((t) => t.id));
  return { ...b, tracks: [...current.tracks, ...b.tracks.filter((t) => !have.has(t.id))] };
}

// ---- Importing ----

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'amr', 'mid', 'midi', 'weba', '3gp', 'mka'];

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/**
 * The picker's filter. Android reports some music as an application type (OGG and OPUS as application/ogg,
 * FLAC as application/x-flac), so those are offered too.
 */
export const PICKER_TYPES = ['audio/*', 'application/ogg', 'application/x-ogg', 'application/x-flac', 'application/flac'];

/**
 * Whether a picked file is something the player can try: an audio type, or a known audio extension. Either is
 * enough, because phones label the same file differently (song.ogg as application/ogg, voice.m4a with no type).
 */
export function isAudioFile(name: string, mimeType?: string | null): boolean {
  if (mimeType && mimeType.startsWith('audio/')) return true;
  return AUDIO_EXTENSIONS.includes(extensionOf(name));
}

/** "Morning_walk-02.mp3" -> "Morning walk-02". */
export function titleFromFileName(name: string): string {
  const base = extensionOf(name) ? name.slice(0, name.lastIndexOf('.')) : name;
  const title = base.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return title || 'Untitled song';
}

/** The copy's file name: the track's id, keeping the extension so the player knows the format. */
export function storedFileName(id: string, name: string): string {
  const ext = extensionOf(name);
  return ext && /^[a-z0-9]{1,5}$/.test(ext) ? `${id}.${ext}` : id;
}

// ---- The queue ----

/**
 * The order songs play in: the library order, or with shuffle a random order that starts with the current
 * song (so turning shuffle on never jumps away from what is playing).
 */
export function playOrder(ids: string[], currentId: string | undefined, shuffle: boolean, rand: () => number = Math.random): string[] {
  if (!shuffle) return [...ids];
  const rest = ids.filter((id) => id !== currentId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return currentId && ids.includes(currentId) ? [currentId, ...rest] : rest;
}

/** Next or previous by hand: always moves, wrapping round at either end. */
export function stepIn(order: string[], currentId: string, dir: 1 | -1): string | undefined {
  if (!order.length) return undefined;
  const i = order.indexOf(currentId);
  if (i < 0) return order[0];
  return order[(i + dir + order.length) % order.length];
}

/** When a song ends: the next one, back to the first with repeat on, or nothing (stop) after the last. */
export function afterEnd(order: string[], currentId: string, repeat: boolean): string | undefined {
  const i = order.indexOf(currentId);
  if (i < 0) return order[0];
  if (i < order.length - 1) return order[i + 1];
  return repeat ? order[0] : undefined;
}

/** Previous restarts the song when it is more than a few seconds in, as music players do. */
export const PREVIOUS_RESTARTS_AFTER = 3;
export const previousRestarts = (position: number) => position > PREVIOUS_RESTARTS_AFTER;

/** A random index other than `current` (when there is more than one to choose from). */
export function otherIndex(current: number, length: number, rand: () => number = Math.random): number {
  if (length <= 1) return 0;
  return (current + 1 + Math.floor(rand() * (length - 1))) % length;
}

/** Keeps a seek inside the song. */
export function clampSeek(seconds: number, length: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return length > 0 ? Math.min(seconds, length) : seconds;
}

// ---- Loading ----

/** What is known after the player is handed a new source, until its own first status arrives. */
export interface LoadWatch {
  /** The previous source's length, which the player's status still reports for a moment. */
  before: number;
  /** Whether a status update has said "not loaded" since the replace (the player has let go of the old source). */
  sawUnloaded: boolean;
  /**
   * The player sends nothing more for the old source once replaced, so its first loaded update is the new one's
   * (the web player, which drops the old element and its listeners). On Android, updates already on their way
   * can still arrive, but the player always passes through "not loaded" while it prepares the new source.
   */
  firstIsNew?: boolean;
}

export interface StatusLike {
  isLoaded: boolean;
  duration: number;
  error?: string | null;
}

/**
 * Reads one status update after a replace. "fresh" once it describes the new source: loaded with a length, and
 * either after an unloaded update, with a length other than the old source's, or on a player whose first update
 * is always the new source's. A failed load is never fresh, so the old length is never saved onto the new song.
 */
export function watchLoad(w: LoadWatch, s: StatusLike): LoadWatch | 'fresh' {
  if (s.error) return { ...w, sawUnloaded: true, firstIsNew: false };
  if (!s.isLoaded) return w.sawUnloaded ? w : { ...w, sawUnloaded: true };
  if (s.duration > 0 && (w.sawUnloaded || w.firstIsNew || s.duration !== w.before)) return 'fresh';
  return w;
}

// ---- Playlist links ----

export type Service = 'spotify' | 'youtube-music' | 'youtube' | 'link';

const SERVICE_LABEL: Record<Service, string> = { spotify: 'Spotify', 'youtube-music': 'YouTube Music', youtube: 'YouTube', link: 'Link' };
export const serviceLabel = (s: Service) => SERVICE_LABEL[s];

function hostOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  if (!m) return '';
  return m[1]
    .replace(/^[^@]*@/, '')
    .replace(/:\d+$/, '')
    .toLowerCase();
}

const isHost = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Which service a link belongs to, from its address. */
export function detectService(url: string): Service {
  const u = url.trim();
  if (/^spotify:/i.test(u)) return 'spotify';
  const host = hostOf(u);
  if (isHost(host, 'spotify.com') || host === 'spotify.link') return 'spotify';
  if (isHost(host, 'music.youtube.com')) return 'youtube-music';
  if (isHost(host, 'youtube.com') || host === 'youtu.be') return 'youtube';
  return 'link';
}

/**
 * Checks a pasted link. Accepts web links (adding https:// when it was left off) and spotify: links. Returns the
 * link to save, or a plain-words reason it can't be used.
 */
export function checkLink(input: string): { url: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: 'Paste a link to a playlist or album.' };
  if (/\s/.test(raw)) return { error: "That link has spaces in it. Copy it again from the app's Share button." };
  if (/^spotify:[a-z]+:[A-Za-z0-9]+/i.test(raw)) return { url: raw };
  let url = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  if (!/^https?:\/\//i.test(url)) return { error: 'Use a web link that starts with https://.' };
  const host = hostOf(url);
  if (!host || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) || /^\d+(\.\d+)+$/.test(host)) {
    return { error: "That doesn't look like a web link. Try copying it again." };
  }
  return { url };
}

/** A name for a link the person didn't name. */
export const defaultLinkName = (url: string) => {
  const s = detectService(url);
  return s === 'link' ? hostOf(url).replace(/^www\./, '') || 'Playlist' : `${serviceLabel(s)} playlist`;
};

/** "3:07", or "1:02:09" for an hour or more. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The web address for a spotify: link, for phones without the app (other links are already web links). */
export function webFallback(url: string): string | undefined {
  const m = /^spotify:([a-z]+):([A-Za-z0-9]+)/i.exec(url.trim());
  return m ? `https://open.spotify.com/${m[1].toLowerCase()}/${m[2]}` : undefined;
}
