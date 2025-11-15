import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function FloatingActionButton({
  onPress,
  icon = "add",
}: FloatingActionButtonProps) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress}>
      <Ionicons name={icon} size={28} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 4px 8px rgba(0,0,0,0.3)",
    elevation: 8,
  },
});
