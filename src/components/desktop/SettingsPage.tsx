// Settings as a page: your name, the four looks side by side, the phone calendar, backup, where your things live on
// this computer, and the keyboard shortcuts. The same settings and words as the phone's Settings sheet.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { calendarSupported, connectPhoneCalendar } from '../../lib/deviceCalendar';
import { useStore } from '../../lib/store';
import { THEME_OPTIONS, type Theme, useStyles, useTheme } from '../../theme';
import { Input } from '../Field';
import { FadeSwap, SelectFade } from '../Motion';
import { Swatch } from '../SettingsSheet';
import { useShell } from './api';
import { Hover } from './Hover';
import { MOD } from './nav';
import { Column, GlassButton, Page, Panel, Row } from './Page';

const SHORTCUTS: [string, string][] = [
  [`${MOD}+K`, 'Search or jump to a page'],
  [`${MOD}+N`, 'The New menu, then R, T, G or W'],
  [`${MOD}+B`, 'Collapse or expand the sidebar'],
  [`${MOD}+1 to ${MOD}+9`, 'Overview, Today, Calendar, Inbox, Gym, Language, Groceries, Library, Music'],
  [`${MOD}+,`, 'Settings'],
  [`${MOD}+[ and ${MOD}+]`, 'The previous and next day on Today, week or month on Calendar'],
  ['Space or Enter, then 1, 2, 3', 'Turn a review card, then Again, Good or Easy'],
  ['Esc', 'Close the search, a menu or the side panel'],
];

export function SettingsPage() {
  const { colors, radii, type } = useTheme();
  const styles = useStyles(makeStyles);
  const { settings, updateSettings } = useStore();
  const shell = useShell();
  const [name, setName] = useState(settings.name);
  useEffect(() => setName(settings.name), [settings.name]);
  const saveName = () => {
    if (name.trim() !== settings.name) updateSettings({ name: name.trim() });
  };
  const connect = async () => updateSettings({ calendarConnected: await connectPhoneCalendar() });

  return (
    <Page title="Settings" subtitle="Your name, your look and your data.">
      <Row>
        <Column span={8}>
          <Panel span={8} index={0} title="Your name" subtitle="For the greeting on Overview and Today">
            <Text style={styles.label} nativeID="settings-name">
              Your name
            </Text>
            <View style={styles.nameField}>
              <Input
                value={name}
                onChangeText={setName}
                onBlur={saveName}
                onSubmitEditing={saveName}
                placeholder="First name is enough"
                autoCapitalize="words"
                accessibilityLabel="Your name"
                accessibilityLabelledBy="settings-name"
              />
            </View>
          </Panel>

          <Panel span={8} index={1} title="Look" subtitle="The world, the glass and the colours, on every page">
            <View style={styles.looks} role="radiogroup" aria-label="Look">
              {THEME_OPTIONS.map((o) => {
                const active = settings.theme === o.name;
                return (
                  <Hover
                    key={o.name}
                    outerStyle={styles.lookSlot}
                    style={styles.look}
                    radius={radii.inset}
                    role="radio"
                    aria={{ 'aria-checked': active }}
                    onPress={() => updateSettings({ theme: o.name })}
                    accessibilityLabel={`${o.label} look. ${o.description}`}
                  >
                    <SelectFade on={active} radius={radii.inset} bleed={1} style={styles.lookRing} />
                    <Swatch look={o.name} />
                    <Text style={styles.lookName}>{o.label}</Text>
                    <Text style={styles.lookDesc} numberOfLines={2}>
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
                  </Hover>
                );
              })}
            </View>
          </Panel>

          <Panel
            span={8}
            index={2}
            title="Phone calendar"
            subtitle={
              settings.calendarConnected && calendarSupported
                ? 'Connected. Your events show on the timeline.'
                : calendarSupported
                  ? 'Show your events on the timeline. Read-only.'
                  : 'Available in the Android app.'
            }
            right={
              calendarSupported ? (
                <GlassButton
                  label={settings.calendarConnected ? 'Hide events' : 'Connect'}
                  onPress={settings.calendarConnected ? () => updateSettings({ calendarConnected: false }) : connect}
                />
              ) : undefined
            }
          >
            <Text style={type.body}>
              {calendarSupported
                ? 'Events stay in your phone calendar; Symphony OS only reads them.'
                : 'On a computer there is no phone calendar to read. Events from it show on the timeline in the phone app.'}
            </Text>
          </Panel>

          <Panel
            span={8}
            index={3}
            title="Backup and restore"
            subtitle="Keep a copy, or move to a new phone"
            right={<GlassButton label="Open backup" icon="archive-outline" onPress={() => shell.open('backup')} />}
          >
            <Text style={type.body}>A backup is one file with your routines, to-dos, workouts, words, lists and notes.</Text>
          </Panel>

          <Panel span={8} index={4} title="This computer">
            <Text style={type.body}>
              Your things are saved on this computer. The phone app keeps its own copy; use Backup and restore to move everything across.
            </Text>
          </Panel>

          <Panel span={8} index={5} title="Keyboard shortcuts" subtitle={`${MOD === 'Ctrl' ? 'Ctrl' : 'Command'} works from any page`}>
            <View role="list">
              {SHORTCUTS.map(([keys, does], i) => (
                <View key={keys} role="listitem" style={[styles.shortcut, i > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                  <Text style={styles.keys}>{keys}</Text>
                  <Text style={[type.body, styles.flex]}>{does}</Text>
                </View>
              ))}
            </View>
          </Panel>
        </Column>
      </Row>
    </Page>
  );
}

const makeStyles = ({ colors, fonts, type, radii }: Theme) => {
  const inset = colors.material.inset;
  return StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    label: { ...type.label, marginBottom: 8 },
    nameField: { maxWidth: 420 },
    looks: { flexDirection: 'row', gap: 12 },
    lookSlot: { flex: 1, minWidth: 0 },
    look: {
      padding: 8,
      borderRadius: radii.inset,
      borderWidth: 1,
      borderColor: inset.border,
      borderTopColor: inset.borderTop,
      backgroundColor: inset.fill,
    },
    lookRing: { borderWidth: 2, borderColor: colors.litRim },
    lookName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text, marginTop: 10 },
    lookDesc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted, marginTop: 2, minHeight: 38 },
    check: { position: 'absolute', top: 14, right: 14, width: 24, height: 24 },
    checkOn: {
      backgroundImage: `linear-gradient(180deg, ${colors.primaryGradient[0]}, ${colors.primaryGradient[1]})`,
      borderWidth: 2,
      borderColor: colors.material.rimTop,
    },
    shortcut: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 44, paddingVertical: 8 },
    keys: { width: 220, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  });
};
