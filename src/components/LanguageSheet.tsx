// A language's options sheet and the review card's grade buttons, shared by the phone's Language tab and the
// desktop's Language page.
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { type StudyLanguage, infoFor, inLine } from '../lib/language';
import { plural } from '../lib/plural';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Glass } from './Glass';
import { ConfirmDelete, Sheet } from './Sheet';

/** One language's options: practise it, or stop learning it (which asks first, and says its words go too). */
export function LanguageSheet({
  lang,
  showing,
  words,
  onClose,
  onShow,
  onRemove,
}: {
  lang?: StudyLanguage;
  showing: boolean;
  words: number;
  onClose: () => void;
  onShow: () => void;
  onRemove: () => void;
}) {
  const styles = useStyles(makeStyles);
  // Holds the last language while the sheet slides away, so its content doesn't blank out mid-exit.
  const [shown, setShown] = useState(lang);
  if (lang && lang !== shown) setShown(lang);
  const l = lang ?? shown;
  const native = l ? infoFor(l).native : '';
  return (
    <Sheet visible={!!lang} title={l?.name ?? ''} onClose={onClose}>
      {l ? (
        <>
          <Text style={styles.sheetText}>{`${native !== l.name ? `${inLine(native)} · ` : ''}${plural(words, 'word')}`}</Text>
          {!showing && <Button label={`Practise ${l.name}`} onPress={onShow} style={styles.sheetButton} />}
          <ConfirmDelete
            label={`Remove ${l.name}`}
            question={
              words > 0
                ? `Remove ${l.name}? Its ${plural(words, 'word')} go too. Your practice minutes and streak stay.`
                : `Remove ${l.name}? Your practice minutes and streak stay.`
            }
            confirmLabel="Remove"
            onConfirm={onRemove}
          />
        </>
      ) : null}
    </Sheet>
  );
}

export function GradeButton({
  label,
  sub,
  onPress,
  tone,
}: {
  label: string;
  sub: string;
  onPress: () => void;
  tone: 'danger' | 'primary' | 'muted';
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const color = tone === 'danger' ? colors.danger : tone === 'primary' ? colors.link : colors.text;
  return (
    <Glass tier="control" style={styles.gradeButton} onPress={onPress} accessibilityLabel={`${label}, ${sub}`}>
      <Text style={[styles.gradeLabel, { color }]}>{label}</Text>
      <Text style={styles.gradeSub}>{sub}</Text>
    </Glass>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    sheetText: { ...type.hint, marginBottom: 8 },
    sheetButton: { marginTop: 16 },
    gradeButton: { flex: 1, minHeight: 64, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    gradeLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
    gradeSub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  });
