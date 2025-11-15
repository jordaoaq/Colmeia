// =====================
// DASHBOARD PRINCIPAL
// =====================
// Tela inicial: mostra cards de estatísticas, mural de avisos e feed de atividades
// Palavras-chave para busca: DASHBOARD, AVISOS, ATIVIDADES, ESTATÍSTICAS
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import { useColmeia, useTheme } from "@/contexts/ColmeiaContext";
import {
  collection,
  getDocs,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  limit,
  where,
} from "firebase/firestore";

// Estrutura de uma nota do mural
interface Note {
  id: string;
  content: string;
  color: string;
  authorName: string;
  authorId: string;
  createdAt: any;
}

// Estrutura de uma atividade recente (feed)
interface Activity {
  id: string;
  type: string;
  metadata: any;
  userName: string;
  timestamp: any;
}

// =====================
// COMPONENTE PRINCIPAL DA TELA HOME
// =====================
// Aqui ficam os cards do dashboard, mural de avisos e feed de atividades
export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const { activeColmeia } = useColmeia();
  const theme = useAppTheme();

  // =====================
  // ESTATÍSTICAS DO DASHBOARD
  // =====================
  // Quantidade de compras pendentes, rotinas atrasadas, tarefas abertas e gasto semanal
  const [pendingShoppingItems, setPendingShoppingItems] = useState(0);
  const [overdueDomesticTasks, setOverdueDomesticTasks] = useState(0);
  const [openTasks, setOpenTasks] = useState(0);
  const [weeklyExpenses, setWeeklyExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  // =====================
  // MURAL DE AVISOS
  // =====================
  // Notas rápidas para o grupo
  const [notes, setNotes] = useState<Note[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [selectedColor, setSelectedColor] = useState("#FFE066");

  // =====================
  // FEED DE ATIVIDADES RECENTES
  // =====================
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  // Paleta de cores para notas do mural
  const noteColors = [
    "#FFE066", // Amarelo
    "#FFB3BA", // Rosa
    "#BAE1FF", // Azul
    "#BAFFC9", // Verde
    "#FFD9BA", // Laranja
    "#E0BBE4", // Roxo
  ];

  // Carrega estatísticas, notas e atividades ao trocar de colmeia
  useEffect(() => {
    if (activeColmeia) {
      loadColmeiaStats();
      subscribeToNotes();
      subscribeToActivities();
    } else {
      setLoading(false);
    }
  }, [activeColmeia]);

  // =====================
  // FUNÇÃO: Carrega estatísticas do dashboard
  // =====================
  const loadColmeiaStats = async () => {
    if (!activeColmeia) {
      setLoading(false);
      return;
    }

    try {
      // 1. Itens de compras pendentes (não comprados)
      const shoppingSnapshot = await getDocs(
        collection(db, "colmeias", activeColmeia.id, "compras")
      );
      let pendingItems = 0;
      shoppingSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.comprado) pendingItems++;
      });
      setPendingShoppingItems(pendingItems);

      // 2. Rotinas atrasadas
      const now = new Date();
      const domesticTasks = await getDocs(
        collection(db, "colmeias", activeColmeia.id, "rotinas")
      );
      let overdueTasks = 0;
      domesticTasks.forEach((doc) => {
        const data = doc.data();
        if (data.proximaRealizacao) {
          const nextDue = data.proximaRealizacao.toDate();
          if (nextDue < now) overdueTasks++;
        }
      });
      setOverdueDomesticTasks(overdueTasks);

      // 3. Tarefas em aberto (da lista de votação)
      const tasksSnapshot = await getDocs(
        collection(db, "colmeias", activeColmeia.id, "tasks")
      );
      let openTasksCount = 0;
      tasksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.concluida) openTasksCount++;
      });
      setOpenTasks(openTasksCount);

      // 4. Gasto semanal (últimos 7 dias)
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const expenses = await getDocs(
        collection(db, "colmeias", activeColmeia.id, "financas")
      );
      let weekTotal = 0;
      expenses.forEach((doc) => {
        const data = doc.data();
        if (data.data) {
          const expenseDate = data.data.toDate();
          if (expenseDate >= sevenDaysAgo) {
            weekTotal += data.valor || 0;
          }
        }
      });
      setWeeklyExpenses(weekTotal);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // FUNÇÃO: Assina o mural de avisos em tempo real
  // =====================
  const subscribeToNotes = () => {
    if (!activeColmeia) return;

    const notesRef = collection(db, "colmeias", activeColmeia.id, "notes");
    const q = query(notesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Note[];
      setNotes(notesData);
    });

    return unsubscribe;
  };

  // =====================
  // FUNÇÃO: Assina o feed de atividades recentes
  // =====================
  const subscribeToActivities = () => {
    if (!activeColmeia) return;

    const activitiesRef = collection(
      db,
      "colmeias",
      activeColmeia.id,
      "activities"
    );
    const q = query(activitiesRef, orderBy("timestamp", "desc"), limit(10));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activitiesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Activity[];
        console.log("Atividades carregadas:", activitiesData.length);
        setRecentActivities(activitiesData);
      },
      (error) => {
        console.error("Erro ao carregar atividades:", error);
        // Se houver erro de índice, tenta buscar sem ordenação
        const simpleQuery = query(activitiesRef, limit(10));
        onSnapshot(simpleQuery, (snapshot) => {
          const activitiesData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Activity[];
          console.log(
            "Atividades carregadas (sem ordem):",
            activitiesData.length
          );
          setRecentActivities(activitiesData);
        });
      }
    );

    return unsubscribe;
  };

  // =====================
  // FUNÇÃO: Adiciona uma nota ao mural
  // =====================
  const addNote = async () => {
    if (!activeColmeia || !noteContent.trim()) return;

    try {
      await addDoc(collection(db, "colmeias", activeColmeia.id, "notes"), {
        content: noteContent.trim(),
        color: selectedColor,
        authorName: user?.email?.split("@")[0] || "Usuário",
        authorId: user?.uid,
        createdAt: serverTimestamp(),
      });

      setNoteContent("");
      setModalVisible(false);
      Alert.alert("Sucesso", "Nota adicionada ao mural!");
    } catch (error) {
      console.error("Erro ao adicionar nota:", error);
      Alert.alert("Erro", "Não foi possível adicionar a nota");
    }
  };

  // =====================
  // FUNÇÃO: Deleta uma nota do mural (apenas do autor)
  // =====================
  const deleteNote = async (noteId: string, authorId: string) => {
    if (authorId !== user?.uid) {
      Alert.alert("Aviso", "Você só pode deletar suas próprias notas");
      return;
    }

    Alert.alert("Confirmar", "Deseja remover esta nota?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(
              doc(db, "colmeias", activeColmeia!.id, "notes", noteId)
            );
          } catch (error) {
            Alert.alert("Erro", "Não foi possível remover a nota");
          }
        },
      },
    ]);
  };

  // =====================
  // FUNÇÃO: Retorna o ícone para cada tipo de atividade
  // =====================
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "task_completed":
        return "checkmark-circle";
      case "task_created":
        return "add-circle";
      case "member_joined":
        return "person-add";
      case "expense_added":
        return "cash";
      default:
        return "notifications";
    }
  };

  // =====================
  // FUNÇÃO: Retorna a cor para cada tipo de atividade
  // =====================
  const getActivityColor = (type: string) => {
    switch (type) {
      case "task_completed":
        return theme.success;
      case "task_created":
        return theme.primary;
      case "member_joined":
        return theme.secondary;
      case "expense_added":
        return "#FF9500";
      default:
        return "#666";
    }
  };

  // =====================
  // FUNÇÃO: Retorna o texto descritivo da atividade
  // =====================
  const getActivityText = (activity: Activity) => {
    switch (activity.type) {
      case "task_completed":
        return `completou "${activity.metadata?.taskTitle}"`;
      case "task_created":
        return `criou a tarefa "${activity.metadata?.taskTitle}"`;
      case "member_joined":
        return `entrou na colmeia`;
      case "expense_added":
        return `adicionou despesa "${activity.metadata?.description}"`;
      default:
        return "realizou uma ação";
    }
  };

  // =====================
  // FUNÇÃO: Formata o tempo relativo (ex: 2h atrás)
  // =====================
  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return "ontem";
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  // =====================
  // FUNÇÃO: Logout do usuário
  // =====================
  const handleLogout = async () => {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      {
        text: "Cancelar",
        style: "cancel",
      },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            // Navega explicitamente para a tela de login para garantir que o usuário volte à autenticação
            router.replace("/(auth)/login");
          } catch (error) {
            Alert.alert("Erro", "Não foi possível fazer logout");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView>
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.cardColor,
              borderBottomColor: theme.textOnCard + "20",
            },
          ]}
        >
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Image
                source={require("../../assets/images/colmeia-bee.png")}
                style={styles.avatarImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text
                style={[styles.welcomeText, { color: theme.textOnBackground }]}
              >
                Olá!
              </Text>
              <Text
                style={[
                  styles.emailText,
                  { color: theme.textOnBackground, opacity: 0.7 },
                ]}
              >
                {user?.email?.split("@")[0]}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={theme.danger} />
          </TouchableOpacity>
        </View>

        {!activeColmeia ? (
          <View style={styles.noColmeiaContainer}>
            <Ionicons name="cube-outline" size={64} color={theme.icon} />
            <Text
              style={[styles.noColmeiaText, { color: theme.textOnBackground }]}
            >
              Nenhuma colmeia ativa
            </Text>
            <Text
              style={[
                styles.noColmeiaSubtext,
                { color: theme.textOnBackground, opacity: 0.7 },
              ]}
            >
              Vá para a aba Colmeias para criar ou entrar em uma
            </Text>
            <TouchableOpacity
              style={[
                styles.goToColmeiasButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={() => router.push("/(app)/colmeias")}
            >
              <Text style={styles.goToColmeiasButtonText}>
                Ir para Colmeias
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            {/* Dashboard Cards */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color={theme.primary}
                style={styles.loader}
              />
            ) : (
              <View style={styles.dashboardGrid}>
                <TouchableOpacity
                  style={[
                    styles.dashCard,
                    { backgroundColor: theme.cardColor },
                  ]}
                  onPress={() => router.push("/(app)/listas")}
                >
                  <Ionicons name="list-circle" size={28} color="#42A5F5" />
                  <Text
                    style={[styles.dashNumber, { color: theme.textOnCard }]}
                  >
                    {openTasks}
                  </Text>
                  <Text
                    style={[
                      styles.dashLabel,
                      { color: theme.textOnCard, opacity: 0.7 },
                    ]}
                  >
                    Tarefas em Aberto
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dashCard,
                    { backgroundColor: theme.cardColor },
                  ]}
                  onPress={() => router.push("/(app)/rotinas")}
                >
                  <Ionicons name="alert-circle" size={28} color="#EF5350" />
                  <Text
                    style={[styles.dashNumber, { color: theme.textOnCard }]}
                  >
                    {overdueDomesticTasks}
                  </Text>
                  <Text
                    style={[
                      styles.dashLabel,
                      { color: theme.textOnCard, opacity: 0.7 },
                    ]}
                  >
                    Rotinas Atrasadas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dashCard,
                    { backgroundColor: theme.cardColor },
                  ]}
                  onPress={() => router.push("/(app)/compras")}
                >
                  <Ionicons name="cart" size={28} color="#78909C" />
                  <Text
                    style={[styles.dashNumber, { color: theme.textOnCard }]}
                  >
                    {pendingShoppingItems}
                  </Text>
                  <Text
                    style={[
                      styles.dashLabel,
                      { color: theme.textOnCard, opacity: 0.7 },
                    ]}
                  >
                    Compras Pendentes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.dashCard,
                    { backgroundColor: theme.cardColor },
                  ]}
                  onPress={() => router.push("/(app)/financas")}
                >
                  <Ionicons name="wallet" size={28} color="#66BB6A" />
                  <Text
                    style={[styles.dashNumber, { color: theme.textOnCard }]}
                  >
                    R$ {weeklyExpenses.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.dashLabel,
                      { color: theme.textOnCard, opacity: 0.7 },
                    ]}
                  >
                    Gasto Semanal
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Mural de Notas */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="clipboard" size={24} color={theme.primary} />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.textOnBackground },
                    ]}
                  >
                    Mural de Avisos
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.addNoteButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setModalVisible(true)}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.muralContainer,
                  { backgroundColor: theme.cardColor },
                ]}
              >
                {notes.length === 0 ? (
                  <View style={styles.emptyNotes}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={48}
                      color={theme.icon}
                    />
                    <Text
                      style={[styles.emptyText, { color: theme.textOnCard }]}
                    >
                      Nenhuma nota no mural
                    </Text>
                    <Text
                      style={[
                        styles.emptySubtext,
                        { color: theme.textOnCard, opacity: 0.6 },
                      ]}
                    >
                      Seja o primeiro a deixar um aviso!
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.notesScroll}
                  >
                    {notes.map((note) => (
                      <View
                        key={note.id}
                        style={[
                          styles.noteCard,
                          { backgroundColor: note.color },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.deleteNoteButton}
                          onPress={() => deleteNote(note.id, note.authorId)}
                        >
                          <Ionicons name="close" size={18} color="#333" />
                        </TouchableOpacity>
                        <Text style={styles.noteContent}>{note.content}</Text>
                        <View style={styles.noteFooter}>
                          <Text style={styles.noteAuthor}>
                            - {note.authorName}
                          </Text>
                          <Text style={styles.noteTime}>
                            {formatRelativeTime(note.createdAt)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>

            {/* Atividades Recentes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="time" size={24} color={theme.primary} />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.textOnBackground },
                    ]}
                  >
                    Atividades Recentes
                  </Text>
                </View>
              </View>

              {recentActivities.length === 0 ? (
                <View
                  style={[
                    styles.emptyActivities,
                    { backgroundColor: theme.cardColor },
                  ]}
                >
                  <Ionicons
                    name="newspaper-outline"
                    size={40}
                    color={theme.icon}
                  />
                  <Text style={[styles.emptyText, { color: theme.textOnCard }]}>
                    Nenhuma atividade ainda
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.activitiesList,
                    { backgroundColor: theme.cardColor },
                  ]}
                >
                  {recentActivities.slice(0, 6).map((activity) => (
                    <View key={activity.id} style={styles.activityItem}>
                      <View
                        style={[
                          styles.activityIcon,
                          {
                            backgroundColor:
                              getActivityColor(activity.type) + "20",
                          },
                        ]}
                      >
                        <Ionicons
                          name={getActivityIcon(activity.type) as any}
                          size={20}
                          color={getActivityColor(activity.type)}
                        />
                      </View>
                      <View style={styles.activityContent}>
                        <Text
                          style={[
                            styles.activityText,
                            { color: theme.textOnCard },
                          ]}
                        >
                          <Text style={styles.activityUser}>
                            {activity.userName}
                          </Text>{" "}
                          {getActivityText(activity)}
                        </Text>
                        <Text
                          style={[
                            styles.activityTime,
                            { color: theme.textOnCard, opacity: 0.5 },
                          ]}
                        >
                          {formatRelativeTime(activity.timestamp)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal para adicionar nota */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[
                styles.modalContent,
                { backgroundColor: theme.cardColor },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                  Nova Nota
                </Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.icon} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: theme.background,
                    color: theme.textOnBackground,
                  },
                ]}
                placeholder="Escreva sua nota aqui..."
                placeholderTextColor={theme.textOnBackground + "60"}
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                numberOfLines={4}
                maxLength={200}
              />

              <Text style={[styles.colorLabel, { color: theme.textOnCard }]}>
                Escolha uma cor:
              </Text>
              <View style={styles.colorPicker}>
                {noteColors.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={20} color="#333" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.addButton,
                  { backgroundColor: theme.primary },
                  !noteContent.trim() && styles.addButtonDisabled,
                ]}
                onPress={addNote}
                disabled={!noteContent.trim()}
              >
                <Text style={styles.addButtonText}>Adicionar ao Mural</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "700",
  },
  emailText: {
    fontSize: 14,
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  noColmeiaContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  noColmeiaText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  noColmeiaSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  goToColmeiasButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  goToColmeiasButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loader: {
    marginVertical: 20,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  dashCard: {
    flex: 1,
    minWidth: "47%",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.08)",
    elevation: 2,
  },
  dashNumber: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 8,
  },
  dashLabel: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  addNoteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  muralContainer: {
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  emptyNotes: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  notesScroll: {
    gap: 12,
    paddingVertical: 4,
  },
  noteCard: {
    width: 180,
    minHeight: 160,
    padding: 16,
    borderRadius: 12,
    boxShadow: "0px 2px 4px rgba(0,0,0,0.15)",
    elevation: 3,
    position: "relative",
    borderWidth: 2,
    borderColor: "transparent",
  },
  deleteNoteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  noteContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    flex: 1,
    marginTop: 8,
  },
  noteFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 8,
  },
  noteAuthor: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  noteTime: {
    fontSize: 11,
    color: "#777",
    marginTop: 2,
  },
  emptyActivities: {
    padding: 32,
    borderRadius: 12,
    alignItems: "center",
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  activitiesList: {
    borderRadius: 12,
    padding: 12,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
  },
  activityUser: {
    fontWeight: "600",
  },
  activityTime: {
    fontSize: 12,
    marginTop: 4,
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
    paddingBottom: 40,
    minHeight: "50%",
    maxHeight: "85%",
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
  noteInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  colorLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  colorPicker: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: "#333",
  },
  addButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
