/**
 * VotingButton Component
 * Botão flutuante de votações com modal integrado
 * Exibe apenas votações do tipo especificado
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { auth, db } from "@/firebaseConfig";
import { doc, deleteDoc } from "firebase/firestore";
import { addVote, removeVote } from "@/utils/votingSystem";

interface Vote {
  id: string;
  type: string;
  targetId: string;
  targetName: string;
  votes: string[];
  requiredVotes: number;
  status: string;
  createdBy: string;
}

interface VotingButtonProps {
  votes: Vote[];
  voteType: string; // "delete_task", "delete_routine", etc.
  colmeiaId: string;
  visible?: boolean; // Controla se o botão deve ser visível
  style?: object; // Estilo customizado para posicionamento
}

export default function VotingButton({
  votes,
  voteType,
  colmeiaId,
  visible = true,
  style,
}: VotingButtonProps) {
  const theme = useAppTheme();
  const [modalVisible, setModalVisible] = useState(false);

  // Não renderiza se não houver colmeiaId
  if (!colmeiaId) {
    return null;
  }

  // Filtra apenas as votações do tipo especificado
  const filteredVotes = votes.filter((vote) => vote.type === voteType);

  const handleVote = async (voteId: string) => {
    try {
      await addVote(colmeiaId, voteId);
      Alert.alert("Sucesso", "Seu voto foi registrado!");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível registrar o voto");
    }
  };

  const handleRemoveVote = async (voteId: string) => {
    try {
      await removeVote(colmeiaId, voteId);
      Alert.alert("Sucesso", "Seu voto foi removido!");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível remover o voto");
    }
  };

  const handleRejectVote = async (voteId: string) => {
    Alert.alert(
      "Rejeitar Votação",
      "Tem certeza que deseja rejeitar esta votação? Ela será cancelada.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Rejeitar",
          style: "destructive",
          onPress: async () => {
            try {
              // Remove a votação do Firestore
              const voteRef = doc(db, "colmeias", colmeiaId, "votes", voteId);
              await deleteDoc(voteRef);
              Alert.alert("Sucesso", "Votação rejeitada!");
            } catch (error: any) {
              Alert.alert(
                "Erro",
                error.message || "Não foi possível rejeitar a votação"
              );
            }
          },
        },
      ]
    );
  };

  const getVoteDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      delete_task: "Votação para excluir tarefa",
      delete_routine: "Votação para excluir rotina",
      delete_shopping: "Votação para excluir item de compra",
      delete_expense: "Votação para excluir despesa",
    };
    return descriptions[type] || "Votação pendente";
  };

  // Não renderiza nada se não houver votações ou se não for visível
  if (!visible || filteredVotes.length === 0) {
    return null;
  }

  return (
    <>
      {/* Botão Flutuante */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.danger }, style]}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="thumbs-up" size={24} color="#fff" />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{filteredVotes.length}</Text>
        </View>
      </TouchableOpacity>

      {/* Modal de Votações */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Votações Pendentes
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            {filteredVotes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.textOnCard }]}>
                  Nenhuma votação pendente
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredVotes}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const userId = auth.currentUser?.uid;
                  const hasVoted = userId && item.votes.includes(userId);
                  const isCreator = userId === item.createdBy;
                  const votePercentage =
                    (item.votes.length / item.requiredVotes) * 100;

                  return (
                    <View
                      style={[
                        styles.voteCard,
                        { backgroundColor: theme.background },
                      ]}
                    >
                      <View style={styles.voteHeader}>
                        <Ionicons name="trash" size={20} color={theme.danger} />
                        <Text
                          style={[
                            styles.voteTitle,
                            { color: theme.textOnCard },
                          ]}
                        >
                          {item.targetName}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.voteDescription,
                          { color: theme.textOnCard, opacity: 0.7 },
                        ]}
                      >
                        {getVoteDescription(item.type)}
                      </Text>

                      <View style={styles.voteProgress}>
                        <View
                          style={[
                            styles.progressBarContainer,
                            { backgroundColor: theme.textOnCard + "20" },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressBar,
                              {
                                width: `${votePercentage}%`,
                                backgroundColor: theme.success,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.voteCount,
                            { color: theme.textOnCard },
                          ]}
                        >
                          {item.votes.length} de {item.requiredVotes} votos
                        </Text>
                      </View>

                      <View style={styles.voteActions}>
                        {hasVoted ? (
                          <>
                            <View
                              style={[
                                styles.votedBadge,
                                { backgroundColor: theme.success + "20" },
                              ]}
                            >
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={theme.success}
                              />
                              <Text
                                style={[
                                  styles.votedText,
                                  { color: theme.success },
                                ]}
                              >
                                Você votou
                              </Text>
                            </View>
                            {!isCreator && (
                              <TouchableOpacity
                                style={[
                                  styles.removeVoteButton,
                                  { backgroundColor: theme.danger + "20" },
                                ]}
                                onPress={() => handleRemoveVote(item.id)}
                              >
                                <Text
                                  style={[
                                    styles.removeVoteText,
                                    { color: theme.danger },
                                  ]}
                                >
                                  Remover voto
                                </Text>
                              </TouchableOpacity>
                            )}
                          </>
                        ) : (
                          <View style={styles.buttonRow}>
                            <TouchableOpacity
                              style={[
                                styles.voteButton,
                                { backgroundColor: theme.success },
                              ]}
                              onPress={() => handleVote(item.id)}
                            >
                              <Ionicons
                                name="thumbs-up"
                                size={16}
                                color="#fff"
                              />
                              <Text style={styles.voteButtonText}>Aprovar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.rejectButton,
                                { backgroundColor: theme.danger },
                              ]}
                              onPress={() => handleRejectVote(item.id)}
                            >
                              <Ionicons
                                name="thumbs-down"
                                size={16}
                                color="#fff"
                              />
                              <Text style={styles.voteButtonText}>
                                Rejeitar
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    left: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 4px 8px rgba(0,0,0,0.3)",
    elevation: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FF3B30",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  voteCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  voteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  voteTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  voteDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  voteProgress: {
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  voteCount: {
    fontSize: 12,
    textAlign: "center",
  },
  voteActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    justifyContent: "space-between",
  },
  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  votedText: {
    fontSize: 14,
    fontWeight: "500",
  },
  voteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  removeVoteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeVoteText: {
    fontSize: 14,
  },
});
