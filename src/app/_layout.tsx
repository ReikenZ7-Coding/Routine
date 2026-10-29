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
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { StoreProvider } from '../lib/store';
import { colors, fonts } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Plan', icon: 'calendar-clear-outline', iconActive: 'calendar-clear' },
  { name: 'routines', title: 'Routines', icon: 'repeat-outline', iconActive: 'repeat' },
  { name: 'gym', title: 'Gym', icon: 'barbell-outline', iconActive: 'barbell' },
  { name: 'chinese', title: 'Chinese', icon: 'language-outline', iconActive: 'language' },
  { name: 'groceries', title: 'Groceries', icon: 'basket-outline', iconActive: 'basket' },
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
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.faint,
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            elevation: 0,
          },
          tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTitleAlign: 'left',
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        {TABS.map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              headerShown: t.name !== 'index',
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? t.iconActive : t.icon} color={color as string} size={size - 2} />
              ),
            }}
          />
        ))}
      </Tabs>
    </StoreProvider>
  );
}
