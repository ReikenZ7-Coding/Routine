import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../lib/store';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color as string} size={size} />,
          }}
        />
        <Tabs.Screen
          name="groceries"
          options={{
            title: 'Groceries',
            tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" color={color as string} size={size} />,
          }}
        />
        <Tabs.Screen
          name="gym"
          options={{
            title: 'Gym',
            tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" color={color as string} size={size} />,
          }}
        />
      </Tabs>
    </StoreProvider>
  );
}
