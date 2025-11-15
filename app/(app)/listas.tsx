/**
 * Listas screen
 * Simple task lists with optional voting flow for deletions and bulk actions.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColmeia } from "@/contexts/ColmeiaContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import { addActivityLog } from "@/utils/activityLogger";
import ActionButton from "@/components/ActionButton";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import {
  createVote,
  addVote,
  removeVote,
  getPendingVotes,
  needsVoting,
  deleteTaskDirect,
} from "@/utils/votingSystem";

type ActionType = "add" | "edit";

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt?: any;
  createdBy?: string;
}

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

export default function ListasScreen() {
  const { activeColmeia } = useColmeia();
  const theme = useAppTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingVotes, setPendingVotes] = useState<Vote[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [votesModalVisible, setVotesModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);

  // Sincronização em tempo real das tarefas
  useEffect(() => {
    if (!activeColmeia) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const tasksRef = collection(db, "colmeias", activeColmeia.id, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedTasks: Task[] = [];
        snapshot.forEach((doc) => {
          fetchedTasks.push({
            id: doc.id,
            ...doc.data(),
          } as Task);
        });
        setTasks(fetchedTasks);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao buscar tarefas:", error);
        Alert.alert("Erro", "Não foi possível carregar as tarefas");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeColmeia]);

  // Sincronização em tempo real das votações pendentes
  useEffect(() => {
    if (!activeColmeia) {
      setPendingVotes([]);
      return;
    }

    const votesRef = collection(db, "colmeias", activeColmeia.id, "votes");
    const q = query(votesRef, where("status", "==", "pending"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedVotes: Vote[] = [];
      snapshot.forEach((doc) => {
        fetchedVotes.push({
          id: doc.id,
          ...doc.data(),
        } as Vote);
      });
      setPendingVotes(fetchedVotes);
    });

    return () => unsubscribe();
  }, [activeColmeia]);

  const toggleTask = async (task: Task) => {
    if (!activeColmeia) return;

    try {
      const taskRef = doc(db, "colmeias", activeColmeia.id, "tasks", task.id);
      const newCompletedState = !task.completed;

      await updateDoc(taskRef, {
        completed: newCompletedState,
      });

      // Registra atividade
      await addActivityLog({
        colmeiaId: activeColmeia.id,
        type: newCompletedState ? "task_completed" : "task_uncompleted",
        metadata: { taskTitle: task.title },
      });
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
      Alert.alert("Erro", "Não foi possível atualizar a tarefa");
    }
  };

  const handleVote = async (voteId: string) => {
    if (!activeColmeia) return;

    try {
      await addVote(activeColmeia.id, voteId);
      Alert.alert("Sucesso", "Seu voto foi registrado!");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível registrar o voto");
    }
  };

  const handleRemoveVote = async (voteId: string) => {
    if (!activeColmeia) return;

    try {
      await removeVote(activeColmeia.id, voteId);
      Alert.alert("Sucesso", "Seu voto foi removido!");
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível remover o voto");
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert("Erro", "Por favor, digite um título para a tarefa");
      return;
    }

    if (!activeColmeia) {
      Alert.alert("Erro", "Selecione uma colmeia primeiro");
      return;
    }

    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert("Erro", "Você precisa estar logado");
      return;
    }

    try {
      // Se está editando, atualiza a tarefa existente
      if (selectedTask) {
        const taskRef = doc(
          db,
          "colmeias",
          activeColmeia.id,
          "tasks",
          selectedTask.id
        );
        await updateDoc(taskRef, {
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
        });

        Alert.alert("Sucesso", "Tarefa atualizada!");
      } else {
        // Cria nova tarefa
        const tasksRef = collection(db, "colmeias", activeColmeia.id, "tasks");
        await addDoc(tasksRef, {
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          completed: false,
          createdAt: serverTimestamp(),
          createdBy: userId,
        });

        // Registra atividade
        await addActivityLog({
          colmeiaId: activeColmeia.id,
          type: "task_created",
          metadata: { taskTitle: newTaskTitle.trim() },
        });
      }

      setNewTaskTitle("");
      setNewTaskDescription("");
      setSelectedTask(null);
      setModalVisible(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setSelectedTask(null);
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
      Alert.alert("Erro", "Não foi possível salvar a tarefa");
    }
  };

  const openAddModal = () => {
    setSelectedTask(null);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setModalVisible(true);
  };

  const handleLongPress = (taskId: string) => {
    // Entra no modo de exclusão e seleciona o card
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedTasks([taskId]);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    if (deleteMode) {
      // No modo de exclusão, adiciona ou remove da seleção
      setSelectedTasks((prev) =>
        prev.includes(taskId)
          ? prev.filter((id) => id !== taskId)
          : [...prev, taskId]
      );
    } else {
      // Comportamento normal: abre para editar
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        setNewTaskTitle(task.title);
        setNewTaskDescription(task.description || "");
        setModalVisible(true);
      }
    }
  };

  // Sai do modo de exclusão quando todos os cards são desselecionados
  useEffect(() => {
    if (deleteMode && selectedTasks.length === 0) {
      setDeleteMode(false);
    }
  }, [selectedTasks, deleteMode]);

  const applyBulkAction = async () => {
    if (selectedTasks.length === 0) {
      Alert.alert("Aviso", "Selecione pelo menos uma tarefa");
      return;
    }

    if (!activeColmeia) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      // Verifica se precisa de votação
      const needsVote = await needsVoting(activeColmeia.id);

      if (needsVote) {
        // Cria votações para cada tarefa selecionada
        for (const taskId of selectedTasks) {
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            await createVote(
              activeColmeia.id,
              "delete_task",
              taskId,
              task.title
            );
          }
        }
        Alert.alert(
          "Votação iniciada",
          `${selectedTasks.length} votação(ões) criada(s). Aguarde aprovação dos membros.`
        );
      } else {
        // Deleta diretamente
        for (const taskId of selectedTasks) {
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            await deleteTaskDirect(activeColmeia.id, taskId, task.title);
          }
        }
        Alert.alert("Sucesso", `${selectedTasks.length} tarefa(s) excluída(s)`);
      }
    } catch (error) {
      console.error("Erro ao aplicar ação:", error);
      Alert.alert("Erro", "Não foi possível aplicar a ação");
    } finally {
      setDeleteMode(false);
      setSelectedTasks([]);
    }
  };

  const cancelSelection = () => {
    setDeleteMode(false);
    setSelectedTasks([]);
  };

  const closeModal = () => {
    setModalVisible(false);
    setNewTaskTitle("");
    setNewTaskDescription("");
    setSelectedTask(null);
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setDetailModalVisible(true);
  };

  const renderTask = ({ item }: { item: Task }) => {
    const isSelected = deleteMode && selectedTasks.includes(item.id);

    const openEdit = (task: Task) => {
      if (deleteMode) return; // Não abre edição no modo exclusão
      setSelectedTask(task);
      setNewTaskTitle(task.title);
      setNewTaskDescription(task.description || "");
      setModalVisible(true);
    };

    return (
      <View
        style={[
          styles.taskContainer,
          { backgroundColor: theme.cardColor },
          isSelected && {
            borderColor: theme.danger,
            borderWidth: 3,
          },
        ]}
      >
        {/* checkbox area: selection or toggle completion */}
        <TouchableOpacity
          style={styles.selectionCheckbox}
          onPress={() =>
            deleteMode ? toggleTaskSelection(item.id) : toggleTask(item)
          }
          onLongPress={() => handleLongPress(item.id)}
        >
          <Ionicons
            name={
              isSelected
                ? "checkmark-circle"
                : item.completed
                ? "checkmark-circle"
                : "ellipse-outline"
            }
            size={deleteMode ? 28 : 24}
            color={
              isSelected
                ? theme.danger
                : item.completed
                ? theme.success
                : "#8E8E93"
            }
          />
        </TouchableOpacity>

        {/* main area: open edit when tapped or toggle selection */}
        <TouchableOpacity
          style={styles.taskContent}
          onPress={() =>
            deleteMode ? toggleTaskSelection(item.id) : openEdit(item)
          }
          onLongPress={() => handleLongPress(item.id)}
        >
          <Text
            style={[
              styles.taskTitle,
              { color: theme.textOnCard },
              item.completed && styles.taskTitleCompleted,
            ]}
          >
            {item.title}
          </Text>
          {item.description && (
            <Text
              style={[styles.taskDescription, { color: theme.textOnCard }]}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const completedCount = tasks.filter((task) => task.completed).length;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
          styles.centerContent,
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textOnBackground }]}>
          Carregando tarefas...
        </Text>
      </View>
    );
  }

  if (!activeColmeia) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
          styles.centerContent,
        ]}
      >
        <Ionicons name="cube-outline" size={64} color={theme.icon} />
        <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
          Nenhuma colmeia selecionada
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textOnBackground }]}>
          Vá para a aba Colmeias para criar ou selecionar uma
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {tasks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="list-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
            Nenhuma tarefa ainda
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.icon }]}>
            Toque no botão + para adicionar uma tarefa
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Barra de Exclusão */}
      {deleteMode && (
        <View style={[styles.selectionBar, { backgroundColor: theme.danger }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelSelection}
          >
            <Ionicons name="close" size={24} color="#fff" />
            <Text style={styles.selectionBarText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.selectionBarText}>
            {selectedTasks.length} selecionada(s)
          </Text>
          <TouchableOpacity
            style={[
              styles.applyButton,
              selectedTasks.length === 0 && styles.applyButtonDisabled,
            ]}
            onPress={applyBulkAction}
            disabled={selectedTasks.length === 0}
          >
            <Ionicons name="trash" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Botão de Ação */}
      {!deleteMode && (
        <ActionButton
          onActionSelect={openAddModal}
          isSelectionMode={deleteMode}
        />
      )}

      {/* Botão de Votações Flutuante à Esquerda */}
      {pendingVotes.length > 0 && !deleteMode && (
        <TouchableOpacity
          style={styles.votesFab}
          onPress={() => setVotesModalVisible(true)}
        >
          <Ionicons name="thumbs-up" size={24} color="#fff" />
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{pendingVotes.length}</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Modal de Adicionar Tarefa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Nova Tarefa
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, color: theme.text },
              ]}
              placeholder="Título da tarefa"
              placeholderTextColor={theme.textOnCard + "80"}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: theme.background, color: theme.text },
              ]}
              placeholder="Descrição (opcional)"
              placeholderTextColor={theme.textOnCard + "80"}
              value={newTaskDescription}
              onChangeText={setNewTaskDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={addTask}
            >
              <Text style={styles.saveButtonText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalhes da Tarefa */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Detalhes da Tarefa
              </Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            {selectedTask && (
              <View>
                <Text style={[styles.detailTitle, { color: theme.textOnCard }]}>
                  {selectedTask.title}
                </Text>
                {selectedTask.description && (
                  <View style={styles.detailSection}>
                    <Text
                      style={[
                        styles.detailLabel,
                        { color: theme.textOnCard, opacity: 0.7 },
                      ]}
                    >
                      Descrição:
                    </Text>
                    <Text
                      style={[styles.detailText, { color: theme.textOnCard }]}
                    >
                      {selectedTask.description}
                    </Text>
                  </View>
                )}
                <View style={styles.detailSection}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: theme.textOnCard, opacity: 0.7 },
                    ]}
                  >
                    Status:
                  </Text>
                  <Text
                    style={[
                      styles.detailText,
                      {
                        color: selectedTask.completed
                          ? theme.success
                          : theme.secondary,
                      },
                    ]}
                  >
                    {selectedTask.completed ? "Concluída" : "Pendente"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Votações */}
      <Modal
        visible={votesModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setVotesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Votações Pendentes
              </Text>
              <TouchableOpacity onPress={() => setVotesModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            {pendingVotes.length === 0 ? (
              <View style={styles.emptyActivities}>
                <Text style={[styles.emptyText, { color: theme.textOnCard }]}>
                  Nenhuma votação pendente
                </Text>
              </View>
            ) : (
              <FlatList
                data={pendingVotes}
                keyExtractor={(item) => item.id}
                style={styles.activitiesList}
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
                        <Text style={[styles.voteTitle, { color: theme.text }]}>
                          {item.targetName}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.voteDescription,
                          { color: theme.text, opacity: 0.7 },
                        ]}
                      >
                        Votação para excluir tarefa
                      </Text>

                      <View style={styles.voteProgress}>
                        <View
                          style={[
                            styles.progressBarContainer,
                            { backgroundColor: theme.text + "20" },
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
                        <Text style={[styles.voteCount, { color: theme.text }]}>
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
                          <TouchableOpacity
                            style={[
                              styles.voteButton,
                              { backgroundColor: theme.primary },
                            ]}
                            onPress={() => handleVote(item.id)}
                          >
                            <Ionicons name="thumbs-up" size={16} color="#fff" />
                            <Text style={styles.voteButtonText}>Votar</Text>
                          </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  listContent: {
    padding: 16,
    paddingBottom: 90, // Espaço para o FAB e barra de seleção
  },
  taskContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  checkbox: {
    marginRight: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  taskTitleCompleted: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  taskDescription: {
    fontSize: 14,
    marginTop: 4,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
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
    color: "#333",
  },
  input: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 100,
    marginBottom: 20,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 16,
    color: "#333",
  },
  activitiesList: {
    maxHeight: 400,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  emptyActivities: {
    paddingVertical: 40,
    alignItems: "center",
  },
  voteCard: {
    backgroundColor: "#FFF9E6",
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
    color: "#333",
    flex: 1,
  },
  voteDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
  },
  // progress container for vote card (holds bar and count)
  voteProgress: {
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#FFF2E6",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FF9500",
    borderRadius: 4,
  },
  voteCount: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  voteActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  votedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  votedText: {
    fontSize: 14,

    fontWeight: "500",
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF9500",
    paddingHorizontal: 16,
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
  },
  removeVoteText: {
    color: "#FF3B30",
    fontSize: 14,
  },
  votesFab: {
    position: "absolute",
    left: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF9500",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 4px 8px rgba(0,0,0,0.3)",
    elevation: 8,
  },
  fabBadge: {
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
  fabBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  taskContainerSelected: {
    borderColor: "#E3F2FD",
    borderWidth: 3,
  },
  selectionCheckbox: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderRadius: 12,
  },
  selectionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    boxShadow: "0px -2px 4px rgba(0,0,0,0.2)",
    elevation: 8,
  },
  selectionBarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  applyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
});
