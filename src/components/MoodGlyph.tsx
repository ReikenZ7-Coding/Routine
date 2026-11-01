// A drawn face for a mood, in place of emoji: one stroke weight, the look's own inks.
import Svg, { Circle, Path } from 'react-native-svg';

/** A 28px face: a ring, two eyes and a mouth whose curve runs from -6 (a frown) to +6 (a wide smile). */
export function MoodGlyph({ curve, color, size = 28 }: { curve: number; color: string; size?: number }) {
  // The mouth's ends rise as the smile widens, and drop for a frown, so the shape reads at 28px.
  const ends = 17 - curve * 0.25;
  const mid = 17 + curve * 0.75;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={14} cy={14} r={10.5} stroke={color} strokeWidth={1.75} fill="none" />
      <Circle cx={10.5} cy={11.5} r={1} fill={color} />
      <Circle cx={17.5} cy={11.5} r={1} fill={color} />
      <Path d={`M 9.5 ${ends} Q 14 ${mid} 18.5 ${ends}`} stroke={color} strokeWidth={1.75} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
