import { useState } from 'react';
import { Alert, Platform, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { makeBackup, parseBackup } from '../lib/backup';
import { useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Sheet } from './Sheet';

/** Export everything as text (to save in notes, email or a chat), or paste it back in. */
export function BackupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { groceries, gym, chinese, routines, journal, inbox, restore } = useStore();
  const [pasted, setPasted] = useState('');
  const [shown, setShown] = useState<string | null>(null);

  const exportAll = async () => {
    const text = makeBackup({ groceries, gym, chinese, routines, journal, inbox });
    if (Platform.OS === 'web') return setShown(text);
    try {
      await Share.share({ title: 'Routine backup', message: text });
    } catch {
      setShown(text);
    }
  };

  const importAll = () => {
    try {
      const data = parseBackup(pasted);
      const go = () => {
        restore(data);
        setPasted('');
        onClose();
      };
      if (Platform.OS === 'web') return go();
      Alert.alert('Replace everything?', 'Your routines, gym, Chinese, groceries and notes will be replaced by the backup.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', style: 'destructive', onPress: go },
      ]);
    } catch (e) {
      Alert.alert('Could not restore', (e as Error).message);
    }
  };

  return (
    <Sheet visible={visible} title="Backup" onClose={onClose}>
      <Text style={type.small}>Everything stays on this phone. Keep a copy somewhere safe, or move it to a new phone.</Text>

      <Text style={styles.label}>Save a copy</Text>
      <Button label="Export backup" onPress={exportAll} />
      {shown && (
        <TextInput style={[styles.input, styles.code]} value={shown} multiline editable={false} selectTextOnFocus />
      )}

      <Text style={styles.label}>Restore</Text>
      <TextInput
        style={[styles.input, styles.code]}
        value={pasted}
        onChangeText={setPasted}
        multiline
        placeholder="Paste a backup here"
        placeholderTextColor={colors.faint}
      />
      <View style={styles.gap}>
        <Button label="Restore from backup" variant="secondary" onPress={importAll} />
      </View>
    </Sheet>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
  label: { ...type.label, marginTop: 22, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    padding: 12,
    backgroundColor: colors.card,
    color: colors.text,
    minHeight: 80,
    maxHeight: 160,
    marginTop: 10,
    textAlignVertical: 'top',
  },
  code: { fontFamily: fonts.mono, fontSize: 12 },
  gap: { marginTop: 4 },
});
