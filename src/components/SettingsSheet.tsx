import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AMBIENCE, BACKDROPS } from './Art';
import { calendarSupported, connectPhoneCalendar } from '../lib/deviceCalendar';
import { useStore } from '../lib/store';
import { THEME_OPTIONS, type Theme, type ThemeName, themeFor, useStyles, useTheme } from '../theme';
import { Field, Input } from './Field';
import { FadeSwap, Press, SelectFade } from './Motion';
import { Divider, Section } from './Section';
import { Sheet } from './Sheet';

/** Look, name, phone calendar and backup. */
export function SettingsSheet({ visible, onClose, onBackup }: { visible: boolean; onClose: () => void; onBackup: () => void }) {
  const { colors, type, radii } = useTheme();
  const styles = useStyles(makeStyles);
  const { settings, updateSettings } = useStore();
  const [name, setName] = useState(settings.name);
  useEffect(() => {
    if (visible) setName(settings.name);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveName = () => {
    if (name.trim() !== settings.name) updateSettings({ name: name.trim() });
  };
  const connect = async () => updateSettings({ calendarConnected: await connectPhoneCalendar() });

  return (
    <Sheet visible={visible} title="Settings" onClose={() => (saveName(), onClose())}>
      <Text style={styles.label}>Look</Text>
      <View style={styles.themes}>
        {THEME_OPTIONS.map((o) => {
          const t = themeFor(o.name);
          const active = settings.theme === o.name;
          return (
            <Press
              key={o.name}
              outerStyle={styles.themeSlot}
              style={styles.theme}
              overlay={colors.material.pressFill}
              haptic
              onPress={() => updateSettings({ theme: o.name })}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${o.label} look. ${o.description}`}
            >
              <SelectFade on={active} radius={radii.inset} bleed={1} style={styles.themeRing} />
              <Swatch look={o.name} />
              <Text style={styles.themeName}>{o.label}</Text>
              <Text style={styles.themeDesc} numberOfLines={2}>
                {o.description}
              </Text>
              <View style={styles.check} pointerEvents="none">
                <SelectFade on={active} radius={12} style={styles.checkOn} />
                <FadeSwap
                  on={active}
                  style={StyleSheet.absoluteFill}
                  off={null}
                  onContent={<Ionicons name="checkmark" size={16} color={colors.onPrimary} />}
                />
              </View>
            </Press>
          );
        })}
      </View>

      <Field label="Your name">
        <Input
          value={name}
          onChangeText={setName}
          onBlur={saveName}
          onSubmitEditing={saveName}
          placeholder="For the morning greeting"
          autoCapitalize="words"
          accessibilityLabel="Your name"
        />
      </Field>

      <Section title="More">
        <Press
          style={styles.row}
          overlay={colors.material.pressFill}
          disabled={!settings.calendarConnected && !calendarSupported}
          onPress={settings.calendarConnected ? () => updateSettings({ calendarConnected: false }) : connect}
          accessibilityLabel={settings.calendarConnected ? 'Phone calendar, connected. Hide events' : 'Phone calendar'}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.text} />
          <View style={styles.flex}>
            <Text style={type.bodyMedium}>Phone calendar</Text>
            <Text style={type.small}>
              {settings.calendarConnected
                ? 'Connected. Your events show on the timeline. Tap to hide them.'
                : calendarSupported
                  ? 'Show your events on the timeline. Read-only.'
                  : 'Available in the Android app.'}
            </Text>
          </View>
        </Press>
        <Divider inset={50} />
        <Press style={styles.row} overlay={colors.material.pressFill} onPress={onBackup} accessibilityLabel="Backup and restore">
          <Ionicons name="archive-outline" size={20} color={colors.text} />
          <View style={styles.flex}>
            <Text style={type.bodyMedium}>Backup and restore</Text>
            <Text style={type.small}>Keep a copy, or move to a new phone.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Press>
      </Section>
    </Sheet>
  );
}

/**
 * A look as it really is: a crop of its own world under its scrim, a small card of its glass (base, body, rims
 * and top line) and its primary button.
 */
function Swatch({ look }: { look: ThemeName }) {
  const styles = useStyles(makeStyles);
  const t = themeFor(look);
  const m = t.colors.material;
  return (
    <View style={styles.swatch}>
      <Image source={BACKDROPS[look]} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: AMBIENCE[look].scrim }]} />
      <View
        style={[
          styles.swatchCard,
          {
            backgroundImage: `linear-gradient(${m.bodyAngle}deg, ${m.body[0]}, ${m.body[1]}), linear-gradient(${m.base}, ${m.base})`,
            borderTopColor: m.rimTop,
            borderLeftColor: m.rimLeft,
            borderRightColor: m.rimRight,
            borderBottomColor: m.rimBottom,
            boxShadow: `inset 0px 1px 0px ${m.innerTop}, ${m.shadowPane}`,
          },
        ]}
      >
        <View style={[styles.swatchDot, { backgroundColor: t.kinds.routines.color }]} />
        <View style={styles.flex}>
          <View style={[styles.swatchLine, { backgroundColor: t.colors.text }]} />
          <View style={[styles.swatchLine, styles.swatchLineShort, { backgroundColor: t.colors.muted }]} />
        </View>
      </View>
      <View
        style={[
          styles.swatchButton,
          {
            backgroundColor: t.colors.primary,
            backgroundImage: `linear-gradient(180deg, ${t.colors.primaryGradient[0]}, ${t.colors.primaryGradient[1]})`,
          },
        ]}
      />
    </View>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    label: { ...type.label, marginTop: 12, marginBottom: 10 },
    themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    themeSlot: { width: '47%', flexGrow: 1 },
    theme: {
      padding: 8,
      borderRadius: radii.inset,
      borderWidth: 1,
      borderColor: colors.material.inset.border,
      borderTopColor: colors.material.inset.borderTop,
      backgroundColor: colors.material.inset.fill,
    },
    themeRing: { borderWidth: 2, borderColor: colors.text },
    swatch: { height: 88, borderRadius: 14, padding: 8, justifyContent: 'space-between', overflow: 'hidden' },
    swatchCard: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 7,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    swatchDot: { width: 12, height: 12, borderRadius: 6 },
    swatchLine: { height: 4, borderRadius: 2, width: '80%' },
    swatchLineShort: { width: '50%', marginTop: 4 },
    swatchButton: { alignSelf: 'flex-end', width: 24, height: 24, borderRadius: 12 },
    checkOn: { backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})` },
    themeName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginTop: 8 },
    themeDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    check: { position: 'absolute', top: 14, right: 14, width: 24, height: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 14, paddingHorizontal: 16 },
  });
