import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { type StudyLanguage, type Word, infoFor, isRtl, readingLabel, wordLabel } from '../lib/language';
import { type Theme, useStyles } from '../theme';
import { Button } from './Button';
import { Field, Input } from './Field';
import { ConfirmDelete, Sheet, SheetFooter } from './Sheet';

export interface WordFields {
  /** The word or phrase. */
  hanzi: string;
  /** Its reading or pronunciation. */
  pinyin: string;
  meaning: string;
}

interface Props {
  visible: boolean;
  /** The language the word belongs to: sets the labels, the example and the text direction. */
  language?: StudyLanguage;
  /** Word being edited, or undefined when adding a new one. */
  word?: Word;
  onSave: (fields: WordFields) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function WordForm({ visible, language, word, onSave, onDelete, onClose }: Props) {
  const styles = useStyles(makeStyles);
  const [hanzi, setHanzi] = useState('');
  const [pinyin, setPinyin] = useState('');
  const [meaning, setMeaning] = useState('');
  const [errors, setErrors] = useState<{ hanzi?: string; meaning?: string }>({});
  const reading = readingLabel(language);
  const rtl = isRtl(language);
  // The starter set's "water" makes the example, so it is in the right script.
  const example = language ? infoFor(language).starter?.find(([, , m]) => m === 'water') : undefined;

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setHanzi(word?.hanzi ?? '');
    setPinyin(word?.pinyin ?? '');
    setMeaning(word?.meaning ?? '');
  }, [visible, word]);

  function save() {
    const found = {
      hanzi: hanzi.trim() ? undefined : `Add the ${wordLabel(language).toLowerCase()}.`,
      meaning: meaning.trim() ? undefined : 'Add what it means.',
    };
    setErrors(found);
    if (found.hanzi || found.meaning) return;
    onSave({ hanzi: hanzi.trim(), pinyin: pinyin.trim(), meaning: meaning.trim() });
  }

  const title = word ? 'Edit word' : language ? `New ${language.name} word` : 'New word';
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Field label={wordLabel(language)} error={errors.hanzi}>
        <Input
          style={[styles.word, rtl && styles.rtl]}
          value={hanzi}
          onChangeText={(t) => {
            setHanzi(t);
            setErrors((e) => ({ ...e, hanzi: undefined }));
          }}
          invalid={!!errors.hanzi}
          placeholder={example?.[0]}
          autoFocus={!word}
          autoCapitalize="none"
          accessibilityLabel={wordLabel(language)}
        />
      </Field>
      <Field label={`${reading} (optional)`}>
        <Input
          value={pinyin}
          onChangeText={setPinyin}
          placeholder={example?.[1] || undefined}
          autoCapitalize="none"
          accessibilityLabel={reading}
        />
      </Field>
      <Field label="Meaning" error={errors.meaning}>
        <Input
          value={meaning}
          onChangeText={(t) => {
            setMeaning(t);
            setErrors((e) => ({ ...e, meaning: undefined }));
          }}
          invalid={!!errors.meaning}
          placeholder={example?.[2]}
          accessibilityLabel="Meaning"
        />
      </Field>

      <SheetFooter>
        <Button label={word ? 'Save' : 'Add word'} onPress={save} style={styles.save} />
      </SheetFooter>
      {word && onDelete && <ConfirmDelete label="Delete word" question={`Remove ${word.hanzi} from your list?`} onConfirm={onDelete} />}
    </Sheet>
  );
}

const makeStyles = ({ fonts }: Theme) =>
  StyleSheet.create({
    word: { fontFamily: fonts.body, fontSize: 22, lineHeight: 30 },
    // Arabic, Hebrew, Persian and Urdu are typed from the right.
    rtl: { writingDirection: 'rtl', textAlign: 'right' },
    save: { marginTop: 24 },
  });
