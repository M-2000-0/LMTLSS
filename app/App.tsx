import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import OnboardingScreen from './src/screens/OnboardingScreen';
import TodayScreen from './src/screens/TodayScreen';
import { useAppStore } from './src/store/appStore';
import { colors, space, type as typeScale } from './src/theme';

type RootStackParamList = {
  Today: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/* Brand tokens (css/tokens.css): canvas #000, ink #fff, line #262626.
   Accent #61EB1A stays functional — selected state and primary action only. */
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function BootScreen() {
  return (
    <View style={styles.boot}>
      <Text style={styles.mark}>LMTLSS</Text>
      <Text style={styles.tagline}>YOUR PERFORMANCE. WITHOUT LIMITS.</Text>
      <ActivityIndicator color={colors.accent} style={styles.spinner} />
      <Text style={styles.bootNote}>Reading your data on this device…</Text>
    </View>
  );
}

function AppShell() {
  const { ready, state } = useAppStore();

  if (!ready) return <BootScreen />;
  if (!state.profile) return <OnboardingScreen />;

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Today" component={TodayScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: 'center',
    padding: space.s6,
  },
  mark: { ...typeScale.hero, color: colors.text },
  tagline: {
    ...typeScale.micro,
    color: colors.textSecondary,
    marginTop: space.s2,
  },
  spinner: { marginTop: space.s8 },
  bootNote: { ...typeScale.small, color: colors.textMuted, marginTop: space.s3 },
});
