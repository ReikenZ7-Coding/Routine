// Glass: one material for every surface in every look, drawn as a stack of layers (bottom to top):
//   OUTER   shadow by tier, press squeeze. No clipping, so the shadow is never cut.
//   SHELL   clips everything inside; a 1px rim with its own colour per side (lit from the top).
//   LENS    the blurred world behind the surface (live blur only for chrome).
//   BODY    the base tint, the body gradient and two caustics (edge light picked up from the world), in one view.
//   CATCH   the look's moving light, caught as it passes behind the surface.
//   BLOOM   hero cards on Lavender and Pine: a radial light that breathes.
//   SHEEN   a diagonal band of light that slides as the surface moves through the screen.
//   Stone's specular hairline and satin grain.
//   CHILDREN
//   RIM     inner top and bottom lines and the top glow band, above the content so nothing covers them.
//   PRESS   the rim brightens and the body lifts while touched (and while focused, on Android).
// Tiers: hero, pane, control and sheet look through the lens; inset (anything nested in glass) is a cheap
// fill and border; chrome (tab bar, mini player) blurs live and never squeezes.
import * as Haptics from 'expo-haptics';
import { createContext, type ReactNode, useContext, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityRole,
  type AccessibilityState,
  Image,
  type Insets,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { type Radii, useTheme } from '../../theme';
import { GLASS_GRAIN } from '../Art';
import { EASE_OUT, FOCUS_RING, useReduceMotion } from '../Motion';
import { Bloom } from './Bloom';
import { clearOf, softenGradient, thicker } from './colour';
import { GlassLens } from './GlassLens';
import { LightCatch } from './light';
import { CAN_LIVE_BLUR, LiveBlur } from './LiveBlur';
import { Sheen } from './Sheen';
import { type GlassAnchor, useGlassPlacement } from './useGlassPlacement';

export type GlassTier = 'hero' | 'pane' | 'control' | 'inset' | 'sheet' | 'chrome';

/** Set inside glass: glass drawn within it becomes the inset tier, so the pieces read as one sheet. */
export const InsideGlass = createContext(false);
/** Set on Pine's canopy slab: glass laid on the slab is a trough in the slab's own colour (canopy.inset). */
export const OnCanopy = createContext(false);
/** Set inside a receded (done or skipped) surface: icon tiles inside drop to 0.6 opacity. */
export const RecededContext = createContext(false);
export const useReceded = () => useContext(RecededContext);

const LENSED: Record<GlassTier, boolean> = { hero: true, pane: true, control: true, sheet: true, inset: false, chrome: false };
const CAUGHT: Record<GlassTier, boolean> = { hero: true, pane: true, control: true, sheet: false, inset: false, chrome: false };
const RADIUS: Record<GlassTier, keyof Radii> = {
  hero: 'hero',
  pane: 'pane',
  control: 'control',
  inset: 'inset',
  sheet: 'hero',
  chrome: 'hero',
};

// Style keys that place and size the surface go on the outermost element (the Pressable when there is one, so
// the web focus ring wraps the visible box); everything else lays out the content inside the shell.
const OUTER_KEYS = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'position',
  'top',
  'left',
  'right',
  'bottom',
  'start',
  'end',
  'inset',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'zIndex',
  'aspectRatio',
  'display',
]);
const DROPPED_KEYS = new Set([
  'borderRadius',
  'borderWidth',
  'borderColor',
  'overflow',
  'backgroundColor',
  'boxShadow',
  'opacity',
  'transform',
  'elevation',
]);

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const key of Object.keys(flat)) {
    if (OUTER_KEYS.has(key)) outer[key] = flat[key];
    else if (!DROPPED_KEYS.has(key)) inner[key] = flat[key];
  }
  return {
    outer: outer as ViewStyle,
    inner: inner as ViewStyle,
    radius: typeof flat.borderRadius === 'number' ? flat.borderRadius : undefined,
    shadow: typeof flat.boxShadow === 'string' ? flat.boxShadow : undefined,
    opacity: typeof flat.opacity === 'number' ? flat.opacity : undefined,
  };
}

export interface GlassProps {
  /** hero, pane (default), control, sheet or chrome. Glass nested in glass is always inset. */
  tier?: GlassTier;
  style?: StyleProp<ViewStyle>;
  /** Corner radius; defaults to the look's radius for the tier. */
  radius?: number;
  /** A kind colour laid over the body (use a 0.10-0.14 alpha colour). */
  tint?: string;
  /** The up-next or selected surface: a brighter rim and the look's lit glow. */
  lit?: boolean;
  /** Done or skipped: the body thins and the shadow drops, so the surface sinks back into the world. */
  receded?: boolean;
  /** Hero only: the breathing light (Lavender and Pine). */
  bloom?: boolean;
  /** The scroll-driven sheen (default on for hero and pane). */
  sheen?: boolean;
  /** Only the top corners round, and there is no bottom rim (sheets, docked chrome). */
  topOnly?: boolean;
  /** A known resting place in window coordinates (sheets), used instead of measuring the surface. */
  anchor?: GlassAnchor;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  hitSlop?: number | Insets;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (e: AccessibilityActionEvent) => void;
  children?: ReactNode;
}

const MIN_TARGET = 44;
const PRESS_IN = { duration: 120, easing: EASE_OUT };
const PRESS_OUT = { duration: 160, easing: EASE_OUT };
// The press light and focus ring are fades: they stay under reduced motion (a 0ms change would be a cut).
const FADE_IN = { ...PRESS_IN, reduceMotion: ReduceMotion.Never };
const FADE_OUT = { ...PRESS_OUT, reduceMotion: ReduceMotion.Never };

export function Glass({
  tier: tierProp = 'pane',
  style,
  radius,
  tint,
  lit,
  receded,
  bloom,
  sheen,
  topOnly: topOnlyProp,
  anchor,
  onPress,
  onLongPress,
  disabled,
  hitSlop,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  accessibilityActions,
  onAccessibilityAction,
  children,
}: GlassProps) {
  const theme = useTheme();
  const { colors, radii, name } = theme;
  const m = colors.material;
  const nested = useContext(InsideGlass);
  const slab = useContext(OnCanopy) && m.canopy ? m.canopy.inset : undefined;
  const tier: GlassTier = nested && tierProp !== 'chrome' ? 'inset' : tierProp;
  const reduced = useReduceMotion();
  const split = splitStyle(style);
  const r = radius ?? split.radius ?? radii[RADIUS[tier]];
  const topOnly = topOnlyProp ?? tier === 'sheet';
  const interactive = !!(onPress || onLongPress);
  const lensed = LENSED[tier];
  const { ref, onLayout, placement, restY } = useGlassPlacement(lensed, anchor);
  const [box, setBox] = useState({ w: MIN_TARGET, h: MIN_TARGET });

  const scale = useSharedValue(1);
  const press = useSharedValue(0);
  const focus = useSharedValue(0);
  const squeeze = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pressLight = useAnimatedStyle(() => ({ opacity: press.get() }));
  const focusRing = useAnimatedStyle(() => ({ opacity: focus.get() }));

  // Layers --------------------------------------------------------------------------------------------
  const chromeThin = tier === 'chrome' && !CAN_LIVE_BLUR;
  const bodyStops =
    tier === 'control'
      ? m.control.body
      : receded
        ? m.receded.body
        : chromeThin
          ? ([thicker(m.body[0], 0.25), thicker(m.body[1], 0.25)] as [string, string])
          : m.body;
  const base = chromeThin ? thicker(m.base, 0.25) : m.base;
  const layers: string[] = [];
  if (tier === 'sheet') {
    if (m.sheetOrb) layers.push(m.sheetOrb);
    if (m.sheet.band) layers.push(`linear-gradient(180deg, ${m.sheet.band[0]} 0px, ${clearOf(m.sheet.band[0])} ${m.sheet.band[1]}px)`);
    layers.push(`linear-gradient(180deg, ${m.sheet.body[0]}, ${m.sheet.body[1]})`);
    // The sheet lies on the dimmed world, like everything around it.
    layers.push(`linear-gradient(${colors.backdrop}, ${colors.backdrop})`);
  } else if (tier !== 'inset') {
    if (tint) layers.push(`linear-gradient(${tint}, ${tint})`);
    layers.push(`radial-gradient(${m.causticSize} at ${m.causticAt}, ${m.caustic}, ${clearOf(m.caustic)} 70%)`);
    layers.push(`radial-gradient(${m.caustic2Size} at ${m.caustic2At}, ${m.caustic2}, ${clearOf(m.caustic2)} 70%)`);
    layers.push(`linear-gradient(${m.bodyAngle}deg, ${bodyStops[0]}, ${bodyStops[1]})`);
    layers.push(`linear-gradient(${base}, ${base})`);
  }
  const inset = slab ?? m.inset;
  const bodyStyle: ViewStyle =
    tier === 'inset'
      ? { backgroundColor: inset.fill, ...(tint ? { backgroundImage: `linear-gradient(${tint}, ${tint})` } : null) }
      : { backgroundImage: layers.join(', ') };

  const rims: ViewStyle =
    tier === 'inset'
      ? {
          borderColor: inset.border,
          borderTopColor: inset.borderTop,
        }
      : {
          borderTopColor: tier === 'sheet' ? m.sheet.rimTop : m.rimTop,
          borderLeftColor: m.rimLeft,
          borderRightColor: m.rimRight,
          borderBottomColor: m.rimBottom,
        };

  const shadow =
    split.shadow ??
    (tier === 'hero'
      ? m.shadowHero
      : tier === 'pane'
        ? receded
          ? m.receded.shadow
          : m.shadowPane
        : tier === 'control'
          ? m.control.shadow
          : tier === 'chrome'
            ? m.shadowFloat
            : undefined);
  const outerShadow = lit && shadow ? `${shadow}, ${colors.litGlow}` : lit ? colors.litGlow : shadow;
  const rimLines = `inset 0px 1px 0px ${m.innerTop}, inset 0px -1px 0px ${m.innerBottom}${m.innerGlow ? `, ${m.innerGlow}` : ''}`;
  const corners: ViewStyle = topOnly
    ? { borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
    : { borderRadius: r };
  const innerCorners: ViewStyle = topOnly
    ? { borderTopLeftRadius: Math.max(0, r - 1), borderTopRightRadius: Math.max(0, r - 1) }
    : { borderRadius: Math.max(0, r - 1) };
  const showSheen = (sheen ?? (tier === 'hero' || tier === 'pane')) && !receded;

  const onShellLayout = (e: LayoutChangeEvent) => {
    onLayout(e);
    if (interactive) {
      const { width, height } = e.nativeEvent.layout;
      setBox((b) => (Math.abs(b.w - width) < 0.5 && Math.abs(b.h - height) < 0.5 ? b : { w: width, h: height }));
    }
  };

  const shell = (
    <Animated.View ref={ref} onLayout={onShellLayout} style={[styles.shell, corners, rims, topOnly && styles.noBottomRim, split.inner]}>
      {tier === 'chrome' ? <LiveBlur radius={r} topOnly={topOnly} /> : lensed ? <GlassLens placement={placement} look={name} /> : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, bodyStyle]} />
      {CAUGHT[tier] && <LightCatch placement={placement} look={name} strength={m.light.catch} />}
      {bloom && tier === 'hero' && m.bloom ? <Bloom image={m.bloom} /> : null}
      {showSheen && <Sheen placement={placement} restY={restY} color={m.sheen} fromBelow={name === 'pine'} still={reduced} />}
      {tier !== 'inset' && m.hairline ? (
        <View pointerEvents="none" style={[styles.hairline, { backgroundImage: softenGradient(m.hairline) }]} />
      ) : null}
      {tier !== 'inset' && m.grain ? (
        <Image
          source={GLASS_GRAIN}
          resizeMode="repeat"
          pointerEvents="none"
          accessibilityIgnoresInvertColors
          style={[StyleSheet.absoluteFill, styles.tile, { opacity: m.grain }]}
        />
      ) : null}
      <InsideGlass.Provider value>
        <RecededContext.Provider value={!!receded}>{children}</RecededContext.Provider>
      </InsideGlass.Provider>
      {tier !== 'inset' && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            innerCorners,
            {
              boxShadow: rimLines,
              backgroundImage:
                tier === 'sheet' ? undefined : `linear-gradient(180deg, ${m.topGlow} 0px, ${clearOf(m.topGlow)} ${m.topGlowPx}px)`,
            },
          ]}
        />
      )}
      {lit && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, innerCorners, { borderWidth: 1.5, borderColor: colors.litRim }]} />
      )}
      {interactive && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            innerCorners,
            { borderWidth: 1, borderColor: m.pressRim, backgroundColor: m.pressFill },
            pressLight,
          ]}
        />
      )}
      {interactive && FOCUS_RING && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, innerCorners, { borderWidth: 2, borderColor: colors.text }, focusRing]}
        />
      )}
    </Animated.View>
  );

  const outerStyle = [
    corners,
    outerShadow ? { boxShadow: outerShadow } : null,
    split.opacity !== undefined ? { opacity: split.opacity } : null,
  ];

  if (!interactive) {
    return <Animated.View style={[styles.outer, split.outer, outerStyle]}>{shell}</Animated.View>;
  }

  const squeezes = tier !== 'chrome';
  const pressIn = () => {
    if (squeezes && !reduced) scale.set(withTiming(0.97, PRESS_IN));
    press.set(withTiming(1, FADE_IN));
  };
  const pressOut = () => {
    if (squeezes) scale.set(withTiming(1, PRESS_OUT));
    press.set(withTiming(0, FADE_OUT));
  };
  // A long press (rows edit on long press) answers with a light tap of haptics; the press light holds until release.
  const longPress = onLongPress
    ? () => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onLongPress();
      }
    : undefined;
  const slop =
    hitSlop ??
    (box.w < MIN_TARGET || box.h < MIN_TARGET
      ? {
          left: Math.max(0, (MIN_TARGET - box.w) / 2),
          right: Math.max(0, (MIN_TARGET - box.w) / 2),
          top: Math.max(0, (MIN_TARGET - box.h) / 2),
          bottom: Math.max(0, (MIN_TARGET - box.h) / 2),
        }
      : undefined);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={longPress}
      delayLongPress={400}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onFocus={FOCUS_RING ? () => focus.set(withTiming(1, FADE_IN)) : undefined}
      onBlur={FOCUS_RING ? () => focus.set(withTiming(0, FADE_OUT)) : undefined}
      disabled={disabled}
      hitSlop={slop}
      pressRetentionOffset={16}
      style={[corners, split.outer]}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
    >
      <Animated.View style={[styles.outer, styles.fill, outerStyle, squeezes ? squeeze : null]}>{shell}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {},
  fill: { flexGrow: 1, flexShrink: 1 },
  shell: { flexGrow: 1, flexShrink: 1, overflow: 'hidden', borderWidth: 1 },
  noBottomRim: { borderBottomWidth: 0 },
  hairline: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  tile: { width: '100%', height: '100%' },
});
