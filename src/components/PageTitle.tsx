import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../theme';

/** On the glass looks, screens title themselves on the backdrop instead of under a solid header bar. */
export function PageTitle({ title }: { title: string }) {
  const { glass } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  if (!glass) return null;
  return (
    <Text style={[styles.title, { marginTop: insets.top }]} accessibilityRole="header">
      {title}
    </Text>
  );
}

const makeStyles = ({ type }: Theme) =>
  StyleSheet.create({
    title: { ...type.title, marginBottom: 16 },
  });
