import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseConfig";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { ColmeiaProvider } from "@/contexts/ColmeiaContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Monitora mudanças no estado de autenticação
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log(
        "Estado de autenticação mudou:",
        firebaseUser ? firebaseUser.uid : "null"
      );
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inAppGroup = segments[0] === "(app)";
    const isAnonymous = user?.isAnonymous || false;

    console.log("Verificando navegação:", {
      user: !!user,
      isAnonymous,
      inAuthGroup,
      inAppGroup,
      segments,
    });

    // Se usuário anônimo está tentando acessar signup, permite (para converter conta)
    if (user && isAnonymous && inAuthGroup && segments[1] === "signup") {
      console.log("Usuário anônimo acessando signup - permitido");
      return; // Não redireciona
    }

    // Se usuário está logado (não anônimo) e está na área de auth, redireciona para app
    if (user && !isAnonymous && inAuthGroup) {
      console.log("Redirecionando para /app/home");
      router.replace("/(app)/home");
    }
    // Se usuário não está logado e está na área de app, redireciona para login
    else if (!user && inAppGroup) {
      console.log("Redirecionando para /auth/login");
      router.replace("/(auth)/login");
    }
  }, [user, segments, loading]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <ColmeiaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ColmeiaProvider>
    </ThemeProvider>
  );
}
