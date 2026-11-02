// Choosing a language to learn: the eight with starter words first, the rest behind "More languages", and
// "Another language" for one the list doesn't have, by its typed name. Used on the Language tab's first visit
// and in the "Add a language" sheet.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type LanguageInfo, MORE, OTHER, POPULAR, type StudyLanguage, findByName, infoFor, makeLanguage } from '../lib/language';
import { type Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Field, Input } from './Field';
import { Chevron, Collapse, Press } from './Motion';
import { Divider } from './Section';

/** The deck's tile: the language's own character on an inset square. */
export function LanguageTile({ lang, size = 40 }: { lang: StudyLanguage | LanguageInfo; size?: number }) {
  const styles = useStyles(makeStyles);
  const info = 'glyph' in lang ? lang : infoFor(lang);
  return (
    <View
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.tileGlyph, { fontSize: info.glyph.length > 1 ? size * 0.4 : size * 0.46 }]} numberOfLines={1}>
        {info.glyph}
      </Text>
    </View>
  );
}

export function LanguagePicker({ learning, onPick }: { learning: string[]; onPick: (lang: StudyLanguage) => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [more, setMore] = useState(false);
  const [other, setOther] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  const pickOther = () => {
    const typed = name.trim();
    if (!typed) return setError('Type the name of the language.');
    // "Spanish" or "Español" typed here is the Spanish from the list, with its starter words.
    const known = findByName(typed);
    onPick(known ? makeLanguage(known.code) : makeLanguage(OTHER, typed));
    setName('');
    setOther(false);
  };

  const row = (info: LanguageInfo, first: boolean) => {
    const added = learning.includes(info.code);
    return (
      <View key={info.code}>
        {!first && <Divider inset={68} />}
        <Press
          style={styles.row}
          overlay={colors.material.pressFill}
          onPress={() => onPick(makeLanguage(info.code))}
          accessibilityRole="button"
          accessibilityLabel={`${info.name}${info.native !== info.name ? `, ${info.native}` : ''}${added ? ', already learning' : ''}`}
          accessibilityHint={added ? 'Switches to it' : info.starter ? 'Starts with 8 beginner words' : undefined}
        >
          <LanguageTile lang={info} />
          <View style={styles.flex}>
            <Text style={styles.name}>{info.name}</Text>
            {info.native !== info.name ? (
              <Text style={[styles.native, info.rtl && styles.rtl]} numberOfLines={1}>
                {info.native}
              </Text>
            ) : null}
          </View>
          {added ? (
            <View style={styles.added}>
              <Ionicons name="checkmark" size={16} color={colors.link} />
              <Text style={styles.addedText}>Learning</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          )}
        </Press>
      </View>
    );
  };

  const toggle = (label: string, open: boolean, onPress: () => void, icon: string) => (
    <Press
      style={styles.row}
      overlay={colors.material.pressFill}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: open }}
    >
      <View style={[styles.tile, styles.iconTile]}>
        <Ionicons name={icon as 'add'} size={20} color={colors.text} />
      </View>
      <Text style={[styles.name, styles.flex]}>{label}</Text>
      <Chevron open={open} color={colors.muted} />
    </Press>
  );

  return (
    <View>
      {POPULAR.map((l, i) => row(l, i === 0))}
      <Divider inset={68} />
      {toggle('More languages', more, () => setMore((m) => !m), 'globe-outline')}
      <Collapse open={more}>{MORE.map((l) => row(l, false))}</Collapse>
      <Divider inset={68} />
      {toggle('Another language', other, () => setOther((o) => !o), 'create-outline')}
      <Collapse open={other}>
        <View style={styles.other}>
          <Field label="Language name" error={error} style={styles.otherField}>
            <Input
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(undefined);
              }}
              invalid={!!error}
              maxLength={40}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={pickOther}
              accessibilityLabel="Language name"
            />
          </Field>
          <Button label="Start learning" variant="secondary" onPress={pickOther} style={styles.otherButton} />
        </View>
      </Collapse>
    </View>
  );
}

const makeStyles = ({ colors, kinds, fonts, type }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 8, paddingHorizontal: 14 },
    tile: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    iconTile: { width: 40, height: 40, borderRadius: 12 },
    tileGlyph: { fontFamily: fonts.body, color: kinds.chinese.text, includeFontPadding: false },
    name: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22, color: colors.text },
    native: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
    rtl: { writingDirection: 'rtl', textAlign: 'left' },
    added: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addedText: { ...type.hint, color: colors.link },
    other: { paddingHorizontal: 14, paddingBottom: 14 },
    otherField: { marginTop: 4 },
    otherButton: { marginTop: 12 },
  });
