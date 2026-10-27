import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { InstallProvider } from '@/lib/install';
import { AuthProvider } from '@/lib/auth';
import { LangProvider } from '@/lib/i18n';
import { C } from '@/lib/theme';

export default function RootLayout() {
  const [loaded, error] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  // Si la fuente tarda (conexión lenta), mostramos la app de todos modos a los 2.5 s
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 2500);
    return () => clearTimeout(t);
  }, []);
  if (!loaded && !error && !late) return null;
  return (
    <SafeAreaProvider>
      <LangProvider>
        <InstallProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.page } }} />
          </AuthProvider>
        </InstallProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}
