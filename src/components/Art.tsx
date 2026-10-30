// Artwork for the glass looks: the rendered light behind every screen, and scenes for cards and focus sounds.
import { Image, StyleSheet } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';

// Rendered backdrops and scenes (made by scripts/render-art.py): real blur, bokeh and film grain.
const BACKDROPS = {
  lavender: require('../../assets/art/lavender-bg.jpg'),
  stone: require('../../assets/art/stone-bg.jpg'),
};
const PORTALS: Record<string, number> = {
  dusk: require('../../assets/art/portal-dusk.jpg'),
  rain: require('../../assets/art/portal-rain.jpg'),
  waves: require('../../assets/art/portal-waves.jpg'),
  brown: require('../../assets/art/portal-brown.jpg'),
};

/** Light and glow behind a whole screen. */
export function Ambience() {
  const { name } = useTheme();
  if (name === 'paper') return null;
  return <Image source={BACKDROPS[name]} style={StyleSheet.absoluteFill} resizeMode="cover" />;
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
  return <Image source={PORTALS[variant ?? 'dusk'] ?? PORTALS.dusk} style={{ width, height }} resizeMode="cover" />;
}
