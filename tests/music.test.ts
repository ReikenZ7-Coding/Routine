import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup } from '../src/lib/backup.ts';
import {
  EMPTY_MUSIC,
  type MusicState,
  afterEnd,
  checkLink,
  clampSeek,
  clock,
  defaultLinkName,
  detectService,
  isAudioFile,
  mergeRestoredMusic,
  musicToSave,
  otherIndex,
  playOrder,
  previousRestarts,
  serviceLabel,
  stepIn,
  storedFileName,
  titleFromFileName,
  upgradeMusicState,
  webFallback,
} from '../src/lib/music.ts';

const track = (id: string, uri = `file:///data/music/${id}.mp3`) => ({ id, title: id, uri, addedAt: '2026-11-01T10:00:00.000Z' });

/** A repeatable stand-in for Math.random. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

test('a phone with no music saved reads as an empty library', () => {
  assert.deepEqual(upgradeMusicState(null), EMPTY_MUSIC);
  assert.deepEqual(upgradeMusicState(undefined), EMPTY_MUSIC);
  assert.deepEqual(upgradeMusicState('nonsense'), EMPTY_MUSIC);
  assert.deepEqual(upgradeMusicState({}), EMPTY_MUSIC);
});

test('saved music loads unchanged, and broken entries are dropped instead of crashing', () => {
  const saved: MusicState = {
    tracks: [{ ...track('a'), duration: 187 }],
    links: [{ id: 'l1', name: 'Run', url: 'https://open.spotify.com/playlist/37i9', addedAt: '2026-11-01T10:00:00.000Z' }],
    repeat: true,
    shuffle: false,
  };
  assert.deepEqual(upgradeMusicState(JSON.parse(JSON.stringify(saved))), saved);
  const messy = upgradeMusicState({
    tracks: [null, { id: 'x' }, { id: 'b', uri: 'file:///b.mp3' }],
    links: [{ id: 'l', url: 'https://music.youtube.com/playlist?list=1' }],
  });
  assert.equal(messy.tracks.length, 1);
  assert.equal(messy.tracks[0].title, 'Untitled song');
  assert.equal(messy.links[0].name, 'YouTube Music');
  assert.equal(messy.repeat, false);
});

test('songs imported in the browser (blob: links) are never saved or backed up', () => {
  const m: MusicState = { ...EMPTY_MUSIC, tracks: [track('a'), track('b', 'blob:http://localhost/123')] };
  assert.deepEqual(
    musicToSave(m).tracks.map((t) => t.id),
    ['a'],
  );
});

test('the queue plays in library order, wraps by hand, and stops after the last song unless repeat is on', () => {
  const order = playOrder(['a', 'b', 'c'], 'b', false);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(stepIn(order, 'a', 1), 'b');
  assert.equal(stepIn(order, 'c', 1), 'a');
  assert.equal(stepIn(order, 'a', -1), 'c');
  assert.equal(stepIn(order, 'missing', 1), 'a');
  assert.equal(stepIn([], 'a', 1), undefined);
  assert.equal(afterEnd(order, 'a', false), 'b');
  assert.equal(afterEnd(order, 'c', false), undefined);
  assert.equal(afterEnd(order, 'c', true), 'a');
  assert.equal(afterEnd(['a'], 'a', true), 'a');
});

test('shuffle keeps every song once and starts with the one playing', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  for (let seed = 1; seed < 40; seed++) {
    const order = playOrder(ids, 'c', true, seeded(seed));
    assert.equal(order[0], 'c');
    assert.deepEqual([...order].sort(), ids);
    // The next song is never the one that is playing.
    assert.notEqual(afterEnd(order, 'c', false), 'c');
  }
  assert.notDeepEqual(playOrder(ids, 'a', true, seeded(3)), ids);
});

test('shuffling focus sounds never picks the one already playing', () => {
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 50; k++)
      assert.notEqual(
        otherIndex(i, 3, () => k / 50),
        i,
      );
  }
  assert.equal(otherIndex(0, 1), 0);
});

test('previous restarts a song a few seconds in, and seeking stays inside the song', () => {
  assert.equal(previousRestarts(1.5), false);
  assert.equal(previousRestarts(12), true);
  assert.equal(clampSeek(-4, 180), 0);
  assert.equal(clampSeek(500, 180), 180);
  assert.equal(clampSeek(Number.NaN, 180), 0);
  assert.equal(clampSeek(42, 0), 42);
});

test('a file name becomes a song title, and only music files are accepted', () => {
  assert.equal(titleFromFileName('Morning_walk-02.mp3'), 'Morning walk-02');
  assert.equal(titleFromFileName('  Lo-fi   beats.FLAC'), 'Lo-fi beats');
  assert.equal(titleFromFileName('.mp3'), '.mp3');
  assert.equal(titleFromFileName(''), 'Untitled song');
  assert.equal(isAudioFile('song.mp3', 'audio/mpeg'), true);
  assert.equal(isAudioFile('voice.m4a', undefined), true);
  assert.equal(isAudioFile('clip.3gp', 'video/3gpp'), true);
  assert.equal(isAudioFile('notes.pdf', 'application/pdf'), false);
  assert.equal(isAudioFile('photo.jpg', 'image/jpeg'), false);
  assert.equal(isAudioFile('mystery', 'application/octet-stream'), false);
  assert.equal(storedFileName('abc', 'Song.MP3'), 'abc.mp3');
  assert.equal(storedFileName('abc', 'no extension'), 'abc');
});

test('links are recognised by their address', () => {
  assert.equal(detectService('https://open.spotify.com/playlist/37i9dQZF1DX'), 'spotify');
  assert.equal(detectService('spotify:playlist:37i9dQZF1DX'), 'spotify');
  assert.equal(detectService('https://spotify.link/abc'), 'spotify');
  assert.equal(detectService('https://music.youtube.com/playlist?list=PL123'), 'youtube-music');
  assert.equal(detectService('https://www.youtube.com/playlist?list=PL123'), 'youtube');
  assert.equal(detectService('https://m.youtube.com/watch?v=1'), 'youtube');
  assert.equal(detectService('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectService('https://soundcloud.com/someone/sets/x'), 'link');
  // Look-alike hosts are not the real service.
  assert.equal(detectService('https://notspotify.com/playlist/1'), 'link');
  assert.equal(detectService('https://youtube.com.example.org/x'), 'link');
  assert.equal(serviceLabel('youtube-music'), 'YouTube Music');
  assert.equal(defaultLinkName('https://open.spotify.com/playlist/1'), 'Spotify playlist');
  assert.equal(defaultLinkName('https://www.soundcloud.com/x'), 'soundcloud.com');
});

test('pasted links are checked and tidied, with a plain reason when they cannot be used', () => {
  assert.deepEqual(checkLink('  https://open.spotify.com/playlist/1  '), { url: 'https://open.spotify.com/playlist/1' });
  assert.deepEqual(checkLink('music.youtube.com/playlist?list=PL1'), { url: 'https://music.youtube.com/playlist?list=PL1' });
  assert.deepEqual(checkLink('spotify:album:4aawyAB9vmqN3uQ7FjRGTy'), { url: 'spotify:album:4aawyAB9vmqN3uQ7FjRGTy' });
  for (const bad of [
    '',
    '   ',
    'hello there',
    'not a link',
    'ftp://files.example.com/a',
    'javascript:alert(1)',
    'https://localhost',
    'https://192.168.0.1/x',
  ]) {
    const r = checkLink(bad);
    assert.ok('error' in r, `expected an error for ${JSON.stringify(bad)}`);
  }
  assert.equal(webFallback('spotify:playlist:37i9dQ'), 'https://open.spotify.com/playlist/37i9dQ');
  assert.equal(webFallback('https://open.spotify.com/playlist/1'), undefined);
});

test('times read like a music player', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(187.6), '3:07');
  assert.equal(clock(3729), '1:02:09');
});

test('backups carry music details, and an old backup without them still restores', () => {
  const music: MusicState = {
    ...EMPTY_MUSIC,
    tracks: [track('a')],
    links: [{ id: 'l1', name: 'Run', url: 'https://youtu.be/x', addedAt: 'x' }],
  };
  const base = {
    groceries: [],
    gym: { sessions: [], logs: [] },
    chinese: { target: 15, words: [], logs: [] },
    routines: [],
    journal: {},
    inbox: [],
  };
  const parsed = parseBackup(makeBackup({ ...base, music }));
  assert.deepEqual(parsed.music, music);
  const old = JSON.stringify({ app: 'routine', version: 1, exportedAt: 'x', ...base });
  assert.equal(parseBackup(old).music, null);

  // Restoring an old backup leaves the music alone.
  const here: MusicState = { ...EMPTY_MUSIC, tracks: [track('mine')], repeat: true };
  assert.deepEqual(mergeRestoredMusic(here, parseBackup(old).music), here);
  // A new backup brings its links and settings; songs on this phone stay, and the backup's are added once.
  const merged = mergeRestoredMusic({ ...here, tracks: [track('mine'), track('a')] }, music);
  assert.deepEqual(
    merged.tracks.map((t) => t.id),
    ['mine', 'a'],
  );
  assert.deepEqual(merged.links, music.links);
  assert.equal(merged.repeat, false);
});
