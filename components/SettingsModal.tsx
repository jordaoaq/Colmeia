import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ColmeiaContext";
import { CustomThemes } from "@/constants/theme";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
}: SettingsModalProps) {
  const { timeOfDay, season, setTimeOfDay, setSeason, currentTheme } =
    useTheme();
  const theme = CustomThemes[currentTheme];

  const seasons = [
    {
      key: "primavera",
      label: "Primavera",
      emoji: "🌸",
      description: "Verde, amarelo e rosa",
    },
    {
      key: "verao",
      label: "Verão",
      emoji: "☀️",
      description: "Laranja e amarelo",
    },
    {
      key: "outono",
      label: "Outono",
      emoji: "🍂",
      description: "Marrom e bege",
    },
    {
      key: "inverno",
      label: "Inverno",
      emoji: "❄️",
      description: "Azul e cinza",
    },
  ] as const;

  const times = [
    { key: "dia", label: "Dia", emoji: "☀️" },
    { key: "noite", label: "Noite", emoji: "🌙" },
  ] as const;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          {/* Header */}
          <View
            style={[styles.header, { borderBottomColor: theme.text + "20" }]}
          >
            <Text style={[styles.title, { color: theme.text }]}>
              Configurações de Tema
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Período do Dia */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Período do Dia
              </Text>
              <View style={styles.optionsRow}>
                {times.map((time) => (
                  <TouchableOpacity
                    key={time.key}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: theme.background,
                        borderColor:
                          timeOfDay === time.key
                            ? theme.primary
                            : theme.text + "30",
                        borderWidth: timeOfDay === time.key ? 3 : 2,
                      },
                    ]}
                    onPress={() => setTimeOfDay(time.key)}
                  >
                    <Text style={styles.emoji}>{time.emoji}</Text>
                    <Text style={[styles.optionLabel, { color: theme.text }]}>
                      {time.label}
                    </Text>
                    {timeOfDay === time.key && (
                      <View
                        style={[
                          styles.checkmark,
                          { backgroundColor: theme.primary },
                        ]}
                      >
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Estação */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Estação
              </Text>
              {seasons.map((seasonItem) => (
                <TouchableOpacity
                  key={seasonItem.key}
                  style={[
                    styles.seasonCard,
                    {
                      backgroundColor: theme.background,
                      borderColor:
                        season === seasonItem.key
                          ? theme.primary
                          : theme.text + "30",
                      borderWidth: season === seasonItem.key ? 3 : 2,
                    },
                  ]}
                  onPress={() => setSeason(seasonItem.key)}
                >
                  <View style={styles.seasonInfo}>
                    <Text style={styles.seasonEmoji}>{seasonItem.emoji}</Text>
                    <View style={styles.seasonText}>
                      <Text style={[styles.seasonLabel, { color: theme.text }]}>
                        {seasonItem.label}
                      </Text>
                      <Text
                        style={[
                          styles.seasonDescription,
                          { color: theme.text, opacity: 0.7 },
                        ]}
                      >
                        {seasonItem.description}
                      </Text>
                    </View>
                  </View>
                  {season === seasonItem.key && (
                    <Ionicons
                      name="checkmark-circle"
                      size={28}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    boxShadow: "0px -2px 4px rgba(0, 0, 0, 0.25)",
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  optionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  seasonCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  seasonInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  seasonEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  seasonText: {
    flex: 1,
  },
  seasonLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  seasonDescription: {
    fontSize: 14,
  },
});
