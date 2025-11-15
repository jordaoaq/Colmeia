import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColmeia, useTheme, ThemeProvider } from "@/contexts/ColmeiaContext";
import { CustomThemes } from "@/constants/theme";
import SettingsModal from "@/components/SettingsModal";

// Wrapper interno que usa o ThemeProvider
function AppLayoutContent() {
  const { activeColmeia } = useColmeia();
  const { currentTheme } = useTheme();
  const theme = CustomThemes[currentTheme];
  const [settingsVisible, setSettingsVisible] = useState(false);
  const insets = useSafeAreaInsets();

  // helper: retorna uma variação levemente mais escura de um hex (#rrggbb)
  const darkenHex = (hex: string, amount = 0.06) => {
    try {
      const h = hex.replace("#", "");
      const num = parseInt(h, 16);
      let r = (num >> 16) & 0xff;
      let g = (num >> 8) & 0xff;
      let b = num & 0xff;
      r = Math.max(0, Math.min(255, Math.round(r * (1 - amount))));
      g = Math.max(0, Math.min(255, Math.round(g * (1 - amount))));
      b = Math.max(0, Math.min(255, Math.round(b * (1 - amount))));
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) {
      return hex; // fallback
    }
  };

  const tabBarBackground = darkenHex(theme.background, 0.06);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: theme.background },
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Image
                source={require("../../assets/images/colmeia-logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <Text style={[styles.headerTitleText, { color: theme.text }]}>
                {activeColmeia?.name || "Colmeia"}
              </Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setSettingsVisible(true)}
            >
              <Ionicons
                name="settings-outline"
                size={24}
                color={theme.primary}
              />
            </TouchableOpacity>
          ),
          // manter labels e ícones padrão; usar cores de tint para ativo/inativo
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.icon,
          // barra com fundo levemente mais escuro que o restante do app
          tabBarStyle: {
            backgroundColor: tabBarBackground,
            borderTopWidth: 1,
            borderTopColor: theme.secondary + "40",
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom + 4,
            paddingTop: 1,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
            marginTop: 2,
          },
          tabBarItemStyle: {
            paddingVertical: 2,
            paddingHorizontal: 4,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Início",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="listas"
          options={{
            title: "Tarefas",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkbox-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="rotinas"
          options={{
            title: "Rotinas",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="compras"
          options={{
            title: "Compras",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="financas"
          options={{
            title: "Finanças",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="colmeias"
          options={{
            title: "Colmeias",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cube" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </>
  );
}

export default function AppLayout() {
  return (
    <ThemeProvider>
      <AppLayoutContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  notificationButton: {
    marginRight: 16,
    padding: 4,
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerLogo: {
    width: 28,
    height: 28,
    marginRight: 8,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: "600",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "column",
  },
  tabItemActive: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});
