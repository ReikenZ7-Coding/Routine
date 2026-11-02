// Turns a day's routines (and phone events) into a timeline: timed entries in order, the rest "anytime".
import { type Routine, isDoneOn, isSkipped } from './routines.ts';

export interface TimedEntry {
  id: string;
  routine?: Routine;
  title: string;
  start: number; // minutes since midnight
  end: number;
  /** Read-only phone calendar event. */
  event?: { color?: string };
}

export function parseClock(text: string | undefined): number | undefined {
  const m = text?.trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : undefined;
}

export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatSpan(start: number, end: number): string {
  const len = end - start;
  const nice = len >= 60 ? `${Math.floor(len / 60)} h${len % 60 ? ` ${len % 60} min` : ''}` : `${len} min`;
  return `${clock(start)} – ${clock(end)} (${nice})`;
}

export function timedRoutines(routines: Routine[]): { timed: TimedEntry[]; anytime: Routine[] } {
  const timed: TimedEntry[] = [];
  const anytime: Routine[] = [];
  for (const r of routines) {
    const start = parseClock(r.start);
    if (start === undefined) anytime.push(r);
    else timed.push({ id: r.id, routine: r, title: r.name, start, end: start + Math.max(5, r.duration ?? 15) });
  }
  return { timed: timed.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title)), anytime };
}

/** What's happening now, or next, among today's unfinished timed routines. */
export function upNext(
  entries: TimedEntry[],
  date: string,
  now: number,
): { entry: TimedEntry; state: 'now' | 'next'; minutes: number } | undefined {
  const open = entries.filter((e) => e.routine && !isDoneOn(e.routine, date) && !isSkipped(e.routine, date));
  const current = open.find((e) => e.start <= now && now < e.end);
  if (current) return { entry: current, state: 'now', minutes: current.end - now };
  const next = open.find((e) => e.start > now);
  if (next) return { entry: next, state: 'next', minutes: next.start - now };
  return undefined;
}

/**
 * Side-by-side places for entries that overlap in time (the desktop week's blocks): each entry gets a lane, and
 * every entry in a cluster of overlapping ones shares the cluster's lane count, so their widths match. Entries are
 * read in the order given; the result lines up with it.
 */
export function laneOut(entries: { start: number; end: number }[]): { lane: number; lanes: number }[] {
  const order = entries.map((e, i) => ({ ...e, i })).sort((a, b) => a.start - b.start || b.end - a.end);
  const out: { lane: number; lanes: number }[] = entries.map(() => ({ lane: 0, lanes: 1 }));
  let cluster: typeof order = [];
  let laneEnds: number[] = [];
  let clusterEnd = 0;
  const close = () => {
    for (const e of cluster) out[e.i].lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const e of order) {
    if (cluster.length && e.start >= clusterEnd) close();
    clusterEnd = cluster.length ? Math.max(clusterEnd, e.end) : e.end;
    let lane = laneEnds.findIndex((end) => end <= e.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(e.end);
    } else laneEnds[lane] = e.end;
    out[e.i].lane = lane;
    cluster.push(e);
  }
  close();
  return out;
}
