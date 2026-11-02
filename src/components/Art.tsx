// Artwork for every look: the rendered world behind each screen, its pre-blurred lens, the moving light
// layers, the mountain headers, and the scenes for cards and focus sounds. All of it is
// made by scripts/render-art.py; assets/art/looks.json holds the values the renderer, this file and the
// contrast gate (scripts/check-contrast.py) share, so the lens can never drift from Ambience.
import { LinearGradient as Veil } from 'expo-linear-gradient';
import { createContext, useContext } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  /** 'frame' fills the screen frame; otherwise a box in units of the frame width. On a wide world, 'world'
   *  fills the world as drawn, and a box is in units of the world's height, centred at `at`. */
  box: 'frame' | 'world' | { w: number; h: number };
  anchor?: 'top';
  /** Wide worlds: the box's centre, as fractions of the world's width and height. */
  at?: [number, number];
  opacity?: number;
  /** Where the light is visible at all, as [x0, y0, x1, y1] fractions of its box (glass culls by it). */
  bounds: [number, number, number, number];
  motion: LightMotion;
}

interface LookArt {
  scrim: string;
  topVeil: [string, string];
  /** Where the top veil ends, as a fraction of the frame height. */
  veilEnd: number;
  lensSaturation: number;
  lights: LightSpec[];
  header?: { file: string; ratio: number; blur?: string; mist?: { file: string; motion: LightMotion } };
  /** Pine: the art inside the canopy slab, drawn at the slab's height and anchored to its bottom right. */
  canopy?: { file: string; ratio: number };
  /** The world drawn again for the desktop shell's wide window. */
  wide: WideArt;
}

interface WideArt {
  /** Where the 16:10 master sits when the window's shape crops it: 0 left or top, 1 right or bottom. */
  anchor: [number, number];
  scrim: string;
  topVeil: [string, string];
  veilEnd: number;
  lensSaturation: number;
  lights: LightSpec[];
}

const LOOKS = LOOKS_JSON.looks as unknown as Record<ThemeName, LookArt>;

/** Scrim, top veil and veil end per look, exactly as baked into each lens image. */
export const AMBIENCE: Record<ThemeName, Pick<LookArt, 'scrim' | 'topVeil' | 'veilEnd'>> = LOOKS;

// The sharp world behind every screen (1080x2340).
export const BACKDROPS: Record<ThemeName, ImageSourcePropType> = {
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
  'stone-light-beam-wide': require('../../assets/art/stone-light-beam-wide.png'),
  'paper-light-sun-wide': require('../../assets/art/paper-light-sun-wide.png'),
  'pine-light-moon-wide': require('../../assets/art/pine-light-moon-wide.png'),
};

export interface Light extends LightSpec {
  source: ImageSourcePropType;
}

/** True inside the desktop shell: Ambience, the lens, the light and the look's crossfade use the wide world. */
export const WideContext = createContext(false);
export const useWide = () => useContext(WideContext);

/** The wide masters (2880x1800) and their lenses (1920x1200, sigma 24). */
export const WIDE_BACKDROPS: Record<ThemeName, ImageSourcePropType> = {
  lavender: require('../../assets/art/lavender-bg-wide.jpg'),
  stone: require('../../assets/art/stone-bg-wide.jpg'),
  paper: require('../../assets/art/paper-bg-wide.jpg'),
  pine: require('../../assets/art/pine-bg-wide.jpg'),
};
export const WIDE_BLURRED: Record<ThemeName, ImageSourcePropType> = {
  lavender: require('../../assets/art/lavender-bg-wide-blur.jpg'),
  stone: require('../../assets/art/stone-bg-wide-blur.jpg'),
  paper: require('../../assets/art/paper-bg-wide-blur.jpg'),
  pine: require('../../assets/art/pine-bg-wide-blur.jpg'),
};

/** Scrim, top veil and veil end of each wide world, as baked into its lens. */
export const WIDE_AMBIENCE: Record<ThemeName, WideArt> = Object.fromEntries(
  (Object.keys(LOOKS) as ThemeName[]).map((look) => [look, LOOKS[look].wide]),
) as Record<ThemeName, WideArt>;

/** The wide master is 16:10. */
const WIDE_RATIO = 1.6;

/** Where the wide world lies in a frame of this size: the master, cover-cropped from the look's anchor. */
export function worldBox(look: ThemeName, frameW: number, frameH: number) {
  const width = Math.max(frameW, frameH * WIDE_RATIO);
  const height = width / WIDE_RATIO;
  const [ax, ay] = LOOKS[look].wide.anchor;
  return { left: (frameW - width) * ax, top: (frameH - height) * ay, width, height };
}

/** The moving light of each wide world. */
export const WIDE_LIGHTS: Record<ThemeName, Light[]> = Object.fromEntries(
  (Object.keys(LOOKS) as ThemeName[]).map((look) => [
    look,
    LOOKS[look].wide.lights.map((spec) => ({ ...spec, source: LIGHT_SOURCES[spec.name] })),
  ]),
) as Record<ThemeName, Light[]>;

/** A wide light layer's resting box in the frame, given where the world lies (worldBox). */
export function wideLightBox(light: LightSpec, world: { left: number; top: number; width: number; height: number }) {
  if (light.box === 'world' || light.box === 'frame') return world;
  const width = light.box.w * world.height;
  const height = light.box.h * world.height;
  const [cx, cy] = light.at ?? [0.5, 0.5];
  return { left: world.left + cx * world.width - width / 2, top: world.top + cy * world.height - height / 2, width, height };
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
  if (light.box === 'frame' || light.box === 'world') return { left: 0, top: 0, width: frameW, height: frameH };
  const width = light.box.w * frameW;
  const height = light.box.h * frameW;
  const top = light.anchor === 'top' ? 0 : (frameH - height) / 2;
  return { left: (frameW - width) / 2, top, width, height };
}

/** Stone's satin grain, a 128x128 tile. */
export const GLASS_GRAIN: ImageSourcePropType = require('../../assets/art/glass-grain.png');

// Granite and spruce behind Paper's Today header. They fade into the world on their own.
const HEADERS: Partial<Record<ThemeName, ImageSourcePropType>> = {
  paper: require('../../assets/art/paper-header.png'),
};

/** Pine's canopy slab art (faceted pines and far ridges, clear sky) and its height over width. */
export const CANOPY_ART: { source: ImageSourcePropType; ratio: number } | undefined = LOOKS.pine.canopy
  ? { source: require('../../assets/art/pine-header.png'), ratio: LOOKS.pine.canopy.ratio }
  : undefined;
/** A look's Today header art (Paper's misty crag), for previews such as the Settings swatches. */
export function headerSource(look: ThemeName): ImageSourcePropType | undefined {
  return HEADERS[look];
}

/** Paper's header as glass sees it: blurred like the lens, for cards that overlap it. */
export const HEADER_BLURS: Partial<Record<ThemeName, ImageSourcePropType>> = {
  paper: require('../../assets/art/paper-header-blur.png'),
};

/** Mist that drifts over the header's rock (Paper), drawn just above the header art, with its motion. */
const HEADER_MIST_SOURCES: Record<string, ImageSourcePropType> = {
  'paper-header-mist': require('../../assets/art/paper-header-mist.png'),
};
export const HEADER_MISTS: Partial<Record<ThemeName, { source: ImageSourcePropType; motion: LightMotion }>> = Object.fromEntries(
  (Object.keys(LOOKS) as ThemeName[])
    .filter((look) => LOOKS[look].header?.mist)
    .map((look) => {
      const mist = LOOKS[look].header!.mist!;
      return [look, { source: HEADER_MIST_SOURCES[mist.file], motion: mist.motion }];
    }),
);

/** Height over width of each look's header art. */
export const HEADER_RATIOS: Partial<Record<ThemeName, number>> = Object.fromEntries(
  (Object.keys(LOOKS) as ThemeName[]).filter((look) => LOOKS[look].header).map((look) => [look, LOOKS[look].header!.ratio]),
);

type Variant = 'calm' | 'rain' | 'waves' | 'brown' | 'dusk' | 'focus';

// Scenes for SceneArt and Now Playing, one set per look. Every look answers every variant, so a routine's
// tile or a sound's art never falls back to another look's world.
const SCENES: Record<ThemeName, Record<Variant, ImageSourcePropType>> = {
  lavender: {
    calm: require('../../assets/art/lavender-dusk.jpg'),
    dusk: require('../../assets/art/lavender-dusk.jpg'),
    rain: require('../../assets/art/lavender-rain.jpg'),
    waves: require('../../assets/art/lavender-waves.jpg'),
    brown: require('../../assets/art/lavender-brown.jpg'),
    focus: require('../../assets/art/lavender-brown.jpg'),
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
  const wide = useWide();
  const art = LOOKS[name];
  if (wide) return <WideAmbience />;
  return (
    <>
      <Image source={BACKDROPS[name]} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: art.scrim }]} />
      <Veil colors={art.topVeil} start={{ x: 0, y: 0 }} end={{ x: 0, y: art.veilEnd }} style={StyleSheet.absoluteFill} />
    </>
  );
}

/** The wide world: the master placed by worldBox, and its scrim and veil over it, exactly as baked into its lens. */
function WideAmbience() {
  const { name } = useTheme();
  const { width, height } = useWindowDimensions();
  const art = LOOKS[name].wide;
  const box = worldBox(name, width, height);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={WIDE_BACKDROPS[name]} style={[styles.abs, box]} resizeMode="stretch" accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: art.scrim }]} />
      <Veil colors={art.topVeil} start={{ x: 0, y: 0 }} end={{ x: 0, y: art.veilEnd }} style={[styles.abs, box]} />
    </View>
  );
}

const styles = StyleSheet.create({ abs: { position: 'absolute' } });

/** Artwork for the active look. */
export function SceneArt({ width, height, variant }: { width: number; height: number; variant?: string }) {
  const { name } = useTheme();
  return <Image source={sceneFor(name, variant)} style={{ width, height }} resizeMode="cover" accessibilityIgnoresInvertColors />;
}
