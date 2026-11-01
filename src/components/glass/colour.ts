// Small colour helpers for the glass layers.

const RGBA = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/;

function parse(c: string): [number, number, number, number] | null {
  const m = RGBA.exec(c);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, hex[2] ? parseInt(hex[2], 16) / 255 : 1];
  }
  return null;
}

/** The same colour at zero alpha. Gradients fade to this rather than to 'transparent' (transparent black),
 *  so no platform draws a grey fringe where the colour runs out. */
export function clearOf(c: string): string {
  const p = parse(c);
  return p ? `rgba(${p[0]},${p[1]},${p[2]},0)` : 'transparent';
}

/** The colour with its alpha raised by `by` (capped at 1). */
export function thicker(c: string, by: number): string {
  const p = parse(c);
  return p ? `rgba(${p[0]},${p[1]},${p[2]},${Math.min(1, p[3] + by).toFixed(3)})` : c;
}

/** A gradient string with every 'transparent' stop replaced by its first colour at zero alpha. */
export function softenGradient(g: string): string {
  const first = RGBA.exec(g);
  return first ? g.replace(/\btransparent\b/g, clearOf(first[0])) : g;
}
