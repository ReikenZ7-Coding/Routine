// Artwork for every look: the rendered world behind each screen, its pre-blurred lens, the moving light
// layers, Stone's magnolia, the mountain headers, and the scenes for cards and focus sounds. All of it is
// made by scripts/render-art.py; assets/art/looks.json holds the values the renderer, this file and the
// contrast gate (scripts/check-contrast.py) share, so the lens can never drift from Ambience.
import { LinearGradient as Veil } from 'expo-linear-gradient';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import LOOKS_JSON from '../../assets/art/looks.json';
import { type ThemeName, useTheme } from '../theme';

/** How a light layer moves on the look's linear clock p (0..1 per period). Amplitudes are in dp. */
export type LightMotion =
  | { type: 'orbit'; period: number; radius: number; dir: number; phase: number }
  | { type: 'sway'; period: number; dx: number; rotate: number }
  | { type: 'drift'; period: number; ax: number; ay: number; s: number }
  | { type: 'slide'; period: number; x0: number; ax: number };

interface LightSpec {
  name: string;
  /** 'frame' fills the screen frame; otherwise a box in units of the frame width. */
  box: 'frame' | { w: number; h: number };
  anchor?: 'top';
  opacity?: number;
  motion: LightMotion;
}

interface LookArt {
  scrim: string;
  topVeil: [string, string];
  /** Where the top veil ends, as a fraction of the frame height. */
  veilEnd: number;
  lensSaturation: number;
  lights: LightSpec[];
  header?: { file: string; ratio: number; blur?: string };
}

const LOOKS = LOOKS_JSON.looks as unknown as Record<ThemeName, LookArt>;

/** Scrim, top veil and veil end per look, exactly as baked into each lens image. */
export const AMBIENCE: Record<ThemeName, Pick<LookArt, 'scrim' | 'topVeil' | 'veilEnd'>> = LOOKS;

// The sharp world behind every screen (1080x2340).
const BACKDROPS: Record<ThemeName, ImageSourcePropType> = {
  lavender: require('../../assets/art/lavender-bg.jpg'),
  stone: require('../../assets/art/stone-bg.jpg'),
  paper: require('../../assets/art/paper-bg.jpg'),
  pine: require('../../assets/art/pine-bg.jpg'),
};

/** The lens: the world with its scrim and veil, blurred (sigma 24 at 540x1170). Glass shows the slice of it
 *  that lies behind the surface, sized and placed exactly like Ambience. */
export const BLURRED: Record<ThemeName, ImageSourcePropType> = {
  lavender: require('../../assets/art/lavender-bg-blur.jpg'),
  stone: require('../../assets/art/stone-bg-blur.jpg'),
  paper: require('../../assets/art/paper-bg-blur.jpg'),
  pine: require('../../assets/art/pine-bg-blur.jpg'),
};

const LIGHT_SOURCES: Record<string, ImageSourcePropType> = {
  'lavender-orb-pink': require('../../assets/art/lavender-orb-pink.png'),
  'lavender-orb-blue': require('../../assets/art/lavender-orb-blue.png'),
  'stone-light-beam': require('../../assets/art/stone-light-beam.png'),
  'paper-light-sun': require('../../assets/art/paper-light-sun.png'),
  'paper-mist': require('../../assets/art/paper-mist.png'),
  'pine-light-moon': require('../../assets/art/pine-light-moon.png'),
};

export interface Light extends LightSpec {
  source: ImageSourcePropType;
}

/** The moving light of each look (drawn by LightField over the world, and caught by glass). */
export const LIGHTS: Record<ThemeName, Light[]> = Object.fromEntries(
  (Object.keys(LOOKS) as ThemeName[]).map((look) => [
    look,
    LOOKS[look].lights.map((spec) => ({ ...spec, source: LIGHT_SOURCES[spec.name] })),
  ]),
) as Record<ThemeName, Light[]>;

/** A light layer's resting box inside a frame of the given size (before its motion is applied). */
export function lightBox(light: LightSpec, frameW: number, frameH: number) {
  if (light.box === 'frame') return { left: 0, top: 0, width: frameW, height: frameH };
  const width = light.box.w * frameW;
  const height = light.box.h * frameW;
  const top = light.anchor === 'top' ? 0 : (frameH - height) / 2;
  return { left: (frameW - width) / 2, top, width, height };
}

/** Stone's magnolia: the sharp flower, its frosted copy for inside glass, and the open bloom for a done day. */
export const MAGNOLIA = {
  closed: require('../../assets/art/stone-magnolia.png') as ImageSourcePropType,
  blur: require('../../assets/art/stone-magnolia-blur.png') as ImageSourcePropType,
  open: require('../../assets/art/stone-magnolia-open.png') as ImageSourcePropType,
};
/** Height over width of the magnolia images (420x700). */
export const MAGNOLIA_RATIO = 700 / 420;

/** Stone's satin grain, a 128x128 tile. */
export const GLASS_GRAIN: ImageSourcePropType = require('../../assets/art/glass-grain.png');

// Misty ridges and pines behind the Today header on the trail looks. They fade into the world on their own.
const HEADERS: Partial<Record<ThemeName, ImageSourcePropType>> = {
  paper: require('../../assets/art/paper-header.png'),
  pine: require('../../assets/art/pine-header.png'),
};
/** Paper's header as glass sees it: blurred like the lens, for cards that overlap it. */
export const HEADER_BLURS: Partial<Record<ThemeName, ImageSourcePropType>> = {
  paper: require('../../assets/art/paper-header-blur.png'),
};

type Variant = 'calm' | 'rain' | 'waves' | 'brown' | 'dusk' | 'focus';

// Scenes for SceneArt and Now Playing, one set per look. Every look answers every variant, so a routine's
// tile or a sound's art never falls back to another look's world.
const SCENES: Record<ThemeName, Record<Variant, ImageSourcePropType>> = {
  lavender: {
    calm: require('../../assets/art/portal-dusk.jpg'),
    dusk: require('../../assets/art/portal-dusk.jpg'),
    rain: require('../../assets/art/portal-rain.jpg'),
    waves: require('../../assets/art/portal-waves.jpg'),
    brown: require('../../assets/art/portal-brown.jpg'),
    focus: require('../../assets/art/portal-brown.jpg'),
  },
  stone: {
    calm: require('../../assets/art/stones-calm.jpg'),
    dusk: require('../../assets/art/stones-calm.jpg'),
    rain: require('../../assets/art/stones-rain.jpg'),
    waves: require('../../assets/art/stones-waves.jpg'),
    brown: require('../../assets/art/stones-brown.jpg'),
    focus: require('../../assets/art/stones-brown.jpg'),
  },
  paper: {
    calm: require('../../assets/art/paper-waves.jpg'),
    dusk: require('../../assets/art/paper-focus.jpg'),
    rain: require('../../assets/art/paper-rain.jpg'),
    waves: require('../../assets/art/paper-waves.jpg'),
    brown: require('../../assets/art/paper-focus.jpg'),
    focus: require('../../assets/art/paper-focus.jpg'),
  },
  pine: {
    calm: require('../../assets/art/pine-dusk.jpg'),
    dusk: require('../../assets/art/pine-dusk.jpg'),
    rain: require('../../assets/art/pine-rain.jpg'),
    waves: require('../../assets/art/pine-waves.jpg'),
    brown: require('../../assets/art/pine-brown.jpg'),
    focus: require('../../assets/art/pine-brown.jpg'),
  },
};

/** The scene image for a look and variant (unknown variants get the look's calm scene). */
export function sceneFor(look: ThemeName, variant?: string): ImageSourcePropType {
  const set = SCENES[look] ?? SCENES.lavender;
  return set[(variant ?? 'calm') as Variant] ?? set.calm;
}

/** Mountains in mist at the top of a page; `width` is the screen width and it sits flush to the top edge. */
export function HeaderScene({ width }: { width: number }) {
  const { name } = useTheme();
  const source = HEADERS[name];
  const header = LOOKS[name].header;
  if (!source || !header) return null;
  return (
    <Image
      source={source}
      style={{ position: 'absolute', top: 0, left: 0, width, height: Math.round(width * header.ratio) }}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  );
}

/** The world behind a whole screen: the backdrop, the scrim and the top veil (also baked into the lens). */
export function Ambience() {
  const { name } = useTheme();
  const art = LOOKS[name];
  return (
    <>
      <Image source={BACKDROPS[name]} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: art.scrim }]} />
      <Veil colors={art.topVeil} start={{ x: 0, y: 0 }} end={{ x: 0, y: art.veilEnd }} style={StyleSheet.absoluteFill} />
    </>
  );
}

/** Stone's magnolia at a given width (the Stone stage places it behind the hero glass). */
export function Magnolia({ width, open = false }: { width: number; open?: boolean }) {
  return (
    <Image
      source={open ? MAGNOLIA.open : MAGNOLIA.closed}
      style={{ width, height: Math.round(width * MAGNOLIA_RATIO) }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Artwork for the active look. */
export function SceneArt({ width, height, variant }: { width: number; height: number; variant?: string }) {
  const { name } = useTheme();
  return <Image source={sceneFor(name, variant)} style={{ width, height }} resizeMode="cover" accessibilityIgnoresInvertColors />;
}
