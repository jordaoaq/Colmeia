// =====================
// COLMEIAS (GESTÃO DE GRUPOS)
// =====================
// Tela para criar, entrar e trocar de colmeia (grupo)
// Palavras-chave para busca: COLMEIAS, GRUPO, CÓDIGO DE CONVITE
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../firebaseConfig";
import { useColmeia } from "@/contexts/ColmeiaContext";
import { addActivityLog } from "@/utils/activityLogger";
import AsyncStorage from "@react-native-async-storage/async-storage";

// =====================
// COMPONENTE PRINCIPAL DA TELA COLMEIAS
// =====================
// Gerencia grupos do usuário
export default function ColmeiasScreen() {
  const theme = useAppTheme();
  const {
    activeColmeia,
    setActiveColmeia,
    userColmeias,
    refreshColmeias,
    loading,
  } = useColmeia();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [colmeiaName, setColmeiaName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  // Gera código de convite aleatório
  const generateInviteCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Cria nova colmeia
  const createColmeia = async () => {
    if (!colmeiaName.trim()) {
      Alert.alert("Erro", "Por favor, digite um nome para a colmeia");
      return;
    }

    const userId = auth.currentUser?.uid;
    const userEmail = auth.currentUser?.email;

    if (!userId || !userEmail) {
      Alert.alert("Erro", "Você precisa estar logado");
      return;
    }

    setCreating(true);
    try {
      const code = generateInviteCode();

      // Cria a colmeia
      const colmeiaRef = await addDoc(collection(db, "colmeias"), {
        name: colmeiaName.trim(),
        inviteCode: code,
        createdBy: userId,
        createdAt: serverTimestamp(),
      });

      // Adiciona o criador como membro
      await addDoc(collection(db, "colmeias", colmeiaRef.id, "members"), {
        userId,
        email: userEmail,
        joinedAt: serverTimestamp(),
        role: "admin",
      });

      // Registra atividade
      await addActivityLog({
        colmeiaId: colmeiaRef.id,
        type: "member_joined",
      });

      Alert.alert("Sucesso!", `Colmeia criada! Código de convite: ${code}`, [
        {
          text: "OK",
          onPress: async () => {
            await refreshColmeias();
            setColmeiaName("");
            setCreateModalVisible(false);
          },
        },
      ]);
    } catch (error) {
      console.error("Erro ao criar colmeia:", error);
      Alert.alert("Erro", "Não foi possível criar a colmeia");
    } finally {
      setCreating(false);
    }
  };

  // Entra em uma colmeia usando código de convite
  const joinColmeia = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Erro", "Por favor, digite o código de convite");
      return;
    }

    const userId = auth.currentUser?.uid;
    const userEmail = auth.currentUser?.email;

    if (!userId || !userEmail) {
      Alert.alert("Erro", "Você precisa estar logado");
      return;
    }

    setJoining(true);
    try {
      // Busca a colmeia pelo código de convite
      const colmeiasRef = collection(db, "colmeias");
      const q = query(
        colmeiasRef,
        where("inviteCode", "==", inviteCode.trim().toUpperCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        Alert.alert("Erro", "Código de convite inválido");
        setJoining(false);
        return;
      }

      const colmeiaDoc = querySnapshot.docs[0];
      const colmeiaId = colmeiaDoc.id;

      // Verifica se o usuário já é membro
      const membersRef = collection(db, "colmeias", colmeiaId, "members");
      const memberQuery = query(membersRef, where("userId", "==", userId));
      const memberSnapshot = await getDocs(memberQuery);

      if (!memberSnapshot.empty) {
        Alert.alert("Aviso", "Você já é membro desta colmeia");
        setJoining(false);
        return;
      }

      // Adiciona o usuário como membro
      await addDoc(membersRef, {
        userId,
        email: userEmail,
        joinedAt: serverTimestamp(),
        role: "member",
      });

      // Registra atividade
      await addActivityLog({
        colmeiaId,
        type: "member_joined",
      });

      Alert.alert("Sucesso!", "Você entrou na colmeia!", [
        {
          text: "OK",
          onPress: async () => {
            await refreshColmeias();
            setInviteCode("");
            setJoinModalVisible(false);
          },
        },
      ]);
    } catch (error) {
      console.error("Erro ao entrar na colmeia:", error);
      Alert.alert("Erro", "Não foi possível entrar na colmeia");
    } finally {
      setJoining(false);
    }
  };

  // Atualiza lista de colmeias ao focar tela
  useEffect(() => {
    // Atualiza as colmeias quando a tela é focada
    refreshColmeias();
  }, []);

  // Seleciona colmeia ativa
  const selectColmeia = async (colmeia: any) => {
    setActiveColmeia(colmeia);
    Alert.alert(
      "Colmeia Selecionada",
      `Você está agora na colmeia "${colmeia.name}"`
    );
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
          styles.centerContent,
        ]}
      >
        <ActivityIndicator size="large" color={theme.cardColor} />
        <Text style={[styles.loadingText, { color: theme.textOnBackground }]}>
          Carregando colmeias...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.textOnBackground }]}>
            Minhas Colmeias
          </Text>
          {activeColmeia && (
            <Text style={[styles.subtitle, { color: theme.icon }]}>
              Ativa: {activeColmeia.name}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.cardColor }]}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color={theme.textOnCard} />
          <Text style={[styles.actionButtonText, { color: theme.textOnCard }]}>
            Criar Colmeia
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.success }]}
          onPress={() => setJoinModalVisible(true)}
        >
          <Ionicons name="enter" size={24} color={theme.textOnCard} />
          <Text style={[styles.actionButtonText, { color: theme.textOnCard }]}>
            Entrar com Código
          </Text>
        </TouchableOpacity>
      </View>

      {userColmeias.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
            Nenhuma colmeia ainda
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.icon }]}>
            Crie uma nova colmeia ou entre em uma existente
          </Text>
        </View>
      ) : (
        <FlatList
          data={userColmeias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.colmeiaCard,
                { backgroundColor: theme.cardColor },
                activeColmeia?.id === item.id && { borderColor: theme.primary },
              ]}
              onPress={() => selectColmeia(item)}
            >
              <View
                style={[
                  styles.colmeiaIcon,
                  { backgroundColor: theme.background },
                ]}
              >
                <Ionicons
                  name="cube"
                  size={32}
                  color={
                    activeColmeia?.id === item.id ? theme.primary : theme.icon
                  }
                />
              </View>
              <View style={styles.colmeiaInfo}>
                <Text style={[styles.colmeiaName, { color: theme.textOnCard }]}>
                  {item.name}
                </Text>
                <Text
                  style={[
                    styles.colmeiaCode,
                    { color: theme.textOnCard, opacity: 0.7 },
                  ]}
                >
                  Código: {item.inviteCode}
                </Text>
              </View>
              {activeColmeia?.id === item.id && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={theme.primary}
                />
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Modal de Criar Colmeia */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Nova Colmeia
              </Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, color: theme.text },
              ]}
              placeholder="Nome da colmeia"
              placeholderTextColor={theme.textOnCard + "80"}
              value={colmeiaName}
              onChangeText={setColmeiaName}
              autoFocus
              editable={!creating}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary },
                creating && styles.buttonDisabled,
              ]}
              onPress={createColmeia}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Criar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de Entrar na Colmeia */}
      <Modal
        visible={joinModalVisible}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setJoinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Entrar na Colmeia
              </Text>
              <TouchableOpacity onPress={() => setJoinModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, color: theme.text },
              ]}
              placeholder="Código de convite (6 caracteres)"
              placeholderTextColor={theme.textOnCard + "80"}
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              autoFocus
              editable={!joining}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: theme.primary },
                joining && styles.buttonDisabled,
              ]}
              onPress={joinColmeia}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Entrar</Text>
              )}
            </TouchableOpacity>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    padding: 16,
  },
  colmeiaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colmeiaCardActive: {
    // borderColor will be applied inline with theme.primary
  },
  colmeiaIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  colmeiaInfo: {
    flex: 1,
  },
  colmeiaName: {
    fontSize: 16,
    fontWeight: "600",
  },
  colmeiaCode: {
    fontSize: 14,
    marginTop: 4,
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
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
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
    minHeight: 250,
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
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
