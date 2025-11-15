/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// Warm hive palette: honey yellows and browns plus supportive colors
const primaryHoney = "#FFB300"; // warm honey/yellow
const colmeiaOrange = "#FFB300"; // Cor oficial da Colmeia para cards
const warmBrown = "#7A4B2B"; // hive/wood brown
const successGreen = "#34C759";
const dangerRed = "#FF3B30";
const softBackground = "#F6F6F1"; // updated to requested app background

export const Colors = {
  light: {
    text: "#3B2F2F",
    background: softBackground,
    tint: primaryHoney,
    primary: primaryHoney,
    secondary: warmBrown,
    success: successGreen,
    danger: dangerRed,
    icon: "#6E5A4A",
    tabIconDefault: "#6E5A4A",
    tabIconSelected: primaryHoney,
  },
  dark: {
    text: "#ECEDEE",
    background: "#2B241F",
    tint: "#FFD54A",
    primary: "#FFD54A",
    secondary: "#6B4A36",
    success: successGreen,
    danger: dangerRed,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: "#FFD54A",
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Helper function to lighten a color
const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.floor(((num >> 16) * (100 + percent)) / 100));
  const g = Math.min(
    255,
    Math.floor((((num >> 8) & 0x00ff) * (100 + percent)) / 100)
  );
  const b = Math.min(
    255,
    Math.floor(((num & 0x0000ff) * (100 + percent)) / 100)
  );
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};

export const CustomThemes: Record<
  string,
  {
    text: string;
    background: string;
    primary: string;
    secondary: string;
    success: string;
    danger: string;
    icon: string;
    cardBackground: string;
  }
> = {
  // Primavera - Dia (Verde, amarelo, rosa)
  "primavera-dia": {
    text: "#2E5934",
    background: "#F5FCF5",
    primary: "#4CAF50",
    secondary: "#FFD54F",
    success: "#00C853",
    danger: "#EC407A",
    icon: "#9E9E9E",
    cardBackground: "#FEFFFD", // Mais claro que o fundo
  },
  // Primavera - Noite
  "primavera-noite": {
    text: "#E8F5E9",
    background: "#1A2E1F",
    primary: "#66BB6A",
    secondary: "#FFE082",
    success: "#00E676",
    danger: "#F48FB1",
    icon: "#757575",
    cardBackground: "#243A29", // Mais claro que o fundo
  },
  // Verão - Dia (Fundo suave azul-claro, destaques amarelo-dourado)
  "verao-dia": {
    // inspiração: céu de verão + sol dourado
    text: "#37474F",
    background: "#FFF9E6",
    primary: "#FFA000",
    secondary: "#FFD54F",
    success: "#00C853",
    danger: "#EF5350",
    icon: "#9E9E9E",
    cardBackground: "#FFFFFF", // Mais claro que o fundo
  },
  // Verão - Noite
  "verao-noite": {
    text: "#FFF3E0",
    background: "#2D2416",
    primary: "#FFB74D",
    secondary: "#FFD54F",
    success: "#00E676",
    danger: "#E57373",
    icon: "#757575",
    cardBackground: "#3D3420", // Mais claro que o fundo
  },
  // Outono - Dia (Inspirado em folhas de outono, tons quentes e aconchegantes)
  "outono-dia": {
    // Paleta: Burnt Orange (#CC5500), Golden Brown (#996515), Mustard (#E1AD01)
    // Fundo suave em bege/creme claro para não cansar
    text: "#4A3C2A",
    background: "#F5EFE6",
    primary: "#CC5500",
    secondary: "#996515",
    success: "#00C853",
    danger: "#E64A19",
    icon: "#9E9E9E",
    cardBackground: "#FFFCF7", // Branco levemente creme
  },
  // Outono - Noite
  "outono-noite": {
    text: "#EFEBE9",
    background: "#251A14",
    primary: "#FF7043",
    secondary: "#A1887F",
    success: "#00E676",
    danger: "#E57373",
    icon: "#757575",
    cardBackground: "#332720", // Mais claro que o fundo
  },
  // Inverno - Dia (Azul claro, azul escuro, cinza, marrom)
  "inverno-dia": {
    text: "#263238",
    background: "#ECEFF1",
    primary: "#1976D2",
    secondary: "#78909C",
    success: "#00C853",
    danger: "#EF5350",
    icon: "#9E9E9E",
    cardBackground: "#F8FAFB", // Mais claro que o fundo
  },
  // Inverno - Noite
  "inverno-noite": {
    text: "#ECEFF1",
    background: "#1A1F24",
    primary: "#42A5F5",
    secondary: "#90A4AE",
    success: "#00E676",
    danger: "#E57373",
    icon: "#757575",
    cardBackground: "#242A30", // Mais claro que o fundo
  },
};
