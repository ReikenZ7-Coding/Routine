import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { calendarSupported, connectPhoneCalendar } from '../lib/deviceCalendar';
import { useStore } from '../lib/store';
import { THEME_OPTIONS, type Theme, themeFor, useStyles, useTheme } from '../theme';
import { Divider, Section } from './Section';
import { Sheet } from './Sheet';

/** Look, name, phone calendar and backup. */
export function SettingsSheet({ visible, onClose, onBackup }: { visible: boolean; onClose: () => void; onBackup: () => void }) {
  const { colors, type } = useTheme();
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
            <Pressable
              key={o.name}
              style={[styles.theme, active && styles.themeActive]}
              onPress={() => updateSettings({ theme: o.name })}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${o.label} look`}
            >
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
              {active && (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Your name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        onBlur={saveName}
        onSubmitEditing={saveName}
        placeholder="For the morning greeting"
        placeholderTextColor={colors.faint}
        autoCapitalize="words"
      />

      <Section title="More">
        <Pressable accessibilityRole="button"
          style={styles.row}
          onPress={
            settings.calendarConnected ? () => updateSettings({ calendarConnected: false }) : calendarSupported ? connect : undefined
          }
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
        </Pressable>
        <Divider inset={50} />
        <Pressable accessibilityRole="button" style={styles.row} onPress={onBackup}>
          <Ionicons name="archive-outline" size={20} color={colors.text} />
          <View style={styles.flex}>
            <Text style={type.bodyMedium}>Backup and restore</Text>
            <Text style={type.small}>Keep a copy, or move to a new phone.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Pressable>
      </Section>
    </Sheet>
  );
}

const makeStyles = ({ colors, fonts, type, radius }: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    label: { ...type.label, marginTop: 18, marginBottom: 10 },
    themes: { flexDirection: 'row', gap: 10 },
    theme: { flex: 1, padding: 8, borderRadius: radius, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
    themeActive: { borderColor: colors.text, borderWidth: 2, padding: 7 },
    swatch: { height: 88, borderRadius: 14, padding: 8, justifyContent: 'space-between', overflow: 'hidden' },
    swatchCard: { borderRadius: 8, borderWidth: 1, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatchDot: { width: 10, height: 10, borderRadius: 5 },
    swatchLine: { flex: 1, height: 4, borderRadius: 2, opacity: 0.8 },
    swatchButton: { alignSelf: 'flex-end', width: 22, height: 22, borderRadius: 11 },
    themeName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, marginTop: 8 },
    themeDesc: { fontFamily: fonts.body, fontSize: 12, lineHeight: 14, color: colors.muted, marginTop: 2 },
    check: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.input,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.text,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  });
