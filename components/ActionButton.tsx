import React from "react";
import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/theme";

interface ActionButtonProps {
  onActionSelect: (action: "add") => void;
  isSelectionMode?: boolean;
}

export default function ActionButton({ onActionSelect }: ActionButtonProps) {
  return (
    <TouchableOpacity style={styles.fab} onPress={() => onActionSelect("add")}>
      <Ionicons name="add" size={28} color="#fff" />
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
