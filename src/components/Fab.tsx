import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { alphaOf, clearOf } from './glass/colour';
import { Press } from './Motion';
import { useFabBottom } from './NowPlaying';

/** The screen's one floating action: a 56 circle of control glass filled with the look's primary, clear of the
 *  tab bar and the mini player. Paper's is ink glass: a dark lens with a faint lit top edge and a specular cap;
 *  Pine's mint disc wears the same specular cap, a moonlit bead of glass. */
export function Fab({ icon = 'add', onPress, accessibilityLabel }: { icon?: string; onPress: () => void; accessibilityLabel: string }) {
  const { colors, name } = useTheme();
  const styles = useStyles(makeStyles);
  const bottom = useFabBottom();
  if (name === 'paper') {
    return (
      <Press
        outerStyle={[styles.inkSpot, { bottom }]}
        style={styles.ink}
        haptic
        overlay={alphaOf(colors.onPrimary, 0.1)}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      >
        <View pointerEvents="none" style={styles.specular} />
        <Ionicons name={icon as 'add'} size={28} color={colors.onPrimary} />
      </Press>
    );
  }
  return (
    <Glass tier="control" radius={28} style={[styles.fab, { bottom }]} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View pointerEvents="none" style={styles.fill} />
      {name === 'pine' && <View pointerEvents="none" style={styles.specular} />}
      <Ionicons name={icon as 'add'} size={28} color={colors.onPrimary} />
    </Glass>
  );
}

const makeStyles = ({ colors }: Theme) => {
  const lip = colors.material.rimTop;
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.actionGlow,
    },
    fill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
    },
    inkSpot: { position: 'absolute', right: 20 },
    ink: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      borderWidth: 1,
      borderColor: alphaOf(lip, 0.08),
      borderTopColor: alphaOf(lip, 0.24),
      boxShadow: `${colors.litGlow}, 0px 2px 4px ${alphaOf(colors.primary, 0.12)}`,
    },
    specular: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '45%',
      borderTopLeftRadius: 29,
      borderTopRightRadius: 29,
      backgroundImage: `linear-gradient(180deg, ${alphaOf(lip, 0.18)}, ${clearOf(lip)})`,
    },
  });
};
