// Import each weight on its own so only these font files ship with the app.
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import { DMSans_300Light } from '@expo-google-fonts/dm-sans/300Light';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router/js-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Easing, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambience } from '../components/Art';
import { ActiveBlurTargetContext, LightRoot, WorldFrame } from '../components/Glass';
import { useBar } from '../components/glass/chrome';
import type { BlurTarget } from '../components/glass/targets';
import { GlassTabBar } from '../components/GlassTabBar';
import { MiniPlayer, NowPlaying } from '../components/NowPlaying';
import { ThemeFade } from '../components/ThemeFade';
import { syncReminders } from '../lib/reminders';
import { SoundProvider } from '../lib/sounds';
import { tabTitle } from '../lib/language';
import { StoreProvider, useStore } from '../lib/store';
import { ThemeContext, themeFor, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * When true, each screen's content is drawn inside its blur target, so the tab bar and mini player frost the
 * rows passing under them. Off until profiled on a mid-range phone: Dimezis re-records the target whenever the
 * content invalidates, so every scroll frame would re-blur the chrome. Off, chrome blurs the backdrop only.
 */
const CHROME_BLURS_CONTENT = false;

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Switching tabs crossfades the screens over 180ms with the house ease-out (never a 0ms cut, and never the
 * sideways 'shift', which is motion reduced-motion users asked to lose; the fade stays for them). The navigator
 * runs it with React Native's native driver. Both screens paint the same world, and the root paints it too, so
 * only the content changes while they fade.
 */
const TAB_FADE = {
  animation: 'fade',
  transitionSpec: { animation: 'timing', config: { duration: 180, easing: Easing.bezier(0.23, 1, 0.32, 1) } },
} as const;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline', iconActive: 'today' },
  { name: 'inbox', title: 'Inbox', icon: 'file-tray-outline', iconActive: 'file-tray' },
  { name: 'gym', title: 'Gym', icon: 'barbell-outline', iconActive: 'barbell' },
  // Always "Language", whatever is being learnt (see tabTitle).
  { name: 'language', title: 'Language', icon: 'language-outline', iconActive: 'language' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconActive: 'library' },
];

// Keyboard focus on web: a white ring with a dark halo reads on every look's background.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const focus = document.createElement('style');
  focus.textContent =
    '[role="button"]:focus-visible,[role="checkbox"]:focus-visible,[role="tab"]:focus-visible,[role="link"]:focus-visible,input:focus-visible,textarea:focus-visible' +
    '{outline:2px solid #FFFFFF !important;outline-offset:2px;box-shadow:0 0 0 5px rgba(20,22,48,0.85) !important}';
  document.head.appendChild(focus);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <StoreProvider>
      <SoundProvider>
        <ThemedApp />
      </SoundProvider>
    </StoreProvider>
  );
}

function ThemedApp() {
  const { settings } = useStore();
  const theme = themeFor(settings.theme);
  return (
    <ThemeContext.Provider value={theme}>
      <LightRoot>
        <Shell />
      </LightRoot>
    </ThemeContext.Provider>
  );
}

function Shell() {
  const { colors, fonts } = useTheme();
  const { language } = useStore();
  const bar = useBar();
  // The focused screen hands its blur target up, so chrome drawn over every screen blurs the right world.
  const [target, setTarget] = useState<BlurTarget | null>(null);
  const onTarget = useCallback((t: BlurTarget) => setTarget(() => t), []);

  return (
    <ActiveBlurTargetContext.Provider value={target}>
      <View style={styles.root}>
        <LinearGradient colors={colors.gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} />
        {/* The world under the screens: while two screens crossfade, what shows through them is the same world. */}
        <Ambience />
        <StatusBar style={colors.statusBar} />
        <ReminderSync />
        <Tabs
          tabBar={(props) => <GlassTabBar {...props} bottom={bar.bottom} height={bar.height} />}
          // Each screen paints its own world, so screens kept alive in the background never show through.
          screenLayout={({ children }) => <ScreenFrame onTarget={onTarget}>{children}</ScreenFrame>}
          screenOptions={{
            tabBarActiveTintColor: colors.text,
            tabBarInactiveTintColor: colors.muted,
            tabBarItemStyle: { minHeight: 48 },
            tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
            headerStyle: { backgroundColor: colors.gradient[0] },
            headerShadowVisible: false,
            headerTitleAlign: 'left',
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
            sceneStyle: { backgroundColor: 'transparent' },
            ...TAB_FADE,
          }}
        >
          {TABS.map((t) => (
            <Tabs.Screen
              key={t.name}
              name={t.name}
              options={{
                title: t.name === 'language' ? tabTitle(language.languages) : t.title,
                headerShown: false,
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? t.iconActive : t.icon} color={color as string} size={size - 2} />
                ),
              }}
            />
          ))}
        </Tabs>
        <MiniPlayer bottom={bar.bottom + bar.height + 10} />
        <NowPlaying />
        <ThemeFade />
      </View>
    </ActiveBlurTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  edge: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomEdge: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});

/**
 * Each screen paints its own world (WorldFrame: the backdrop in the blur target, then the moving light), then
 * its content, then the scroll edges: content fades out under the status bar, and fades into the world before
 * it slides under the tab bar.
 */
function ScreenFrame({ onTarget, children }: { onTarget: (t: BlurTarget) => void; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  return (
    <WorldFrame focused={focused} onTarget={onTarget} contentInTarget={CHROME_BLURS_CONTENT}>
      {children}
      <LinearGradient colors={colors.edgeTop} style={[styles.edge, { height: insets.top + 24 }]} pointerEvents="none" />
      <LinearGradient colors={colors.edgeBottom} style={[styles.bottomEdge, { height: insets.bottom + 96 }]} pointerEvents="none" />
    </WorldFrame>
  );
}

/** Keeps scheduled notifications in step with the routines' reminder times. */
function ReminderSync() {
  const { ready, routines } = useStore();
  const key = JSON.stringify(
    routines.map((r) => [r.name, r.repeat, r.reminder, r.target, r.repeat.kind === 'once' && r.doneDates.length > 0]),
  );
  useEffect(() => {
    if (ready) syncReminders(routines).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);
  return null;
}
