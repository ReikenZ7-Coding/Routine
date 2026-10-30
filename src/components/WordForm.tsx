import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Word } from '../lib/chinese';
import { type Theme, useStyles, useTheme } from '../theme';

export interface WordFields {
  hanzi: string;
  pinyin: string;
  meaning: string;
}

interface Props {
  visible: boolean;
  /** Word being edited, or undefined when adding a new one. */
  word?: Word;
  onSave: (fields: WordFields) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function WordForm({ visible, word, onSave, onDelete, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [hanzi, setHanzi] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [meaning, setMeaning] = useState('');

  useEffect(() => {
    if (!visible) return;
    setHanzi(word?.hanzi ?? '');
    setPinyin(word?.pinyin ?? '');
    setMeaning(word?.meaning ?? '');
  }, [visible, word]);

  function save() {
    if (!hanzi.trim() || !meaning.trim()) {
      Alert.alert('Almost there', 'Add the characters and what they mean.');
      return;
    }
    onSave({ hanzi: hanzi.trim(), pinyin: pinyin.trim(), meaning: meaning.trim() });
  }

  function confirmDelete() {
    Alert.alert('Delete word?', `Remove ${word?.hanzi} from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.heading}>{word ? 'Edit word' : 'New word'}</Text>

            <Text style={styles.label}>Characters</Text>
            <TextInput
              style={[styles.input, styles.hanzi]}
              value={hanzi}
              onChangeText={setHanzi}
              placeholder="水" placeholderTextColor={colors.faint}
              autoFocus={!word}
            />
            <Text style={styles.label}>Pinyin (optional)</Text>
            <TextInput
              style={styles.input}
              value={pinyin}
              onChangeText={setPinyin}
              placeholder="shuǐ" placeholderTextColor={colors.faint}
              autoCapitalize="none"
            />
            <Text style={styles.label}>Meaning</Text>
            <TextInput style={styles.input} value={meaning} onChangeText={setMeaning} placeholder="water" placeholderTextColor={colors.faint} />

            <Pressable style={styles.saveButton} onPress={save}>
              <Text style={styles.saveText}>{word ? 'Save' : 'Add word'}</Text>
            </Pressable>
            {word && onDelete && (
              <Pressable style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete word</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = ({ colors, fonts }: Theme) =>
  StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  heading: { fontFamily: fonts.display, fontSize: 20, color: colors.text, marginBottom: 8 },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 16,
    color: colors.text,
  },
  hanzi: { fontFamily: fonts.body, fontSize: 24 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveText: { color: colors.onPrimary, fontFamily: fonts.bodyBold, fontSize: 16 },
  deleteButton: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  deleteText: { color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 15 },
});
