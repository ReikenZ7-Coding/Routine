import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Theme, useStyles, useTheme } from '../theme';
import { Glass } from './Glass';

/** Bottom sheet used by the smaller panels (stats, backup, quick add). */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Glass tier="sheet" style={[styles.sheet, { paddingBottom: 32 + insets.bottom }]}>
          <View style={styles.grip} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{title}</Text>
            {children}
          </ScrollView>
        </Glass>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
    sheet: {
      padding: 20,
      paddingTop: 10,
      paddingBottom: 32,
      maxHeight: '90%',
    },
    grip: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
    heading: { fontFamily: fonts.display, fontSize: 22, color: colors.text, marginBottom: 4 },
  });
