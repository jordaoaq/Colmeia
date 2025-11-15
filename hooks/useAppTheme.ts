import { useTheme } from "@/contexts/ColmeiaContext";
import { CustomThemes } from "@/constants/theme";

/**
 * Hook personalizado para obter as cores do tema atual
 * Cards agora usam cores mais claras que o fundo
 */
export function useAppTheme() {
  const { currentTheme } = useTheme();
  const theme = CustomThemes[currentTheme];

  return {
    ...theme,
    // Cores específicas para elementos
    cardColor: theme.cardBackground, // Card sempre mais claro que o fundo
    textOnBackground: theme.text, // Texto com alto contraste sobre o fundo
    textOnCard: theme.text, // Texto com mesmo contraste nos cards
  };
}
