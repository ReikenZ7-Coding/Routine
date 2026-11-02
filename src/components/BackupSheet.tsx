import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { type BackupData, makeBackup, parseBackup } from '../lib/backup';
import { musicToSave } from '../lib/music';
import { useStore } from '../lib/store';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Field, Input } from './Field';
import { EASE_OUT } from './Motion';
import { Sheet } from './Sheet';

const SHOW = FadeIn.duration(200).easing(EASE_OUT);
const HIDE = FadeOut.duration(140).easing(EASE_OUT);
const GROW = LinearTransition.duration(240).easing(EASE_OUT);

/** Export everything as text (to save in notes, email or a chat), or paste it back in. Restoring asks first,
 *  inside the sheet; a backup that can't be read says why under the field. */
export function BackupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { type } = useTheme();
  const styles = useStyles(makeStyles);
  const { groceries, gym, language, routines, journal, inbox, music, restore } = useStore();
  const [pasted, setPasted] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState<BackupData | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setError(undefined);
    setPending(null);
  }, [visible]);

  const exportAll = async () => {
    const text = makeBackup({ groceries, gym, chinese: language, routines, journal, inbox, music: musicToSave(music) });
    if (Platform.OS === 'web') return setShown(text);
    setExporting(true);
    try {
      await Share.share({ title: 'Symphony OS backup', message: text });
    } catch {
      setShown(text);
    } finally {
      setExporting(false);
    }
  };

  const check = () => {
    try {
      setPending(parseBackup(pasted));
      setError(undefined);
    } catch (e) {
      setPending(null);
      setError((e as Error).message);
    }
  };

  const go = () => {
    if (!pending) return;
    restore(pending);
    setPasted('');
    setPending(null);
    onClose();
  };

  return (
    <Sheet visible={visible} title="Backup" onClose={onClose}>
      <Text style={type.hint}>Everything stays on this phone. Keep a copy somewhere safe, or move it to a new phone.</Text>
      <Text style={[type.hint, styles.note]}>
        Your playlist links and song names are in the backup, but not the music files themselves. On a new phone, import your songs again.
      </Text>

      <Text style={styles.label}>Save a copy</Text>
      <Button label="Export backup" icon="share-outline" onPress={exportAll} busy={exporting} />
      {shown && (
        <Field label="Your backup">
          <Input style={styles.code} value={shown} multiline editable={false} selectTextOnFocus accessibilityLabel="Your backup" />
        </Field>
      )}

      <Field label="Restore" error={error}>
        <Input
          style={styles.code}
          value={pasted}
          onChangeText={(t) => {
            setPasted(t);
            setError(undefined);
            setPending(null);
          }}
          multiline
          invalid={!!error}
          placeholder="Paste a backup here"
          accessibilityLabel="Backup to restore"
        />
      </Field>
      <Animated.View layout={GROW} style={styles.gap}>
        {pending ? (
          <Animated.View key="ask" entering={SHOW} exiting={HIDE} style={styles.ask}>
            <Text style={styles.question} accessibilityLiveRegion="polite">
              {pending.music
                ? 'Replace everything? Your routines, gym, language practice, groceries, notes and playlist links will be replaced by the backup. Songs already on this phone stay.'
                : 'Replace everything? Your routines, gym, language practice, groceries and notes will be replaced by the backup. Your music and playlist links stay as they are.'}
            </Text>
            <View style={styles.answers}>
              <Button label="Keep mine" variant="secondary" onPress={() => setPending(null)} style={styles.answer} />
              <Button label="Restore" variant="danger" icon="refresh" onPress={go} style={styles.answer} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="idle" entering={SHOW} exiting={HIDE}>
            <Button label="Restore from backup" variant="secondary" disabled={!pasted.trim()} onPress={check} />
          </Animated.View>
        )}
      </Animated.View>
    </Sheet>
  );
}

const makeStyles = ({ colors, fonts, type }: Theme) =>
  StyleSheet.create({
    label: { ...type.label, marginTop: 20, marginBottom: 8 },
    note: { marginTop: 8 },
    code: { fontFamily: fonts.code, fontSize: 13, minHeight: 96, maxHeight: 180, textAlignVertical: 'top' },
    gap: { marginTop: 12 },
    ask: { gap: 12 },
    question: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.text },
    answers: { flexDirection: 'row', gap: 10 },
    answer: { flex: 1 },
  });
