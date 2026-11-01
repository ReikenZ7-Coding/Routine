import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';
import { useFabBottom } from './NowPlaying';

/** The screen's one floating action: a 56 circle of control glass filled with the look's primary, clear of the
 *  tab bar and the mini player. */
export function Fab({ icon = 'add', onPress, accessibilityLabel }: { icon?: string; onPress: () => void; accessibilityLabel: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const bottom = useFabBottom();
  return (
    <Glass tier="control" radius={28} style={[styles.fab, { bottom }]} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View pointerEvents="none" style={styles.fill} />
      <Ionicons name={icon as 'add'} size={28} color={colors.onPrimary} />
    </Glass>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
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
  });
