import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { Word } from '../lib/chinese';
import { type Theme, useStyles } from '../theme';
import { Button } from './Button';
import { Field, Input } from './Field';
import { ConfirmDelete, Sheet } from './Sheet';

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
  const styles = useStyles(makeStyles);
  const [hanzi, setHanzi] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [meaning, setMeaning] = useState('');
  const [errors, setErrors] = useState<{ hanzi?: string; meaning?: string }>({});

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setHanzi(word?.hanzi ?? '');
    setPinyin(word?.pinyin ?? '');
    setMeaning(word?.meaning ?? '');
  }, [visible, word]);

  function save() {
    const found = {
      hanzi: hanzi.trim() ? undefined : 'Add the characters.',
      meaning: meaning.trim() ? undefined : 'Add what it means.',
    };
    setErrors(found);
    if (found.hanzi || found.meaning) return;
    onSave({ hanzi: hanzi.trim(), pinyin: pinyin.trim(), meaning: meaning.trim() });
  }

  return (
    <Sheet visible={visible} title={word ? 'Edit word' : 'New word'} onClose={onClose}>
      <Field label="Characters" error={errors.hanzi}>
        <Input
          style={styles.hanzi}
          value={hanzi}
          onChangeText={(t) => {
            setHanzi(t);
            setErrors((e) => ({ ...e, hanzi: undefined }));
          }}
          invalid={!!errors.hanzi}
          placeholder="水"
          autoFocus={!word}
          accessibilityLabel="Characters"
        />
      </Field>
      <Field label="Pinyin (optional)">
        <Input value={pinyin} onChangeText={setPinyin} placeholder="shuǐ" autoCapitalize="none" accessibilityLabel="Pinyin" />
      </Field>
      <Field label="Meaning" error={errors.meaning}>
        <Input
          value={meaning}
          onChangeText={(t) => {
            setMeaning(t);
            setErrors((e) => ({ ...e, meaning: undefined }));
          }}
          invalid={!!errors.meaning}
          placeholder="water"
          accessibilityLabel="Meaning"
        />
      </Field>

      <Button label={word ? 'Save' : 'Add word'} onPress={save} style={styles.save} />
      {word && onDelete && <ConfirmDelete label="Delete word" question={`Remove ${word.hanzi} from your list?`} onConfirm={onDelete} />}
    </Sheet>
  );
}

const makeStyles = ({ fonts }: Theme) =>
  StyleSheet.create({
    hanzi: { fontFamily: fonts.body, fontSize: 24 },
    save: { marginTop: 24 },
  });
