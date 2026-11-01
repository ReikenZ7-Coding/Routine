import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { calendarSupported, connectPhoneCalendar } from '../lib/deviceCalendar';
import { useStore } from '../lib/store';
import { THEME_OPTIONS, type Theme, themeFor, useStyles, useTheme } from '../theme';
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
              <LinearGradient colors={t.colors.gradient} style={styles.swatch}>
                <View style={[styles.swatchCard, { backgroundColor: t.colors.card, borderColor: t.colors.cardBorder }]}>
                  <View style={[styles.swatchDot, { backgroundColor: t.kinds.routines.color }]} />
                  <View style={[styles.swatchLine, { backgroundColor: t.colors.text }]} />
                </View>
                <View style={[styles.swatchButton, { backgroundColor: t.colors.primary }]} />
              </LinearGradient>
              <Text style={styles.themeName}>{o.label}</Text>
              <Text style={styles.themeDesc} numberOfLines={2}>
                {o.description}
              </Text>
              <View style={styles.check} pointerEvents="none">
                <SelectFade on={active} radius={12} color={colors.selected} />
                <FadeSwap
                  on={active}
                  style={StyleSheet.absoluteFill}
                  off={null}
                  onContent={<Ionicons name="checkmark" size={14} color={colors.onSelected} />}
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
    swatchCard: { borderRadius: 8, borderWidth: 1, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatchDot: { width: 10, height: 10, borderRadius: 5 },
    swatchLine: { flex: 1, height: 4, borderRadius: 2, opacity: 0.8 },
    swatchButton: { alignSelf: 'flex-end', width: 22, height: 22, borderRadius: 11 },
    themeName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginTop: 8 },
    themeDesc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },
    check: { position: 'absolute', top: 14, right: 14, width: 24, height: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 14, paddingHorizontal: 16 },
  });
