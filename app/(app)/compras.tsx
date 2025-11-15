/**
 * Compras screen
 * Manages the shared shopping list: add/edit items, mark purchased and bulk actions.
 */
import React, { useEffect, useState } from "react";
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
} from "firebase/firestore";
import { db, auth } from "@/firebaseConfig";
import { addActivityLog } from "@/utils/activityLogger";

type Categoria =
  | "alimentos"
  | "limpeza"
  | "higiene"
  | "carro"
  | "roupas"
  | "pet"
  | "casa"
  | "outros";
type Unidade = "unidade" | "L" | "gr" | "kg";

interface ItemCompra {
  id: string;
  nome: string;
  quantidade: number;
  unidadeQuantidade: Unidade;
  categoria: Categoria;
  createdAt?: any;
  createdBy?: string;
  precoPor?: number | null;
  unidadePreco?: Unidade;
}

const CATEGORIAS: {
  value: Categoria;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    value: "alimentos",
    label: "Alimentos",
    icon: "restaurant",
    color: "#FF9500",
  },
  {
    value: "limpeza",
    label: "Limpeza",
    icon: "water",
    color: "#FFB300",
  },
  {
    value: "higiene",
    label: "Higiene",
    icon: "body",
    color: "#34C759",
  },
  {
    value: "carro",
    label: "Carro",
    icon: "car",
    color: "#007AFF",
  },
  {
    value: "roupas",
    label: "Roupas",
    icon: "shirt",
    color: "#FF2D55",
  },
  {
    value: "pet",
    label: "Pet",
    icon: "paw",
    color: "#AF52DE",
  },
  {
    value: "casa",
    label: "Casa",
    icon: "home",
    color: "#5856D6",
  },
  {
    value: "outros",
    label: "Outros",
    icon: "ellipsis-horizontal",
    color: "#8E8E93",
  },
];

const unidade_QUANTIDADE: { value: Unidade; label: string }[] = [
  { value: "unidade", label: "unidade" },
  { value: "L", label: "L" },
  { value: "gr", label: "gr" },
  { value: "kg", label: "kg" },
];

const unidade_PRECO: { value: Unidade; label: string }[] = [
  { value: "unidade", label: "unidade" },
  { value: "L", label: "L" },
  { value: "gr", label: "100gr" },
  { value: "kg", label: "kg" },
];

export default function ComprasScreen() {
  const { activeColmeia } = useColmeia();
  const theme = useAppTheme();

  // data
  const [itens, setItens] = useState<ItemCompra[]>([]);
  const [loading, setLoading] = useState(true);

  // modal / form
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemCompra | null>(null);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidadeQuantidade, setUnidadeQuantidade] =
    useState<Unidade>("unidade");
  const [categoria, setCategoria] = useState<Categoria>("alimentos");
  const [precoPor, setPrecoPor] = useState("");
  const [unidadePreco, setUnidadePreco] = useState<Unidade>("unidade");

  // Dropdown states
  const [showUnidadeQuantidadeDropdown, setShowUnidadeQuantidadeDropdown] =
    useState(false);
  const [showUnidadePrecoDropdown, setShowUnidadePrecoDropdown] =
    useState(false);
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);

  // selection / bulk actions
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedItens, setSelectedItens] = useState<string[]>([]);

  useEffect(() => {
    if (!activeColmeia) {
      setItens([]);
      setLoading(false);
      return;
    }

    const comprasRef = collection(db, "colmeias", activeColmeia.id, "compras");
    const q = query(comprasRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as ItemCompra[];
      setItens(data);
      setLoading(false);
    });

    return () => unsub();
  }, [activeColmeia]);

  // Auto exit deleteMode when no items are selected
  useEffect(() => {
    if (deleteMode && selectedItens.length === 0) {
      setDeleteMode(false);
    }
  }, [selectedItens, deleteMode]);

  // helpers
  const parsePrice = (v: string) => {
    if (!v) return null;
    const cleaned = v.replace(/\s/g, "").replace(/,/, ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  const formatBRL = (v: number) => {
    return `R$ ${v.toFixed(2).replace(".", ",")}`;
  };

  const calculatePrecoTotal = (item: ItemCompra) => {
    if (!item.precoPor) return null;

    // Se o preço é por unidade, simplesmente multiplica preço * quantidade
    // independente do tipo de quantidade (kg, gr, unidade, etc)
    if (item.unidadePreco === "unidade") {
      return item.precoPor * item.quantidade;
    }

    // Se as unidades são iguais, multiplicação direta
    if (item.unidadeQuantidade === item.unidadePreco) {
      return item.precoPor * item.quantidade;
    }

    // Conversões necessárias para preços por peso (gr/kg)
    let quantidadeNormalizada = item.quantidade;

    // Converter quantidade para a unidade do preço
    // Preço em gr = preço por 100gr
    if (item.unidadeQuantidade === "kg" && item.unidadePreco === "gr") {
      quantidadeNormalizada = (item.quantidade * 1000) / 100; // kg -> 100gr
    } else if (item.unidadeQuantidade === "gr" && item.unidadePreco === "gr") {
      quantidadeNormalizada = item.quantidade / 100; // gr -> 100gr
    } else if (item.unidadeQuantidade === "gr" && item.unidadePreco === "kg") {
      quantidadeNormalizada = item.quantidade / 1000;
    }

    return item.precoPor * quantidadeNormalizada;
  };

  // CRUD
  const openAdd = () => {
    setSelectedItem(null);
    setNome("");
    setQuantidade("");
    setUnidadeQuantidade("unidade");
    setCategoria("alimentos");
    setPrecoPor("");
    setUnidadePreco("unidade");
    setModalVisible(true);
  };

  const openEdit = (item: ItemCompra) => {
    setSelectedItem(item);
    setNome(item.nome);
    setQuantidade(String(item.quantidade));
    setUnidadeQuantidade(item.unidadeQuantidade || "unidade");
    setCategoria(item.categoria);
    setPrecoPor(item.precoPor != null ? String(item.precoPor) : "");
    setUnidadePreco(item.unidadePreco || "unidade");
    setModalVisible(true);
  };

  const saveItem = async () => {
    if (!activeColmeia || !nome.trim()) return;

    const qtd = parseFloat(quantidade.replace(/,/, "."));
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert("Erro", "Quantidade inválida");
      return;
    }

    const price = parsePrice(precoPor);

    try {
      if (selectedItem) {
        const ref = doc(
          db,
          "colmeias",
          activeColmeia.id,
          "compras",
          selectedItem.id
        );
        await updateDoc(ref, {
          nome: nome.trim(),
          quantidade: qtd,
          unidadeQuantidade,
          categoria,
          precoPor: price,
          unidadePreco,
        });
        Alert.alert("Sucesso", "Item atualizado!");
      } else {
        const ref = collection(db, "colmeias", activeColmeia.id, "compras");
        await addDoc(ref, {
          nome: nome.trim(),
          quantidade: qtd,
          unidadeQuantidade,
          categoria,
          precoPor: price,
          unidadePreco,
          createdBy: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
        });
      }
      setModalVisible(false);
      setSelectedItem(null);
      setNome("");
      setQuantidade("");
      setUnidadeQuantidade("unidade");
      setCategoria("alimentos");
      setPrecoPor("");
      setUnidadePreco("unidade");
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível salvar o item");
    }
  };

  const toggleComprado = async (item: ItemCompra) => {
    // Função removida - não há mais funcionalidade de marcar como comprado
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItens((s) =>
      s.includes(itemId) ? s.filter((id) => id !== itemId) : [...s, itemId]
    );
  };

  const applyBulkAction = () => {
    if (!activeColmeia) return;
    if (selectedItens.length === 0) {
      Alert.alert("Aviso", "Selecione pelo menos um item");
      return;
    }

    Alert.alert(
      "Confirmar Exclusão",
      `Deseja remover ${selectedItens.length} ${
        selectedItens.length === 1 ? "item" : "itens"
      }?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => {
            // Clear selection when user cancels
            setDeleteMode(false);
            setSelectedItens([]);
          },
        },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              const promises = selectedItens.map((id) =>
                deleteDoc(doc(db, "colmeias", activeColmeia.id, "compras", id))
              );
              await Promise.all(promises);
              Alert.alert(
                "Sucesso",
                `${selectedItens.length} item(ns) excluído(s)`
              );
              setDeleteMode(false);
              setSelectedItens([]);
            } catch (err) {
              console.error(err);
              Alert.alert("Erro", "Não foi possível excluir os itens");
            }
          },
        },
      ]
    );
  };

  const cancelSelection = () => {
    setDeleteMode(false);
    setSelectedItens([]);
  };

  const limparComprados = () => {
    // Função removida - não há mais itens comprados
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
        <Ionicons name="cart-outline" size={64} color={theme.icon} />
        <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
          Nenhuma colmeia ativa
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textOnBackground }]}>
          Selecione uma colmeia para gerenciar compras
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textOnBackground }]}>
            Carregando lista...
          </Text>
        </View>
      ) : itens.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
            Lista vazia
          </Text>
          <Text
            style={[styles.emptySubtext, { color: theme.textOnBackground }]}
          >
            Adicione itens à lista de compras
          </Text>
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const cat =
              CATEGORIAS.find((c) => c.value === item.categoria) ||
              CATEGORIAS[0];
            const isSelected = deleteMode && selectedItens.includes(item.id);
            const precoTotal = calculatePrecoTotal(item);

            return (
              <TouchableOpacity
                onPress={() =>
                  deleteMode ? toggleItemSelection(item.id) : openEdit(item)
                }
                onLongPress={() => {
                  if (!deleteMode) {
                    setDeleteMode(true);
                    setSelectedItens([item.id]);
                  }
                }}
              >
                <View
                  style={[
                    styles.itemCard,
                    { backgroundColor: theme.cardColor },
                    isSelected && {
                      borderColor: theme.danger,
                      borderWidth: 3,
                    },
                  ]}
                >
                  {/* left accent bar to match hive identity */}
                  <View
                    style={[
                      styles.itemAccent,
                      { backgroundColor: cat.color || theme.primary },
                    ]}
                  />

                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text
                        style={[styles.itemNome, { color: theme.textOnCard }]}
                        numberOfLines={1}
                      >
                        {item.nome}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.itemQuantidade,
                        { color: theme.textOnCard, opacity: 0.7 },
                      ]}
                    >
                      Quantidade: {item.quantidade}{" "}
                      {item.unidadeQuantidade || "unidade"}
                    </Text>
                    {item.precoPor != null && (
                      <Text
                        style={[
                          styles.itemQuantidade,
                          { color: theme.textOnCard, opacity: 0.6 },
                        ]}
                      >
                        Preço: {formatBRL(item.precoPor)}/
                        {item.unidadePreco === "gr"
                          ? "100gr"
                          : item.unidadePreco || "unidade"}
                      </Text>
                    )}
                  </View>

                  <View style={styles.rightInfo}>
                    <View
                      style={[
                        styles.categoriaBadge,
                        { backgroundColor: cat.color },
                      ]}
                    >
                      <Text style={styles.categoriaBadgeLabel}>
                        {cat.label}
                      </Text>
                    </View>
                    {precoTotal != null ? (
                      <Text
                        style={[styles.priceText, { color: theme.textOnCard }]}
                      >
                        {formatBRL(precoTotal)}
                      </Text>
                    ) : (
                      <Text
                        style={[
                          styles.pricePlaceholder,
                          { color: theme.textOnCard, opacity: 0.3 },
                        ]}
                      >
                        R$ -
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {deleteMode && (
        <View style={[styles.selectionBar, { backgroundColor: theme.primary }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={cancelSelection}
          >
            <Ionicons name="close" size={24} color="#fff" />
            <Text style={styles.selectionBarText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.selectionBarText}>
            {selectedItens.length} selecionado(s)
          </Text>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={applyBulkAction}
          >
            <Text style={styles.selectionBarText}>Remover</Text>
            <Ionicons name="trash" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {!deleteMode && (
        <ActionButton onActionSelect={openAdd} isSelectionMode={deleteMode} />
      )}

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
                {selectedItem ? "Editar Item" : "Adicionar Item"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textOnCard} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    color: theme.textOnBackground,
                  },
                ]}
                placeholder="Nome do item"
                placeholderTextColor={theme.textOnBackground + "80"}
                value={nome}
                onChangeText={setNome}
              />

              <Text style={[styles.label, { color: theme.textOnCard }]}>
                Quantidade:
              </Text>

              <View style={styles.inputWithDropdown}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputHalf,
                    {
                      backgroundColor: theme.background,
                      color: theme.textOnBackground,
                    },
                  ]}
                  placeholder="Qtd."
                  placeholderTextColor={theme.textOnBackground + "80"}
                  value={quantidade}
                  onChangeText={setQuantidade}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() =>
                    setShowUnidadeQuantidadeDropdown(
                      !showUnidadeQuantidadeDropdown
                    )
                  }
                >
                  <Text style={styles.dropdownButtonText}>
                    {unidadeQuantidade}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {showUnidadeQuantidadeDropdown && (
                <View
                  style={[
                    styles.dropdownMenu,
                    { backgroundColor: theme.cardColor },
                  ]}
                >
                  {unidade_QUANTIDADE.map((u) => (
                    <TouchableOpacity
                      key={u.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setUnidadeQuantidade(u.value);
                        setShowUnidadeQuantidadeDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: theme.textOnCard },
                        ]}
                      >
                        {u.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

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

              <Text style={[styles.label, { color: theme.textOnCard }]}>
                Preço por:
              </Text>

              <View style={styles.inputWithDropdown}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputHalf,
                    {
                      backgroundColor: theme.background,
                      color: theme.textOnBackground,
                    },
                  ]}
                  placeholder="R$ 0,00"
                  placeholderTextColor={theme.textOnBackground + "80"}
                  value={precoPor}
                  onChangeText={setPrecoPor}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[
                    styles.dropdownButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() =>
                    setShowUnidadePrecoDropdown(!showUnidadePrecoDropdown)
                  }
                >
                  <Text style={styles.dropdownButtonText}>
                    {unidadePreco === "gr" ? "100gr" : unidadePreco}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {showUnidadePrecoDropdown && (
                <View
                  style={[
                    styles.dropdownMenu,
                    { backgroundColor: theme.cardColor },
                  ]}
                >
                  {unidade_PRECO.map((u) => (
                    <TouchableOpacity
                      key={u.value}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setUnidadePreco(u.value);
                        setShowUnidadePrecoDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: theme.textOnCard },
                        ]}
                      >
                        {u.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={saveItem}
              >
                <Text style={styles.saveButtonText}>
                  {selectedItem ? "Salvar" : "Adicionar"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  listContent: { padding: 16, paddingBottom: 90 },
  itemCard: {
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
  itemAccent: {
    width: 6,
    height: "100%",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    marginRight: 12,
  },
  itemContent: { flex: 1 },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  itemNome: { fontSize: 16, fontWeight: "600", flex: 1 },
  categoriaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  categoriaBadgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  itemQuantidade: { fontSize: 14 },
  categoriaBadgeText: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
  },
  categoriaLabel: { fontSize: 12, fontWeight: "600", opacity: 0.7 },
  subtotalText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  rightInfo: { marginLeft: 12, alignItems: "flex-end", gap: 6 },
  priceText: { fontSize: 16, fontWeight: "700" },
  pricePlaceholder: { fontSize: 13 },
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
    opacity: 0.7,
  },
  loadingText: { marginTop: 16, fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  modalScrollView: {
    maxHeight: "100%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold" },
  input: {
    backgroundColor: "#f5f5f5",
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
  categoriaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  categoriaOption: {
    width: "47%",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E5EA",
  },
  categoriaOptionActive: { backgroundColor: "#F5F5F5" },
  categoriaOptionText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
    fontWeight: "600",
  },
  categoriaOptionTextActive: { color: "#333" },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
  selectionBarText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { flexDirection: "row", alignItems: "center", gap: 8 },
  applyButton: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputWithDropdown: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  inputHalf: {
    flex: 1,
    marginBottom: 0,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 4,
    minWidth: 100,
  },
  dropdownButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  dropdownMenu: {
    borderRadius: 8,
    marginBottom: 12,
    boxShadow: "0px 2px 8px rgba(0,0,0,0.15)",
    elevation: 4,
    overflow: "hidden",
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
    fontSize: 14,
  },
});
