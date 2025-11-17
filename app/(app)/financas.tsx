/**
 * Finanças screen
 * Track shared expenses for the colmeia: add/edit/delete and view statistics.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColmeia } from "@/contexts/ColmeiaContext";
import { useAppTheme } from "@/hooks/useAppTheme";
import ActionButton from "@/components/ActionButton";
import VotingButton from "@/components/VotingButton";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  getDocs,
  where,
} from "firebase/firestore";
import { db, auth } from "@/firebaseConfig";
import { addActivityLog } from "@/utils/activityLogger";
import {
  needsVoting,
  createVote,
  deleteDespesaDirect,
} from "@/utils/votingSystem";

type CategoriaFinanceira =
  | "alimentacao"
  | "moradia"
  | "transporte"
  | "lazer"
  | "saude"
  | "outros";

interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: CategoriaFinanceira;
  pagoPor: string;
  pagoPorNome: string;
  data: any;
  createdAt?: any;
}

const CATEGORIAS: {
  value: CategoriaFinanceira;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    value: "alimentacao",
    label: "Alimentação",
    icon: "restaurant",
    color: "#FF9500",
  },
  {
    value: "moradia",
    label: "Moradia",
    icon: "home",
    color: "#FFB300",
  },
  {
    value: "transporte",
    label: "Transporte",
    icon: "car",
    color: "#34C759",
  },
  { value: "lazer", label: "Lazer", icon: "game-controller", color: "#AF52DE" },
  { value: "saude", label: "Saúde", icon: "medical", color: "#FF3B30" },
  {
    value: "outros",
    label: "Outros",
    icon: "ellipsis-horizontal",
    color: "#8E8E93",
  },
];

export default function FinancasScreen() {
  const { activeColmeia } = useColmeia();
  const theme = useAppTheme();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);

  // Estado de expansão para estatísticas
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] =
    useState<CategoriaFinanceira | null>(null);

  // Estado de seleção
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedDespesas, setSelectedDespesas] = useState<string[]>([]);
  const [selectedDespesa, setSelectedDespesa] = useState<Despesa | null>(null);

  // Formulário
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] =
    useState<CategoriaFinanceira>("alimentacao");
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);

  // Filtro de mês
  const [selectedMonth, setSelectedMonth] = useState<string>(""); // formato: "2025-11"

  // Define pendingVotes state
  const [pendingVotes, setPendingVotes] = useState<any[]>([]);

  useEffect(() => {
    if (!activeColmeia) {
      setLoading(false);
      return;
    }

    const financasRef = collection(
      db,
      "colmeias",
      activeColmeia.id,
      "financas"
    );
    const q = query(financasRef, orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const financasData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Despesa[];
      setDespesas(financasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeColmeia]);

  // Auto exit deleteMode when no items are selected
  useEffect(() => {
    if (deleteMode && selectedDespesas.length === 0) {
      setDeleteMode(false);
    }
  }, [selectedDespesas]);

  // Sincronização em tempo real das votações pendentes
  useEffect(() => {
    if (!activeColmeia) {
      setPendingVotes([]);
      return;
    }

    const votesRef = collection(db, "colmeias", activeColmeia.id, "votes");
    const q = query(votesRef, where("status", "==", "pending"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedVotes: any[] = [];
      snapshot.forEach((doc) => {
        fetchedVotes.push({
          id: doc.id,
          ...doc.data(),
        });
      });
      setPendingVotes(fetchedVotes);
    });

    return () => unsubscribe();
  }, [activeColmeia]);

  // Inicializar com o mês atual
  useEffect(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    setSelectedMonth(currentMonth);
  }, []);

  // Filtrar despesas por mês
  const despesasFiltradas = selectedMonth
    ? despesas.filter((d) => {
        if (!d.data) return false;
        const despesaDate = d.data.toDate();
        const despesaMonth = `${despesaDate.getFullYear()}-${String(
          despesaDate.getMonth() + 1
        ).padStart(2, "0")}`;
        return despesaMonth === selectedMonth;
      })
    : despesas;

  // Gerar lista de meses disponíveis
  const getAvailableMonths = () => {
    const months = new Set<string>();
    despesas.forEach((d) => {
      if (d.data) {
        const date = d.data.toDate();
        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;
        months.add(monthKey);
      }
    });
    return Array.from(months).sort().reverse();
  };

  const availableMonths = getAvailableMonths();

  const formatMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const monthNames = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];
    return `${monthNames[parseInt(month) - 1]}/${year}`;
  };

  // Função: Adiciona ou atualiza uma despesa
  const addDespesa = async () => {
    if (!descricao.trim() || !valor || !activeColmeia) {
      Alert.alert("Erro", "Preencha todos os campos");
      return;
    }

    const valorNumerico = parseFloat(valor.replace(",", "."));
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      Alert.alert("Erro", "Valor inválido");
      return;
    }

    try {
      // Se está editando, atualiza a despesa existente
      if (selectedDespesa) {
        const despesaRef = doc(
          db,
          "colmeias",
          activeColmeia.id,
          "financas",
          selectedDespesa.id
        );
        await updateDoc(despesaRef, {
          descricao: descricao.trim(),
          valor: valorNumerico,
          categoria,
        });

        Alert.alert("Sucesso", "Despesa atualizada!");
      } else {
        // Cria nova despesa
        const financasRef = collection(
          db,
          "colmeias",
          activeColmeia.id,
          "financas"
        );
        await addDoc(financasRef, {
          descricao: descricao.trim(),
          valor: valorNumerico,
          categoria,
          pagoPor: auth.currentUser?.uid,
          pagoPorNome: auth.currentUser?.email?.split("@")[0] || "Usuário",
          data: serverTimestamp(),
          createdAt: serverTimestamp(),
        });

        await addActivityLog({
          colmeiaId: activeColmeia.id,
          type: "expense_added",
          metadata: {
            description: descricao.trim(),
            valor: valorNumerico,
          },
        });
      }

      setDescricao("");
      setValor("");
      setCategoria("alimentacao");
      setSelectedDespesa(null);
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar a despesa");
    }
  };

  const openAddModal = () => {
    setSelectedDespesa(null);
    setDescricao("");
    setValor("");
    setCategoria("alimentacao");
    setModalVisible(true);
  };

  const toggleDespesaSelection = (despesaId: string) => {
    setSelectedDespesas((prev) =>
      prev.includes(despesaId)
        ? prev.filter((id) => id !== despesaId)
        : [...prev, despesaId]
    );
  };

  // Função: Executa exclusão em lote das despesas selecionadas
  const applyBulkAction = async () => {
    if (selectedDespesas.length === 0) {
      Alert.alert("Aviso", "Selecione pelo menos uma despesa");
      return;
    }

    if (!activeColmeia) return;

    try {
      const precisaVotacao = await needsVoting(activeColmeia.id);

      if (precisaVotacao) {
        // Cria votações para cada despesa
        for (const despesaId of selectedDespesas) {
          const despesa = despesas.find((d) => d.id === despesaId);
          if (despesa) {
            await createVote(
              activeColmeia.id,
              "delete_expense",
              despesaId,
              despesa.descricao
            );
          }
        }
        Alert.alert(
          "Votação Iniciada",
          `${selectedDespesas.length} votação(ões) criada(s). Aguarde aprovação dos membros.`
        );
      } else {
        // Deleta diretamente se não precisar de votação
        for (const despesaId of selectedDespesas) {
          const despesa = despesas.find((d) => d.id === despesaId);
          if (despesa) {
            await deleteDespesaDirect(
              activeColmeia.id,
              despesaId,
              despesa.descricao
            );
          }
        }
        Alert.alert(
          "Sucesso",
          `${selectedDespesas.length} despesa(s) excluída(s)`
        );
      }
      setDeleteMode(false);
      setSelectedDespesas([]);
    } catch (error: any) {
      console.error("Erro ao excluir despesas:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível excluir as despesas"
      );
    }
  };

  const cancelSelection = () => {
    setDeleteMode(false);
    setSelectedDespesas([]);
  };

  const closeModal = () => {
    setModalVisible(false);
    setDescricao("");
    setValor("");
    setCategoria("alimentacao");
    setSelectedDespesa(null);
  };

  // Função: Deleta uma despesa individual ou cria votação
  const deleteDespesa = async (despesa: Despesa) => {
    if (!activeColmeia) return;

    try {
      const precisaVotacao = await needsVoting(activeColmeia.id);

      if (precisaVotacao) {
        await createVote(
          activeColmeia.id,
          "delete_expense",
          despesa.id,
          despesa.descricao
        );
        Alert.alert(
          "Votação Iniciada",
          "Uma votação foi criada para deletar esta despesa. Aguarde aprovação dos membros."
        );
      } else {
        await deleteDespesaDirect(
          activeColmeia.id,
          despesa.id,
          despesa.descricao
        );
        Alert.alert("Sucesso", "Despesa removida!");
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível remover a despesa");
    }
  };

  const getCategoriaInfo = (cat: CategoriaFinanceira) => {
    return CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[0];
  };

  // Função: Calcula estatísticas das despesas (total, por usuário, por categoria)
  const calcularEstatisticas = () => {
    const total = despesas.reduce((sum, d) => sum + d.valor, 0);
    const porUsuario: { [key: string]: number } = {};
    const porCategoria: { [key: string]: number } = {};

    despesas.forEach((d) => {
      porUsuario[d.pagoPorNome] = (porUsuario[d.pagoPorNome] || 0) + d.valor;
      porCategoria[d.categoria] = (porCategoria[d.categoria] || 0) + d.valor;
    });

    return { total, porUsuario, porCategoria };
  };

  const stats = calcularEstatisticas();

  const formatarData = (data: any) => {
    if (!data) return "";
    const d = data.toDate();
    return d.toLocaleDateString("pt-BR");
  };

  if (!activeColmeia) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background },
          styles.centerContent,
        ]}
      >
        <Ionicons name="wallet-outline" size={64} color={theme.icon} />
        <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
          Nenhuma colmeia ativa
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textOnBackground }]}>
          Selecione uma colmeia para gerenciar finanças
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Filtro de Mês */}
      {!loading && despesas.length > 0 && (
        <View
          style={[styles.filterContainer, { backgroundColor: theme.cardColor }]}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={theme.textOnCard}
            style={{ opacity: 0.7 }}
          />
          <Text style={[styles.filterLabelText, { color: theme.textOnCard }]}>
            Período:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthFilterScroll}
            style={styles.monthScrollView}
          >
            {availableMonths.map((month) => (
              <TouchableOpacity
                key={month}
                activeOpacity={0.7}
                style={[
                  styles.monthChip,
                  {
                    backgroundColor: theme.background,
                    borderWidth: 1,
                    borderColor: theme.textOnCard + "20",
                  },
                  selectedMonth === month && {
                    backgroundColor: theme.primary,
                    borderColor: theme.primary,
                  },
                ]}
                onPress={() => {
                  setSelectedMonth(month);
                }}
              >
                <Text
                  style={[
                    styles.monthChipText,
                    { color: theme.textOnCard },
                    selectedMonth === month && {
                      color: "#fff",
                      fontWeight: "600",
                    },
                  ]}
                >
                  {formatMonthLabel(month)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {availableMonths.length > 1 && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.textOnCard}
              style={{ opacity: 0.5 }}
            />
          )}
        </View>
      )}

      {/* Lista de Despesas */}
      {loading ? (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textOnBackground }]}>
            Carregando despesas...
          </Text>
        </View>
      ) : despesas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
            Nenhuma despesa registrada
          </Text>
          <Text
            style={[
              styles.emptySubtext,
              { color: theme.textOnBackground, opacity: 0.7 },
            ]}
          >
            Adicione despesas compartilhadas da colmeia
          </Text>
        </View>
      ) : despesasFiltradas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
            Nenhuma despesa neste mês
          </Text>
          <Text
            style={[
              styles.emptySubtext,
              { color: theme.textOnBackground, opacity: 0.7 },
            ]}
          >
            Selecione outro mês para ver despesas anteriores
          </Text>
        </View>
      ) : (
        <FlatList
          data={despesasFiltradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const catInfo = getCategoriaInfo(item.categoria);
            const isSelected = deleteMode && selectedDespesas.includes(item.id);

            const openEdit = (d: Despesa) => {
              setSelectedDespesa(d);
              setDescricao(d.descricao);
              setValor(d.valor.toString());
              setCategoria(d.categoria);
              setModalVisible(true);
            };

            return (
              <TouchableOpacity
                onPress={() =>
                  deleteMode ? toggleDespesaSelection(item.id) : openEdit(item)
                }
                onLongPress={() => {
                  if (!deleteMode) {
                    setDeleteMode(true);
                    setSelectedDespesas([item.id]);
                  }
                }}
              >
                <View
                  style={[
                    styles.despesaCard,
                    { backgroundColor: theme.cardColor },
                    isSelected && {
                      borderColor: theme.danger,
                      borderWidth: 3,
                    },
                  ]}
                >
                  <View style={styles.despesaHeader}>
                    <View
                      style={[
                        styles.categoriaIcon,
                        { backgroundColor: catInfo.color + "20" },
                      ]}
                    >
                      <Ionicons
                        name={catInfo.icon as any}
                        size={24}
                        color={catInfo.color}
                      />
                    </View>
                    <View style={styles.despesaInfo}>
                      <Text
                        style={[
                          styles.despesaDescricao,
                          { color: theme.textOnCard },
                        ]}
                      >
                        {item.descricao}
                      </Text>
                      <Text
                        style={[
                          styles.despesaMeta,
                          { color: theme.textOnCard, opacity: 0.7 },
                        ]}
                      >
                        {item.pagoPorNome} • {formatarData(item.data)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.despesaFooter}>
                    <View
                      style={[
                        styles.categoriaBadge,
                        { backgroundColor: catInfo.color + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.categoriaText, { color: catInfo.color }]}
                      >
                        {catInfo.label}
                      </Text>
                    </View>
                    <Text
                      style={[styles.despesaValor, { color: theme.textOnCard }]}
                    >
                      R$ {item.valor.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Barra de Seleção */}
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
            {selectedDespesas.length} selecionada(s)
          </Text>
          <TouchableOpacity
            style={[
              styles.applyButton,
              selectedDespesas.length === 0 && styles.applyButtonDisabled,
            ]}
            onPress={applyBulkAction}
            disabled={selectedDespesas.length === 0}
          >
            <Ionicons name="trash" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ActionButton */}
      {!deleteMode && (
        <ActionButton
          onActionSelect={openAddModal}
          isSelectionMode={deleteMode}
        />
      )}

      {/* FAB Estatísticas */}
      {!deleteMode && (
        <TouchableOpacity
          style={[styles.statsFab, { backgroundColor: theme.primary }]}
          onPress={() => setStatsModalVisible(true)}
        >
          <Ionicons name="stats-chart" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Botão de Votações */}
      <VotingButton
        votes={pendingVotes}
        voteType="delete_expense"
        colmeiaId={activeColmeia?.id || ""}
        visible={!deleteMode}
        style={{ left: 86 }}
      />

      {/* Modal Adicionar/Editar Despesa */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                {selectedDespesa ? "Editar Despesa" : "Nova Despesa"}
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
              placeholder="Descrição"
              placeholderTextColor={theme.textOnCard + "80"}
              value={descricao}
              onChangeText={setDescricao}
            />

            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, color: theme.text },
              ]}
              placeholder="Valor (ex: 50.00)"
              placeholderTextColor={theme.textOnCard + "80"}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, { color: theme.textOnCard }]}>
              Categoria:
            </Text>

            <TouchableOpacity
              style={[
                styles.dropdownButton,
                { backgroundColor: theme.primary, width: "100%" },
              ]}
              onPress={() => setShowCategoriaDropdown(!showCategoriaDropdown)}
            >
              <View style={styles.dropdownButtonContent}>
                <Ionicons
                  name={
                    CATEGORIAS.find((c) => c.value === categoria)?.icon as any
                  }
                  size={20}
                  color="#fff"
                />
                <Text style={styles.dropdownButtonText}>
                  {CATEGORIAS.find((c) => c.value === categoria)?.label}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#fff" />
            </TouchableOpacity>

            {showCategoriaDropdown && (
              <View
                style={[
                  styles.dropdownMenu,
                  { backgroundColor: theme.cardColor },
                ]}
              >
                {CATEGORIAS.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setCategoria(c.value);
                      setShowCategoriaDropdown(false);
                    }}
                  >
                    <View style={styles.dropdownItemWithIcon}>
                      <Ionicons
                        name={c.icon as any}
                        size={20}
                        color={c.color}
                      />
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: theme.textOnCard },
                        ]}
                      >
                        {c.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={addDespesa}
            >
              <Text style={styles.saveButtonText}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Estatísticas */}
      <Modal
        visible={statsModalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: theme.cardColor }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textOnCard }]}>
                Estatísticas
              </Text>
              <TouchableOpacity onPress={() => setStatsModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {/* Total Geral */}
              <View style={styles.statCard}>
                <Text
                  style={[
                    styles.statLabel,
                    { color: theme.textOnCard, opacity: 0.7 },
                  ]}
                >
                  Total Geral
                </Text>
                <Text style={[styles.statValue, { color: theme.textOnCard }]}>
                  R$ {stats.total.toFixed(2)}
                </Text>
              </View>

              {/* Por Usuário */}
              <View style={styles.statSection}>
                <Text
                  style={[styles.statSectionTitle, { color: theme.textOnCard }]}
                >
                  Por Pessoa
                </Text>
                {Object.entries(stats.porUsuario).map(([nome, valor]) => {
                  const isExpanded = expandedUser === nome;
                  const userDespesas = despesas.filter(
                    (d) => d.pagoPorNome === nome
                  );

                  return (
                    <View key={nome}>
                      <TouchableOpacity
                        style={styles.statRow}
                        onPress={() =>
                          setExpandedUser(isExpanded ? null : nome)
                        }
                      >
                        <View style={styles.statRowLabelWithIcon}>
                          <Text
                            style={[
                              styles.statRowLabel,
                              { color: theme.textOnCard, opacity: 0.7 },
                            ]}
                          >
                            {nome}
                          </Text>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={theme.textOnCard}
                            style={{ opacity: 0.5 }}
                          />
                        </View>
                        <Text
                          style={[
                            styles.statRowValue,
                            { color: theme.textOnCard },
                          ]}
                        >
                          R$ {(valor as number).toFixed(2)}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View
                          style={[
                            styles.expandedContent,
                            {
                              borderTopColor: theme.textOnCard + "30",
                            },
                          ]}
                        >
                          {userDespesas.map((despesa) => {
                            const catInfo = getCategoriaInfo(despesa.categoria);
                            return (
                              <View
                                key={despesa.id}
                                style={styles.expandedItem}
                              >
                                <View style={styles.expandedItemLeft}>
                                  <Text
                                    style={[
                                      styles.expandedItemDescription,
                                      { color: theme.textOnCard },
                                    ]}
                                  >
                                    {despesa.descricao}
                                  </Text>
                                  <View style={styles.expandedItemMeta}>
                                    <View
                                      style={[
                                        styles.miniIcon,
                                        {
                                          backgroundColor: catInfo.color + "20",
                                        },
                                      ]}
                                    >
                                      <Ionicons
                                        name={catInfo.icon as any}
                                        size={14}
                                        color={catInfo.color}
                                      />
                                    </View>
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        opacity: 0.7,
                                        color: theme.textOnCard,
                                      }}
                                    >
                                      {catInfo.label}
                                    </Text>
                                  </View>
                                </View>
                                <Text
                                  style={[
                                    styles.expandedItemValue,
                                    { color: theme.textOnCard },
                                  ]}
                                >
                                  R$ {despesa.valor.toFixed(2)}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Por Categoria */}
              <View style={styles.statSection}>
                <Text
                  style={[styles.statSectionTitle, { color: theme.textOnCard }]}
                >
                  Por Categoria
                </Text>
                {Object.entries(stats.porCategoria).map(([cat, valor]) => {
                  const catInfo = getCategoriaInfo(cat as CategoriaFinanceira);
                  const isExpanded = expandedCategory === cat;
                  const categoryDespesas = despesas.filter(
                    (d) => d.categoria === cat
                  );

                  return (
                    <View key={cat}>
                      <TouchableOpacity
                        style={styles.statRow}
                        onPress={() =>
                          setExpandedCategory(
                            isExpanded ? null : (cat as CategoriaFinanceira)
                          )
                        }
                      >
                        <View style={styles.statRowLabelWithIcon}>
                          <View
                            style={[
                              styles.miniIcon,
                              { backgroundColor: catInfo.color + "20" },
                            ]}
                          >
                            <Ionicons
                              name={catInfo.icon as any}
                              size={16}
                              color={catInfo.color}
                            />
                          </View>
                          <Text
                            style={[
                              styles.statRowLabel,
                              { color: theme.textOnCard, opacity: 0.7 },
                            ]}
                          >
                            {catInfo.label}
                          </Text>
                          <Ionicons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={20}
                            color={theme.textOnCard}
                            style={{ opacity: 0.5, marginLeft: 8 }}
                          />
                        </View>
                        <Text
                          style={[
                            styles.statRowValue,
                            { color: theme.textOnCard },
                          ]}
                        >
                          R$ {(valor as number).toFixed(2)}
                        </Text>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View
                          style={[
                            styles.expandedContent,
                            {
                              borderTopColor: theme.textOnCard + "30",
                            },
                          ]}
                        >
                          {categoryDespesas.map((despesa) => (
                            <View key={despesa.id} style={styles.expandedItem}>
                              <View style={styles.expandedItemLeft}>
                                <Text
                                  style={[
                                    styles.expandedItemDescription,
                                    { color: theme.textOnCard },
                                  ]}
                                >
                                  {despesa.descricao}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    opacity: 0.7,
                                    color: theme.textOnCard,
                                  }}
                                >
                                  por {despesa.pagoPorNome}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.expandedItemValue,
                                  { color: theme.textOnCard },
                                ]}
                              >
                                R$ {despesa.valor.toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Média por pessoa */}
              {Object.keys(stats.porUsuario).length > 0 && (
                <View style={styles.statCard}>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: theme.textOnCard, opacity: 0.7 },
                    ]}
                  >
                    Média por Pessoa
                  </Text>
                  <Text style={[styles.statValue, { color: theme.textOnCard }]}>
                    R${" "}
                    {(
                      stats.total / Object.keys(stats.porUsuario).length
                    ).toFixed(2)}
                  </Text>
                </View>
              )}
            </ScrollView>
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
    paddingBottom: 90,
  },
  statsFab: {
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
  despesaCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  despesaHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoriaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  despesaInfo: {
    flex: 1,
  },
  despesaDescricao: {
    fontSize: 16,
    fontWeight: "600",
  },
  despesaMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  deleteButton: {
    padding: 4,
  },
  despesaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F5F5F5",
  },
  categoriaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoriaText: {
    fontSize: 12,
    fontWeight: "600",
  },
  despesaValor: {
    fontSize: 18,
    fontWeight: "bold",
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
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
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
  statCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.9,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    marginTop: 4,
  },
  statSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statRowLabel: {
    fontSize: 14,
  },
  statRowValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statRowLabelWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
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
    paddingBottom: 30,
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
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  expandedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expandedItemLeft: {
    flex: 1,
    marginRight: 12,
  },
  expandedItemDescription: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  expandedItemMeta: {
    fontSize: 12,
    opacity: 0.7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expandedItemValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  votacaoContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    marginTop: 16,
  },
  votacaoTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  votacaoMensagem: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginTop: 8,
  },
  votesFab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  fabBadge: {
    position: "absolute",
    right: -10,
    top: -10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  fabBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  // Filtro de mês
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  filterLabelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  monthScrollView: {
    flex: 1,
  },
  monthFilterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  monthChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 80,
    alignItems: "center",
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  // Dropdown padronizado
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  dropdownButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  dropdownMenu: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  dropdownItemWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dropdownItemText: {
    fontSize: 16,
  },
});
