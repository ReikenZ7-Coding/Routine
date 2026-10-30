// Drawn artwork for the glass looks: the light and glow behind every screen, and small
// scenes for cards and focus sounds. All vector, so it is sharp on any phone and adds no image files.
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

/** A soft glowing orb: colour in the middle, fading to nothing. */
function Orb({ id, cx, cy, r, color, opacity }: { id: string; cx: number; cy: number; r: number; color: string; opacity: number }) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.45} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </>
  );
}

/** A four-point sparkle. */
function Sparkle({ x, y, s, opacity = 0.9 }: { x: number; y: number; s: number; opacity?: number }) {
  const d = `M${x} ${y - s} Q${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} Q${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} Q${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} Q${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z`;
  return <Path d={d} fill="#FFFFFF" opacity={opacity} />;
}

/** Light and glow behind a whole screen. */
export function Ambience() {
  const { name } = useTheme();
  const { width, height } = useWindowDimensions();
  if (name === 'paper') return null;
  const h = (height / width) * 100;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 100 ${h}`} preserveAspectRatio="xMidYMid slice">
        {name === 'lavender' ? <LavenderSky h={h} /> : <StoneLight h={h} />}
      </Svg>
    </View>
  );
}

function LavenderSky({ h }: { h: number }) {
  return (
    <>
      <Defs>
        <LinearGradient id="lvBase" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor="#B7AEF6" />
          <Stop offset="0.5" stopColor="#968CEB" />
          <Stop offset="1" stopColor="#A493EC" />
        </LinearGradient>
        <LinearGradient id="lvBeam" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.22" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height={h} fill="url(#lvBase)" />
      <Orb id="lv1" cx={92} cy={14} r={48} color="#FFB8F0" opacity={0.85} />
      <Orb id="lv2" cx={-4} cy={h * 0.42} r={52} color="#7FA2FF" opacity={0.7} />
      <Orb id="lv3" cx={78} cy={h * 0.78} r={62} color="#6A4BEA" opacity={0.55} />
      <Orb id="lv4" cx={18} cy={8} r={26} color="#FFE3FA" opacity={0.55} />
      <Orb id="lv5" cx={40} cy={h * 0.98} r={40} color="#F59BDB" opacity={0.45} />
      <G rotation={-28} origin={`50, ${h * 0.3}`}>
        <Rect x="-40" y={h * 0.27} width="180" height="16" fill="url(#lvBeam)" />
        <Rect x="-40" y={h * 0.34} width="180" height="5" fill="url(#lvBeam)" />
      </G>
      <Sparkle x={84} y={9} s={1.6} />
      <Sparkle x={12} y={h * 0.36} s={1} opacity={0.7} />
      <Sparkle x={90} y={h * 0.55} s={1.2} opacity={0.6} />
      {[
        [70, 5, 0.35], [55, 12, 0.25], [8, 20, 0.3], [94, 30, 0.3], [30, h * 0.6, 0.3], [62, h * 0.66, 0.25], [6, h * 0.8, 0.35],
      ].map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.75} />
      ))}
    </>
  );
}

function StoneLight({ h }: { h: number }) {
  return (
    <>
      <Defs>
        <LinearGradient id="stBase" x1="0" y1="0" x2="0.7" y2="1">
          <Stop offset="0" stopColor="#68664F" />
          <Stop offset="0.45" stopColor="#45443A" />
          <Stop offset="1" stopColor="#23231D" />
        </LinearGradient>
        <LinearGradient id="stBeam" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFF3D2" stopOpacity="0" />
          <Stop offset="0.5" stopColor="#FFF3D2" stopOpacity="0.2" />
          <Stop offset="1" stopColor="#FFF3D2" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height={h} fill="url(#stBase)" />
      <Orb id="st1" cx={8} cy={-6} r={70} color="#F6E9C6" opacity={0.42} />
      <Orb id="st2" cx={96} cy={h * 0.35} r={40} color="#B9C29A" opacity={0.22} />
      <Orb id="st3" cx={50} cy={h * 1.05} r={60} color="#0E0E0A" opacity={0.6} />
      <G rotation={38} origin={`20, 0`}>
        <Rect x="-30" y="-6" width="200" height="22" fill="url(#stBeam)" />
        <Rect x="-30" y="22" width="200" height="9" fill="url(#stBeam)" />
        <Rect x="-30" y="40" width="200" height="4" fill="url(#stBeam)" />
      </G>
    </>
  );
}

/** A soft white magnolia with leaves (Stone look decoration). */
export function Bloom({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 1.6} viewBox="0 0 100 160">
      <Defs>
        <RadialGradient id="petal" cx="40%" cy="30%" r="80%">
          <Stop offset="0" stopColor="#FFFEF8" />
          <Stop offset="0.6" stopColor="#ECE6D2" />
          <Stop offset="1" stopColor="#B9B39C" />
        </RadialGradient>
        <LinearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7F8C5C" />
          <Stop offset="1" stopColor="#3C4529" />
        </LinearGradient>
      </Defs>
      <Path d="M52 70 C50 100 58 125 54 160" stroke="#4A5233" strokeWidth="2.2" fill="none" />
      <Path d="M54 112 C70 98 88 100 96 108 C82 118 66 120 54 112Z" fill="url(#leaf)" opacity="0.9" />
      <Path d="M53 132 C38 118 20 120 10 128 C24 140 42 140 53 132Z" fill="url(#leaf)" opacity="0.8" />
      <Path d="M52 92 C64 80 78 80 86 86 C76 96 62 98 52 92Z" fill="url(#leaf)" opacity="0.75" />
      <G>
        <Path d="M50 72 C30 70 22 50 30 30 C40 38 50 52 50 72Z" fill="url(#petal)" />
        <Path d="M50 72 C70 70 78 50 70 30 C60 38 50 52 50 72Z" fill="url(#petal)" />
        <Path d="M50 72 C38 60 36 34 50 14 C64 34 62 60 50 72Z" fill="url(#petal)" />
        <Path d="M50 72 C40 66 34 52 40 38 C46 48 50 60 50 72Z" fill="#FFFFFF" opacity="0.55" />
        <Path d="M42 70 C46 76 54 76 58 70 C56 74 44 74 42 70Z" fill="#9AA06E" opacity="0.8" />
      </G>
    </Svg>
  );
}

const PORTAL_PALETTES: Record<string, [string, string, string, string]> = {
  // sky top, sky mid, horizon, ring glow
  dusk: ['#2A1A63', '#7D49C8', '#F49AD2', '#FFD3F6'],
  rain: ['#16224F', '#3C5BB8', '#8FB6F2', '#D6E6FF'],
  waves: ['#2A1858', '#A34BB7', '#FFA9C4', '#FFE0EC'],
  brown: ['#2B1A3E', '#8A4A6E', '#F1B07A', '#FFE4C2'],
};

/** A glowing ring over still water, with a small figure: the Lavender look's artwork. */
export function PortalArt({ width, height, palette = 'dusk', figure = true }: { width: number; height: number; palette?: string; figure?: boolean }) {
  const [top, mid, horizon, glow] = PORTAL_PALETTES[palette] ?? PORTAL_PALETTES.dusk;
  const id = `p-${palette}`;
  const w = 100;
  const h = (height / width) * 100;
  const hz = h * 0.66;
  const cx = w * 0.62;
  const r = Math.min(w, h) * 0.3;
  const cy = hz - r * 0.55;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="0.55" stopColor={mid} />
          <Stop offset="1" stopColor={horizon} />
        </LinearGradient>
        <LinearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={horizon} stopOpacity="0.9" />
          <Stop offset="0.4" stopColor={mid} />
          <Stop offset="1" stopColor={top} />
        </LinearGradient>
        <RadialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <Stop offset="0.55" stopColor={glow} stopOpacity="0" />
          <Stop offset="0.72" stopColor={glow} stopOpacity="0.55" />
          <Stop offset="1" stopColor={glow} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={`${id}-sun`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={glow} stopOpacity="0.6" />
          <Stop offset="1" stopColor={glow} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={w} height={hz} fill={`url(#${id}-sky)`} />
      <Rect x="0" y={hz} width={w} height={h - hz} fill={`url(#${id}-sea)`} />
      {[[12, 8], [24, 16], [8, 26], [40, 6], [88, 10], [80, 22], [30, 30]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={(y / 40) * hz} r={0.5} fill="#FFFFFF" opacity={0.8} />
      ))}
      <Circle cx={cx} cy={hz} r={r * 1.6} fill={`url(#${id}-sun)`} />
      <Circle cx={cx} cy={cy} r={r * 1.45} fill={`url(#${id}-halo)`} />
      <Circle cx={cx} cy={cy} r={r} stroke={glow} strokeWidth={r * 0.16} fill="none" opacity={0.25} />
      <Circle cx={cx} cy={cy} r={r} stroke={glow} strokeWidth={r * 0.06} fill="none" opacity={0.7} />
      <Circle cx={cx} cy={cy} r={r} stroke="#FFFFFF" strokeWidth={r * 0.022} fill="none" />
      {/* reflection */}
      <Ellipse cx={cx} cy={hz + (hz - cy) * 0.5} rx={r} ry={r * 0.35} stroke={glow} strokeWidth={r * 0.05} fill="none" opacity={0.35} />
      <Rect x={cx - r * 0.9} y={hz + 0.6} width={r * 1.8} height={0.5} fill="#FFFFFF" opacity={0.5} />
      <Rect x={cx - r * 0.6} y={hz + 2.2} width={r * 1.2} height={0.4} fill="#FFFFFF" opacity={0.35} />
      {figure && (
        <G>
          <Ellipse cx={cx} cy={hz + 1.6} rx={r * 0.55} ry={r * 0.08} fill="#1A1033" opacity={0.6} />
          <Path d={`M${cx - 1.1} ${hz} L${cx - 0.9} ${hz - 6} L${cx + 0.9} ${hz - 6} L${cx + 1.1} ${hz}Z`} fill="#1A1033" />
          <Circle cx={cx} cy={hz - 7.4} r={1.3} fill="#1A1033" />
        </G>
      )}
    </Svg>
  );
}

const STONE_PALETTES: Record<string, [string, string, string]> = {
  // water light, water dark, stone light
  calm: ['#A9A58E', '#4F4D40', '#C9C1AC'],
  rain: ['#9AA3A0', '#3F4642', '#C3C6BC'],
  waves: ['#A8A891', '#4A4A3A', '#D2C8AE'],
  brown: ['#A89A7E', '#4A3F30', '#CDBB9C'],
};

/** Smooth stones in still water with a silk ribbon: the Stone look's artwork. */
export function StonesArt({ width, height, palette = 'calm' }: { width: number; height: number; palette?: string }) {
  const [light, dark, stone] = STONE_PALETTES[palette] ?? STONE_PALETTES.calm;
  const id = `s-${palette}`;
  const w = 100;
  const h = (height / width) * 100;
  const stoneAt = (cx: number, cy: number, rx: number, ry: number, k: string) => (
    <G key={k}>
      <Ellipse cx={cx} cy={cy + ry * 1.05} rx={rx * 0.95} ry={ry * 0.35} fill="#1D1C16" opacity={0.35} />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}-stone)`} />
      <Ellipse cx={cx - rx * 0.3} cy={cy - ry * 0.45} rx={rx * 0.35} ry={ry * 0.18} fill="#FFFFFF" opacity={0.18} />
    </G>
  );
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id={`${id}-water`} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset="1" stopColor={dark} />
        </LinearGradient>
        <RadialGradient id={`${id}-stone`} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor={stone} />
          <Stop offset="0.55" stopColor="#7B7463" />
          <Stop offset="1" stopColor="#3A372D" />
        </RadialGradient>
        <LinearGradient id={`${id}-silk`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#D8D2C0" stopOpacity="0.75" />
        </LinearGradient>
        <RadialGradient id={`${id}-light`} cx="20%" cy="0%" r="90%">
          <Stop offset="0" stopColor="#FFF6DD" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#FFF6DD" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={w} height={h} fill={`url(#${id}-water)`} />
      {[0.3, 0.45, 0.62, 0.8].map((f, i) => (
        <Ellipse key={i} cx={50} cy={h * f} rx={60 + i * 10} ry={2 + i} stroke="#FFFFFF" strokeWidth={0.25} fill="none" opacity={0.12} />
      ))}
      {stoneAt(78, h * 0.42, 14, h * 0.1, 'a')}
      {stoneAt(40, h * 0.48, 26, h * 0.17, 'b')}
      {stoneAt(62, h * 0.74, 28, h * 0.15, 'c')}
      <Path
        d={`M30 ${h * 0.36} C45 ${h * 0.28} 58 ${h * 0.4} 66 ${h * 0.5} C72 ${h * 0.58} 70 ${h * 0.66} 62 ${h * 0.63} C54 ${h * 0.6} 50 ${h * 0.48} 30 ${h * 0.36}Z`}
        fill={`url(#${id}-silk)`}
      />
      <Path
        d={`M66 ${h * 0.5} C80 ${h * 0.6} 92 ${h * 0.58} 100 ${h * 0.5} L100 ${h * 0.56} C90 ${h * 0.66} 76 ${h * 0.66} 64 ${h * 0.58}Z`}
        fill={`url(#${id}-silk)`}
        opacity={0.7}
      />
      <Rect x="0" y="0" width={w} height={h} fill={`url(#${id}-light)`} />
    </Svg>
  );
}

/** Artwork for the active look. */
export function SceneArt({ width, height, variant }: { width: number; height: number; variant?: string }) {
  const { name } = useTheme();
  if (name === 'stone') return <StonesArt width={width} height={height} palette={variant} />;
  return <PortalArt width={width} height={height} palette={variant} figure={!variant || variant === 'dusk'} />;
}
