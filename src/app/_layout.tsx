// Import each weight on its own so only these font files ship with the app.
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { DMMono_400Regular } from '@expo-google-fonts/dm-mono/400Regular';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono/500Medium';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Tabs } from 'expo-router/js-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambience } from '../components/Art';
import { BlurTargetContext, Glass } from '../components/Glass';
import { MiniPlayer, NowPlaying } from '../components/NowPlaying';
import { syncReminders } from '../lib/reminders';
import { SoundProvider } from '../lib/sounds';
import { StoreProvider, useStore } from '../lib/store';
import { ThemeContext, themeFor } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline', iconActive: 'today' },
  { name: 'inbox', title: 'Inbox', icon: 'file-tray-outline', iconActive: 'file-tray' },
  { name: 'gym', title: 'Gym', icon: 'barbell-outline', iconActive: 'barbell' },
  { name: 'chinese', title: 'Chinese', icon: 'language-outline', iconActive: 'language' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconActive: 'library' },
];

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
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
  const { colors, fonts, glass } = theme;
  const insets = useSafeAreaInsets();
  const barBottom = glass ? insets.bottom + 10 : 0;
  const barHeight = glass ? 72 : 56 + insets.bottom;

  return (
    <ThemeContext.Provider value={theme}>
      <View style={styles.root}>
        <LinearGradient colors={colors.gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} />
        <StatusBar style={colors.statusBar} />
        <ReminderSync />
        <Tabs
          // Each screen paints its own gradient, so screens kept alive in the background never show through.
          screenLayout={({ children }) => <ScreenFrame gradient={colors.gradient}>{children}</ScreenFrame>}
          screenOptions={{
            tabBarActiveTintColor: colors.text,
            tabBarInactiveTintColor: colors.faint,
            tabBarStyle: glass
              ? {
                  position: 'absolute',
                  marginHorizontal: 16,
                  bottom: barBottom,
                  height: barHeight,
                  paddingTop: 8,
                  paddingBottom: 12,
                  borderRadius: 28,
                  borderTopWidth: 1,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderTopColor: colors.cardBorder,
                  backgroundColor: 'transparent',
                  overflow: 'hidden',
                  elevation: 0,
                }
              : {
                  backgroundColor: colors.tabBar,
                  borderTopColor: colors.border,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  elevation: 0,
                },
            tabBarBackground: glass ? () => <Glass radius={28} intensity={50} style={StyleSheet.absoluteFill} /> : undefined,
            tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
            headerStyle: { backgroundColor: colors.gradient[0] },
            headerShadowVisible: false,
            headerTitleAlign: 'left',
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
            sceneStyle: { backgroundColor: 'transparent' },
          }}
        >
          {TABS.map((t) => (
            <Tabs.Screen
              key={t.name}
              name={t.name}
              options={{
                title: t.title,
                headerShown: t.name === 'gym' || t.name === 'chinese',
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? t.iconActive : t.icon} color={color as string} size={size - 2} />
                ),
              }}
            />
          ))}
        </Tabs>
        <MiniPlayer bottom={barBottom + barHeight + 10} />
        <NowPlaying />
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

/** Each screen paints its own backdrop (gradient, light and glow), so screens kept alive in the
 *  background never show through, and glass on the screen has something to blur. */
function ScreenFrame({ gradient, children }: { gradient: [string, string, string]; children: ReactNode }) {
  const target = useRef<ComponentRef<typeof View>>(null);
  return (
    <View style={styles.root}>
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} />
        <Ambience />
      </BlurTargetView>
      <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>
    </View>
  );
}

/** Keeps scheduled notifications in step with the routines' reminder times. */
function ReminderSync() {
  const { ready, routines } = useStore();
  const key = JSON.stringify(routines.map((r) => [r.name, r.repeat, r.reminder, r.target, r.repeat.kind === 'once' && r.doneDates.length > 0]));
  useEffect(() => {
    if (ready) syncReminders(routines).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);
  return null;
}
