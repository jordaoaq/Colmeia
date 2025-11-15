// =====================
// ROTINAS E CALENDÁRIO
// =====================
// Tela para gerenciar rotinas domésticas recorrentes e visualizar calendário
// Palavras-chave para busca: ROTINAS, CALENDÁRIO, TAREFAS DOMÉSTICAS
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
import { Calendar } from "react-native-calendars";
import { useColmeia, useTheme } from "@/contexts/ColmeiaContext";
import { useAppTheme } from "@/hooks/useAppTheme";
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
import ActionButton from "@/components/ActionButton";
import {
  needsVoting,
  createVote,
  deleteTarefaDomesticaDirect,
} from "@/utils/votingSystem";


// Tipos de ação e frequência de rotina
type ActionType = "add" | "edit";
type Frequencia = "diaria" | "semanal" | "mensal";


// Estrutura de uma rotina doméstica
interface TarefaDomestica {
  id: string;
  titulo: string;
  descricao?: string;
  frequencia: Frequencia;
  ultimaRealizacao?: any;
  historicoRealizacoes?: any[]; // Array de timestamps com data/hora
  responsavel?: string;
  createdAt?: any;
  createdBy?: string;
  // explicit scheduling
  scheduledWeekdays?: number[]; // Array de dias da semana [0-6] para tarefas semanais
  scheduledDay?: number | null; // 1..31 para tarefas mensais
  scheduledHour?: number; // 0-23 hora da tarefa
  scheduledMinute?: number; // 0-59 minutos da tarefa
}

// Opções de frequência disponíveis
const FREQUENCIAS: { value: Frequencia; label: string; icon: string }[] = [
  { value: "diaria", label: "Diária", icon: "sunny" },
  { value: "semanal", label: "Semanal", icon: "calendar" },
  { value: "mensal", label: "Mensal", icon: "calendar-outline" },
];

// =====================
// COMPONENTE PRINCIPAL DA TELA ROTINAS
// =====================
// Gerencia lista de rotinas e calendário visual
export default function RotinasScreen() {
  // =====================
  // ESTADOS PRINCIPAIS DA TELA
  // =====================
  const { activeColmeia } = useColmeia();
  const { currentTheme } = useTheme();
  const theme = useAppTheme();
  const [tarefas, setTarefas] = useState<TarefaDomestica[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTarefa, setSelectedTarefa] = useState<TarefaDomestica | null>(
    null
  );
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedTarefas, setSelectedTarefas] = useState<string[]>([]);

  // Formulário de criação/edição de rotina
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  // explicit schedule picks
  const [scheduledWeekdays, setScheduledWeekdays] = useState<number[]>([
    new Date().getDay(),
  ]); // Array de dias da semana
  const [scheduledDay, setScheduledDay] = useState<number | null>(
    new Date().getDate()
  );
  const [scheduledHour, setScheduledHour] = useState<number>(9); // Hora padrão: 9h
  const [scheduledMinute, setScheduledMinute] = useState<number>(0); // Minuto padrão: 0

  // Data selecionada no calendário (formato YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const onDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
  };

  // Helpers para agendamento e prioridade
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const startOfWeek = (d: Date) => {
    const res = new Date(d);
    const day = res.getDay(); // 0 (Sun)..6
    res.setDate(res.getDate() - day);
    res.setHours(0, 0, 0, 0);
    return res;
  };

  const diffDays = (a: Date, b: Date) => {
    const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ad.getTime() - bd.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isDateInWeek = (d: Date | null, refDate: Date) => {
    if (!d) return false;
    const start = startOfWeek(refDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return dd >= start && dd <= end;
  };

  // =====================
  // FUNÇÃO: Calcula a próxima data de execução da rotina
  // =====================
  const getDueDateForTask = (task: TarefaDomestica, refDate: Date) => {
    if (task.frequencia === "diaria")
      return new Date(
        refDate.getFullYear(),
        refDate.getMonth(),
        refDate.getDate()
      );

    if (task.frequencia === "semanal") {
      // Para tarefas semanais com múltiplos dias, retorna o próximo dia agendado
      const weekdays = task.scheduledWeekdays || [refDate.getDay()];
      const start = startOfWeek(refDate); // Sunday
      const currentWeekday = refDate.getDay();

      // Encontra o próximo dia agendado na semana
      let nextWeekday = weekdays.find((wd) => wd >= currentWeekday);
      if (nextWeekday === undefined) {
        nextWeekday = weekdays[0]; // Volta para o primeiro dia da próxima semana
      }

      const due = new Date(start);
      due.setDate(start.getDate() + nextWeekday);
      due.setHours(0, 0, 0, 0);
      return due;
    }

    // mensal
    // prefer explicit scheduledDay, fallback to createdAt day-of-month or today
    let dayOfMonth =
      typeof task.scheduledDay === "number"
        ? task.scheduledDay
        : refDate.getDate();
    if (
      !dayOfMonth &&
      task.createdAt &&
      typeof task.createdAt.toDate === "function"
    ) {
      dayOfMonth = task.createdAt.toDate().getDate();
    }
    // clamp day to month
    const monthDays = new Date(
      refDate.getFullYear(),
      refDate.getMonth() + 1,
      0
    ).getDate();
    const dom = Math.min(dayOfMonth, monthDays);
    const due = new Date(refDate.getFullYear(), refDate.getMonth(), dom);
    due.setHours(0, 0, 0, 0);
    return due;
  };

  // =====================
  // FUNÇÃO: Calcula metadados para ordenação, cor e status da rotina
  // =====================
  const getTaskMeta = (task: TarefaDomestica, refDate: Date) => {
    const dueDate = getDueDateForTask(task, refDate);

    const lastDone =
      task.ultimaRealizacao &&
      typeof task.ultimaRealizacao.toDate === "function"
        ? task.ultimaRealizacao.toDate()
        : null;

    // Verifica se foi feita no período correto baseado na frequência
    let isDoneInPeriod = false;
    if (lastDone) {
      if (task.frequencia === "diaria") {
        // Diária: mesmo dia
        isDoneInPeriod = sameDay(lastDone, refDate);
      } else if (task.frequencia === "semanal") {
        // Semanal: mesma semana
        isDoneInPeriod = isDateInWeek(lastDone, refDate);
      } else if (task.frequencia === "mensal") {
        // Mensal: mesmo mês e ano
        isDoneInPeriod =
          lastDone.getMonth() === refDate.getMonth() &&
          lastDone.getFullYear() === refDate.getFullYear();
      }
    }

    const doneOnDueDate = lastDone ? sameDay(lastDone, dueDate) : false;
    const daysOverdue =
      !isDoneInPeriod && dueDate < refDate ? diffDays(refDate, dueDate) : 0;
    const daysUntilDue = dueDate > refDate ? diffDays(dueDate, refDate) : 0;
    const lastDoneWeekday = lastDone
      ? lastDone.toLocaleString("pt-BR", { weekday: "short" })
      : null;

    let status: "done" | "dueToday" | "upcoming" | "soon" | "overdue" = "soon";

    // Se foi feita no período correto, marca como concluída
    if (isDoneInPeriod) {
      status = "done";
    } else if (daysOverdue > 0) {
      status = "overdue";
    } else if (daysUntilDue === 0) {
      status = "dueToday";
    } else if (daysUntilDue >= 2) {
      status = "upcoming";
    }

    return {
      dueDate,
      lastDone,
      doneOnDueDate,
      daysOverdue,
      daysUntilDue,
      lastDoneWeekday,
      status,
      isDoneInPeriod,
    };
  };

  // =====================
  // MARCAÇÃO DE DATAS NO CALENDÁRIO
  // =====================
  const markedDates: { [k: string]: any } = {};

  tarefas.forEach((t) => {
    // Verificar historicoRealizacoes para mostrar bolinhas apenas nos dias que foram concluídas
    if (t.historicoRealizacoes && Array.isArray(t.historicoRealizacoes)) {
      t.historicoRealizacoes.forEach((realizacao) => {
        const realizacaoDate =
          realizacao && typeof realizacao.toDate === "function"
            ? realizacao.toDate()
            : null;

        if (realizacaoDate) {
          const ds = realizacaoDate.toISOString().slice(0, 10);
          if (!markedDates[ds]) {
            markedDates[ds] = { dots: [] };
          }

          // Limitar a 10 bolinhas por dia (2 linhas x 5 colunas)
          if (markedDates[ds].dots.length < 10) {
            markedDates[ds].dots.push({ color: theme.success });
          }
        }
      });
    }

    // Fallback: se não tem historicoRealizacoes mas tem ultimaRealizacao
    if (
      (!t.historicoRealizacoes || t.historicoRealizacoes.length === 0) &&
      t.ultimaRealizacao
    ) {
      const lastDone =
        t.ultimaRealizacao && typeof t.ultimaRealizacao.toDate === "function"
          ? t.ultimaRealizacao.toDate()
          : null;

      if (lastDone) {
        const ds = lastDone.toISOString().slice(0, 10);
        if (!markedDates[ds]) {
          markedDates[ds] = { dots: [] };
        }

        if (markedDates[ds].dots.length < 10) {
          markedDates[ds].dots.push({ color: theme.success });
        }
      }
    }
  });

  // Garante que a data selecionada está marcada
  if (selectedDate) {
    markedDates[selectedDate] = {
      ...(markedDates[selectedDate] || {}),
      selected: true,
      selectedColor: theme.primary,
    };
  }

  // Ordena rotinas por prioridade (mais atrasadas primeiro)
  const refDate = new Date(selectedDate + "T00:00:00");
  const tarefasWithMeta = tarefas.map((t) => ({
    task: t,
    meta: getTaskMeta(t, refDate),
  }));

  const priority = (m: ReturnType<typeof getTaskMeta>) => {
    if (m.status === "overdue") return 10000 + m.daysOverdue; // higher = more urgent
    if (m.status === "dueToday") return 5000;
    if (m.status === "upcoming") return 2000 - m.daysUntilDue;
    if (m.status === "soon") return 1000 - m.daysUntilDue;
    if (m.status === "done") return 0;
    return 0;
  };

  const sortedTarefas = tarefasWithMeta
    .slice()
    .sort((a, b) => {
      const pa = priority(a.meta);
      const pb = priority(b.meta);
      if (pa !== pb) return pb - pa; // descending
      // tie-breakers: not done first
      if (a.meta.doneOnDueDate !== b.meta.doneOnDueDate)
        return a.meta.doneOnDueDate ? 1 : -1;
      // more recently created first
      const aCreated =
        a.task.createdAt && typeof a.task.createdAt.toDate === "function"
          ? a.task.createdAt.toDate().getTime()
          : 0;
      const bCreated =
        b.task.createdAt && typeof b.task.createdAt.toDate === "function"
          ? b.task.createdAt.toDate().getTime()
          : 0;
      return bCreated - aCreated;
    })
    .map((p) => ({ ...p.task, _meta: p.meta }));

  // =====================
  // EFEITO: Carrega rotinas da colmeia ativa
  // =====================
  useEffect(() => {
    if (!activeColmeia) {
      setLoading(false);
      return;
    }

    const tarefasRef = collection(db, "colmeias", activeColmeia.id, "rotinas");
    const q = query(tarefasRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tarefasData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TarefaDomestica[];
      setTarefas(tarefasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeColmeia]);

  // =====================
  // FUNÇÃO: Adiciona ou edita rotina doméstica
  // =====================
  const addTarefa = async () => {
    if (!titulo.trim() || !activeColmeia) return;

    try {
      // Se está editando, atualiza a tarefa existente
      if (selectedTarefa) {
        const tarefaRef = doc(
          db,
          "colmeias",
          activeColmeia.id,
          "rotinas",
          selectedTarefa.id
        );
        await updateDoc(tarefaRef, {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          frequencia,
          scheduledWeekdays:
            frequencia === "semanal" ? scheduledWeekdays : null,
          scheduledDay: frequencia === "mensal" ? scheduledDay : null,
          scheduledHour,
          scheduledMinute,
        });

        Alert.alert("Sucesso", "Tarefa atualizada!");
      } else {
        // Cria nova tarefa
        const tarefasRef = collection(
          db,
          "colmeias",
          activeColmeia.id,
          "rotinas"
        );
        await addDoc(tarefasRef, {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          frequencia,
          scheduledWeekdays:
            frequencia === "semanal" ? scheduledWeekdays : null,
          scheduledDay: frequencia === "mensal" ? scheduledDay : null,
          scheduledHour,
          scheduledMinute,
          createdBy: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
        });

        await addActivityLog({
          colmeiaId: activeColmeia.id,
          type: "task_created",
          metadata: { taskTitle: titulo.trim() },
        });
      }

      setTitulo("");
      setDescricao("");
      setFrequencia("semanal");
      setScheduledWeekdays([new Date().getDay()]);
      setScheduledDay(new Date().getDate());
      setScheduledHour(9);
      setScheduledMinute(0);
      setSelectedTarefa(null);
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar a tarefa");
    }
  };

  // =====================
  // FUNÇÃO: Marca rotina como realizada
  // =====================
  const marcarRealizada = async (tarefa: TarefaDomestica) => {
    if (!activeColmeia) {
      Alert.alert("Erro", "Nenhuma colmeia ativa");
      return;
    }

    console.log("Marcando tarefa como realizada:", {
      tarefaId: tarefa.id,
      colmeiaId: activeColmeia.id,
      titulo: tarefa.titulo,
    });

    try {
      const tarefaRef = doc(
        db,
        "colmeias",
        activeColmeia.id,
        "rotinas",
        tarefa.id
      );

      console.log("Referência criada, atualizando documento...");

      // Criar timestamp atual para adicionar ao histórico
      const agora = new Date();
      const currentHistorico = tarefa.historicoRealizacoes || [];

      await updateDoc(tarefaRef, {
        ultimaRealizacao: serverTimestamp(),
        responsavel: auth.currentUser?.uid,
        historicoRealizacoes: [...currentHistorico, agora],
      });

      console.log("Documento atualizado, registrando atividade...");

      await addActivityLog({
        colmeiaId: activeColmeia.id,
        type: "task_completed",
        metadata: { taskTitle: tarefa.titulo },
      });

      console.log("Sucesso!");
      Alert.alert("Sucesso", "Tarefa marcada como realizada!");
    } catch (error: any) {
      console.error("Erro ao marcar tarefa:", error);
      console.error("Detalhes do erro:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      Alert.alert(
        "Erro",
        `Não foi possível marcar a tarefa.\nDetalhes: ${error.message || error}`
      );
    }
  };

  // =====================
  // FUNÇÃO: Desfaz marcação de rotina realizada
  // =====================
  const desfazerRealizacao = async (tarefa: TarefaDomestica) => {
    if (!activeColmeia) {
      Alert.alert("Erro", "Nenhuma colmeia ativa");
      return;
    }

    try {
      const tarefaRef = doc(
        db,
        "colmeias",
        activeColmeia.id,
        "rotinas",
        tarefa.id
      );

      // Remove a última entrada do histórico
      const currentHistorico = tarefa.historicoRealizacoes || [];
      const novoHistorico = currentHistorico.slice(0, -1);

      // Atualiza ultimaRealizacao para ser a penúltima realização (se existir)
      const novaUltimaRealizacao =
        novoHistorico.length > 0
          ? novoHistorico[novoHistorico.length - 1]
          : null;

      await updateDoc(tarefaRef, {
        ultimaRealizacao: novaUltimaRealizacao,
        responsavel: novaUltimaRealizacao ? tarefa.responsavel : null,
        historicoRealizacoes: novoHistorico,
      });

      await addActivityLog({
        colmeiaId: activeColmeia.id,
        type: "task_uncompleted",
        metadata: { taskTitle: tarefa.titulo },
      });

      Alert.alert("Sucesso", "Tarefa desmarcada!");
    } catch (error: any) {
      console.error("Erro ao desmarcar tarefa:", error);
      Alert.alert("Erro", "Não foi possível desmarcar a tarefa");
    }
  };

  // =====================
  // FUNÇÃO: Deleta rotina (com ou sem votação)
  // =====================
  const deleteTarefa = async (tarefa: TarefaDomestica) => {
    if (!activeColmeia) return;

    const precisaVotacao = await needsVoting(activeColmeia.id);

    if (precisaVotacao) {
      // Cria votação
      try {
        await createVote(
          activeColmeia.id,
          "delete_task",
          tarefa.id,
          tarefa.titulo
        );
        Alert.alert(
          "Votação Iniciada",
          "Uma votação foi criada para deletar esta tarefa"
        );
      } catch (error) {
        Alert.alert("Erro", "Não foi possível criar a votação");
      }
    } else {
      // Deleta diretamente
      Alert.alert("Confirmar Exclusão", `Deseja deletar "${tarefa.titulo}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTarefaDomesticaDirect(
                activeColmeia.id,
                tarefa.id,
                tarefa.titulo
              );
              Alert.alert("Sucesso", "Tarefa deletada!");
            } catch (error) {
              Alert.alert("Erro", "Não foi possível deletar a tarefa");
            }
          },
        },
      ]);
    }
  };

  // Abre modal para adicionar rotina
    setSelectedTarefa(null);
    setTitulo("");
    setDescricao("");
    setFrequencia("semanal");
    setScheduledWeekdays([new Date().getDay()]);
    setScheduledDay(new Date().getDate());
    setScheduledHour(9);
    setScheduledMinute(0);
    setModalVisible(true);
  };

  // Long press para entrar no modo de exclusão
    // Entra no modo de exclusão e seleciona o card
    if (!deleteMode) {
      setDeleteMode(true);
      setSelectedTarefas([tarefaId]);
    }
  };

  // Seleciona/deseleciona rotina para exclusão
    if (deleteMode) {
      // No modo de exclusão, adiciona ou remove da seleção
      setSelectedTarefas((prev) =>
        prev.includes(tarefaId)
          ? prev.filter((id) => id !== tarefaId)
          : [...prev, tarefaId]
      );
    } else {
      // Comportamento normal: abre para editar
      const tarefa = tarefas.find((t) => t.id === tarefaId);
      if (tarefa) {
        setSelectedTarefa(tarefa);
        setTitulo(tarefa.titulo);
        setDescricao(tarefa.descricao || "");
        setFrequencia(tarefa.frequencia);
        setScheduledWeekdays(
          tarefa.scheduledWeekdays && tarefa.scheduledWeekdays.length > 0
            ? tarefa.scheduledWeekdays
            : [new Date().getDay()]
        );
        setScheduledDay(
          typeof tarefa.scheduledDay === "number"
            ? tarefa.scheduledDay
            : tarefa.createdAt && typeof tarefa.createdAt.toDate === "function"
            ? tarefa.createdAt.toDate().getDate()
            : new Date().getDate()
        );
        setScheduledHour(
          tarefa.scheduledHour !== undefined ? tarefa.scheduledHour : 9
        );
        setScheduledMinute(
          tarefa.scheduledMinute !== undefined ? tarefa.scheduledMinute : 0
        );
        setModalVisible(true);
      }
    }
  };

  // Sai do modo de exclusão quando todos os cards são desselecionados
  // Sai do modo de exclusão se nada estiver selecionado
  useEffect(() => {
    if (deleteMode && selectedTarefas.length === 0) {
      setDeleteMode(false);
    }
  }, [selectedTarefas, deleteMode]);

  // Aplica ação em lote (exclusão de várias rotinas)
    if (selectedTarefas.length === 0) {
      Alert.alert("Aviso", "Selecione pelo menos uma tarefa");
      return;
    }

    if (!activeColmeia) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const precisaVotacao = await needsVoting(activeColmeia.id);

      if (precisaVotacao) {
        for (const tarefaId of selectedTarefas) {
          const tarefa = tarefas.find((t) => t.id === tarefaId);
          if (tarefa) {
            await createVote(
              activeColmeia.id,
              "delete_task",
              tarefaId,
              tarefa.titulo
            );
          }
        }
        Alert.alert(
          "Votação iniciada",
          `${selectedTarefas.length} votação(ões) criada(s). Aguarde aprovação dos membros.`
        );
      } else {
        for (const tarefaId of selectedTarefas) {
          const tarefa = tarefas.find((t) => t.id === tarefaId);
          if (tarefa) {
            await deleteTarefaDomesticaDirect(
              activeColmeia.id,
              tarefaId,
              tarefa.titulo
            );
          }
        }
        Alert.alert(
          "Sucesso",
          `${selectedTarefas.length} tarefa(s) excluída(s)`
        );
      }
    } catch (error) {
      console.error("Erro ao aplicar ação:", error);
      Alert.alert("Erro", "Não foi possível aplicar a ação");
    } finally {
      setDeleteMode(false);
      setSelectedTarefas([]);
    }
  };

  // Cancela seleção em lote
    setDeleteMode(false);
    setSelectedTarefas([]);
  };

  // Fecha modal de rotina
    setModalVisible(false);
    setTitulo("");
    setDescricao("");
    setFrequencia("semanal");
    setSelectedTarefa(null);
    setScheduledWeekdays([new Date().getDay()]);
    setScheduledDay(new Date().getDate());
    setScheduledHour(9);
    setScheduledMinute(0);
  };

  // Cor para cada frequência
    switch (freq) {
      case "diaria":
        return "#FF9500";
      case "semanal":
        return "#007AFF";
      case "mensal":
        return "#34C759";
    }
  };

  // Texto de tempo desde última realização
    if (!ultimaRealizacao) return "Nunca realizada";

    const agora = new Date();
    const ultima = ultimaRealizacao.toDate();
    const diffMs = agora.getTime() - ultima.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutos = Math.floor(diffMs / (1000 * 60));

    // Formata data e hora
    const dataHora = ultima.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (diffMinutos < 60) {
      return `Hoje às ${ultima.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })} (há ${diffMinutos} min)`;
    }
    if (diffHoras < 24) {
      return `Hoje às ${ultima.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })} (há ${diffHoras}h)`;
    }
    if (diffDias === 1) {
      return `Ontem às ${ultima.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    if (diffDias < 7) {
      return `${dataHora} (há ${diffDias} dias)`;
    }
    return dataHora;
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
        <Ionicons name="home-outline" size={64} color={theme.icon} />
        <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
          Nenhuma colmeia ativa
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textOnBackground }]}>
          Selecione uma colmeia para gerenciar rotinas
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Calendário (react-native-calendars) */}
      <View
        style={[styles.calendarContainer, { backgroundColor: theme.cardColor }]}
      >
        <Calendar
          key={currentTheme}
          current={selectedDate}
          onDayPress={onDayPress}
          markedDates={markedDates}
          markingType="multi-dot"
          theme={{
            backgroundColor: theme.cardColor,
            calendarBackground: theme.cardColor,
            textSectionTitleColor: theme.textOnCard,
            textSectionTitleDisabledColor: theme.textOnCard + "60",
            selectedDayBackgroundColor: theme.primary,
            selectedDayTextColor: theme.cardColor, // Usa a cor do card para garantir contraste
            todayTextColor: theme.primary,
            dayTextColor: theme.textOnCard,
            textDisabledColor: theme.textOnCard + "40",
            dotColor: theme.success,
            selectedDotColor: theme.cardColor, // Mesma cor do texto selecionado
            arrowColor: theme.primary,
            disabledArrowColor: theme.textOnCard + "30",
            monthTextColor: theme.textOnCard,
            indicatorColor: theme.primary,
            textDayFontWeight: "400",
            textMonthFontWeight: "bold",
            textDayHeaderFontWeight: "600",
          }}
        />
      </View>
      {/* Lista de Tarefas */}
      {loading ? (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textOnBackground }]}>
            Carregando tarefas...
          </Text>
        </View>
      ) : tarefas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="home-outline" size={64} color={theme.icon} />
          <Text style={[styles.emptyText, { color: theme.textOnBackground }]}>
            Nenhuma tarefa cadastrada
          </Text>
          <Text
            style={[styles.emptySubtext, { color: theme.textOnBackground }]}
          >
            Adicione rotinas para organizar o dia a dia
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedTarefas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const freqInfo = FREQUENCIAS.find(
              (f) => f.value === item.frequencia
            );
            const isSelected = deleteMode && selectedTarefas.includes(item.id);

            // meta computed earlier and attached on sortedTarefas
            const meta = (item as any)._meta || getTaskMeta(item, refDate);

            // border color rules:
            // - green if done on due date
            // - yellow if due today and not done
            // - blue if more than 1 day until due
            // - red if overdue (assumption for visual clarity)
            let borderColor = undefined as string | undefined;
            if (isSelected) {
              borderColor = theme.danger;
            } else if (meta.status === "done") {
              borderColor = "#34C759";
            } else if (meta.status === "dueToday") {
              borderColor = "#FFCC00";
            } else if (meta.status === "upcoming") {
              borderColor = "#007AFF";
            } else if (meta.status === "overdue") {
              borderColor = "#FF3B30";
            }

            const openEdit = (t: TarefaDomestica) => {
              if (deleteMode) return; // Não abre edição no modo exclusão
              setSelectedTarefa(t);
              setTitulo(t.titulo);
              setDescricao(t.descricao || "");
              setFrequencia(t.frequencia);
              setScheduledWeekdays(
                t.scheduledWeekdays && t.scheduledWeekdays.length > 0
                  ? t.scheduledWeekdays
                  : [new Date().getDay()]
              );
              setScheduledDay(
                typeof t.scheduledDay === "number"
                  ? t.scheduledDay
                  : t.createdAt && typeof t.createdAt.toDate === "function"
                  ? t.createdAt.toDate().getDate()
                  : new Date().getDate()
              );
              setScheduledHour(
                t.scheduledHour !== undefined ? t.scheduledHour : 9
              );
              setScheduledMinute(
                t.scheduledMinute !== undefined ? t.scheduledMinute : 0
              );
              setModalVisible(true);
            };

            return (
              <View
                style={[
                  styles.tarefaCard,
                  { backgroundColor: theme.cardColor },
                  isSelected && { borderWidth: 3, borderColor: theme.danger },
                  !isSelected && borderColor
                    ? { borderWidth: 2, borderColor }
                    : {},
                ]}
              >
                <View style={styles.tarefaHeader}>
                  {deleteMode ? (
                    <TouchableOpacity
                      style={[
                        styles.selectionButton,
                        isSelected && styles.selectionButtonActive,
                      ]}
                      onPress={() => toggleTarefaSelection(item.id)}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={18}
                          color="#8E8E93"
                        />
                      )}
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.tarefaInfo}
                    onPress={() =>
                      deleteMode
                        ? toggleTarefaSelection(item.id)
                        : openEdit(item)
                    }
                    onLongPress={() => handleLongPress(item.id)}
                  >
                    <View style={styles.tituloRow}>
                      <Text
                        style={[
                          styles.tarefaTitulo,
                          { color: theme.textOnCard },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.titulo}
                      </Text>

                      <View
                        style={[
                          styles.frequenciaBadge,
                          {
                            backgroundColor: getFrequenciaColor(
                              item.frequencia
                            ),
                          },
                        ]}
                      >
                        <Ionicons
                          name={freqInfo?.icon as any}
                          size={12}
                          color="#fff"
                        />
                        <Text style={styles.frequenciaText}>
                          {freqInfo?.label}
                        </Text>
                      </View>
                    </View>
                    {/* small status line: last done / week info */}
                    {meta.lastDone ? (
                      isDateInWeek(meta.lastDone, refDate) &&
                      item.frequencia === "semanal" ? (
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.textOnCard,
                            marginTop: 6,
                            opacity: 0.7,
                          }}
                        >
                          Feita nesta semana: {meta.lastDoneWeekday}
                        </Text>
                      ) : (
                        <Text
                          style={{
                            fontSize: 12,
                            color: theme.textOnCard,
                            marginTop: 6,
                            opacity: 0.7,
                          }}
                        >
                          Última: {meta.lastDone.toLocaleDateString("pt-BR")}
                        </Text>
                      )
                    ) : (
                      <Text
                        style={{
                          fontSize: 12,
                          color: theme.textOnCard,
                          marginTop: 6,
                          opacity: 0.7,
                        }}
                      >
                        Ainda não realizada
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* per-card delete removed; deletion is handled via ActionButton/selection */}
                </View>

                {item.descricao && (
                  <Text
                    style={[
                      styles.tarefaDescricao,
                      { color: theme.textOnCard },
                    ]}
                    numberOfLines={2}
                  >
                    {item.descricao}
                  </Text>
                )}

                {/* Exibir dias da semana para tarefas semanais */}
                {item.frequencia === "semanal" &&
                  item.scheduledWeekdays &&
                  item.scheduledWeekdays.length > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={theme.textOnCard}
                        style={{ opacity: 0.7 }}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          color: theme.textOnCard,
                          marginLeft: 4,
                          opacity: 0.7,
                        }}
                      >
                        {item.scheduledWeekdays
                          .sort()
                          .map(
                            (wd) =>
                              ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
                                wd
                              ]
                          )
                          .join(", ")}
                      </Text>
                    </View>
                  )}

                {/* Exibir hora agendada */}
                {(item.scheduledHour !== undefined ||
                  item.scheduledMinute !== undefined) && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <Ionicons
                      name="time-outline"
                      size={14}
                      color={theme.textOnCard}
                      style={{ opacity: 0.7 }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: theme.textOnCard,
                        marginLeft: 4,
                        opacity: 0.7,
                      }}
                    >
                      {String(item.scheduledHour || 0).padStart(2, "0")}:
                      {String(item.scheduledMinute || 0).padStart(2, "0")}
                    </Text>
                  </View>
                )}

                {!deleteMode && (
                  <View
                    style={[
                      styles.tarefaFooter,
                      { borderTopColor: theme.textOnCard + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ultimaRealizacao,
                        { color: theme.textOnCard, opacity: 0.7 },
                      ]}
                    >
                      {getTempoDesdeUltimaRealizacao(item.ultimaRealizacao)}
                    </Text>

                    {/* Mostra "Desfazer" se está feita no período, senão "Realizada" */}
                    {meta.isDoneInPeriod ? (
                      <TouchableOpacity
                        style={[
                          styles.realizarButton,
                          { backgroundColor: theme.secondary },
                        ]}
                        onPress={() => desfazerRealizacao(item)}
                      >
                        <Ionicons
                          name="arrow-undo-circle"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.realizarText}>Desfazer</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.realizarButton,
                          { backgroundColor: theme.success },
                        ]}
                        onPress={() => marcarRealizada(item)}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.realizarText}>Realizada</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          }}
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
            {selectedTarefas.length} selecionada(s)
          </Text>
          <TouchableOpacity
            style={[
              styles.applyButton,
              selectedTarefas.length === 0 && styles.applyButtonDisabled,
            ]}
            onPress={applyBulkAction}
            disabled={selectedTarefas.length === 0}
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

      {/* Modal Adicionar Tarefa */}
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
                Nova Tarefa Doméstica
              </Text>
              <TouchableOpacity onPress={closeModal}>
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
                placeholder="Título da tarefa"
                placeholderTextColor={theme.textOnBackground + "80"}
                value={titulo}
                onChangeText={setTitulo}
              />

              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.background,
                    color: theme.textOnBackground,
                  },
                ]}
                placeholder="Descrição (opcional)"
                placeholderTextColor={theme.textOnBackground + "80"}
                value={descricao}
                onChangeText={setDescricao}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: theme.textOnCard }]}>
                Frequência:
              </Text>
              <View style={styles.frequenciaContainer}>
                {FREQUENCIAS.map((freq) => (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.frequenciaOption,
                      frequencia === freq.value &&
                        styles.frequenciaOptionActive,
                      {
                        borderColor:
                          frequencia === freq.value
                            ? getFrequenciaColor(freq.value)
                            : "#E5E5EA",
                      },
                    ]}
                    onPress={() => setFrequencia(freq.value)}
                  >
                    <Ionicons
                      name={freq.icon as any}
                      size={24}
                      color={
                        frequencia === freq.value
                          ? getFrequenciaColor(freq.value)
                          : "#8E8E93"
                      }
                    />
                    <Text
                      style={[
                        styles.frequenciaOptionText,
                        frequencia === freq.value &&
                          styles.frequenciaOptionTextActive,
                      ]}
                    >
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scheduling options */}
              {frequencia === "semanal" && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: theme.textOnCard }]}>
                    Dias da semana:
                  </Text>
                  <View
                    style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}
                  >
                    {[
                      { label: "Dom", v: 0 },
                      { label: "Seg", v: 1 },
                      { label: "Ter", v: 2 },
                      { label: "Qua", v: 3 },
                      { label: "Qui", v: 4 },
                      { label: "Sex", v: 5 },
                      { label: "Sáb", v: 6 },
                    ].map((d) => {
                      const isSelected = scheduledWeekdays.includes(d.v);
                      return (
                        <TouchableOpacity
                          key={d.v}
                          onPress={() => {
                            if (isSelected) {
                              // Remove se já está selecionado (mas mantém pelo menos um)
                              if (scheduledWeekdays.length > 1) {
                                setScheduledWeekdays(
                                  scheduledWeekdays.filter((wd) => wd !== d.v)
                                );
                              }
                            } else {
                              // Adiciona se não está selecionado
                              setScheduledWeekdays(
                                [...scheduledWeekdays, d.v].sort()
                              );
                            }
                          }}
                          style={[
                            styles.frequenciaOption,
                            isSelected && styles.frequenciaOptionActive,
                            isSelected && { borderColor: theme.primary },
                            { minWidth: 44, paddingVertical: 10 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.frequenciaOptionText,
                              isSelected && styles.frequenciaOptionTextActive,
                            ]}
                          >
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {frequencia === "mensal" && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: theme.textOnCard }]}>
                    Dia do mês:
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.background,
                        color: theme.textOnBackground,
                      },
                    ]}
                    placeholder="Dia (1-31)"
                    placeholderTextColor={theme.textOnBackground + "80"}
                    keyboardType="numeric"
                    value={scheduledDay ? String(scheduledDay) : ""}
                    onChangeText={(v) => {
                      const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                      if (isNaN(n)) setScheduledDay(null);
                      else setScheduledDay(Math.max(1, Math.min(31, n)));
                    }}
                  />
                </View>
              )}

              {/* Seletor de hora */}
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.label, { color: theme.textOnCard }]}>
                  Horário:
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.background,
                          color: theme.textOnBackground,
                        },
                      ]}
                      placeholder="Hora (0-23)"
                      placeholderTextColor={theme.textOnBackground + "80"}
                      keyboardType="numeric"
                      value={String(scheduledHour)}
                      onChangeText={(v) => {
                        const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                        if (!isNaN(n)) {
                          setScheduledHour(Math.max(0, Math.min(23, n)));
                        }
                      }}
                    />
                  </View>
                  <Text
                    style={[
                      styles.label,
                      { marginBottom: 0, color: theme.textOnCard },
                    ]}
                  >
                    :
                  </Text>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: theme.background,
                          color: theme.textOnBackground,
                        },
                      ]}
                      placeholder="Minuto (0-59)"
                      placeholderTextColor={theme.textOnBackground + "80"}
                      keyboardType="numeric"
                      value={String(scheduledMinute).padStart(2, "0")}
                      onChangeText={(v) => {
                        const n = parseInt(v.replace(/[^0-9]/g, ""), 10);
                        if (!isNaN(n)) {
                          setScheduledMinute(Math.max(0, Math.min(59, n)));
                        }
                      }}
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={addTarefa}
              >
                <Text style={styles.saveButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Detalhes */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detalhes da Tarefa</Text>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedTarefa && (
              <>
                <Text style={styles.detailTitle}>{selectedTarefa.titulo}</Text>

                {selectedTarefa.descricao && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Descrição:</Text>
                    <Text style={styles.detailText}>
                      {selectedTarefa.descricao}
                    </Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Frequência:</Text>
                  <Text style={styles.detailText}>
                    {
                      FREQUENCIAS.find(
                        (f) => f.value === selectedTarefa.frequencia
                      )?.label
                    }
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Última realização:</Text>
                  <Text style={styles.detailText}>
                    {getTempoDesdeUltimaRealizacao(
                      selectedTarefa.ultimaRealizacao
                    )}
                  </Text>
                </View>

                {(() => {
                  const meta = getTaskMeta(selectedTarefa, new Date());
                  return meta.isDoneInPeriod ? (
                    <TouchableOpacity
                      style={[
                        styles.marcarButton,
                        { backgroundColor: theme.secondary },
                      ]}
                      onPress={() => {
                        desfazerRealizacao(selectedTarefa);
                        setDetailModalVisible(false);
                      }}
                    >
                      <Ionicons
                        name="arrow-undo-circle"
                        size={24}
                        color="#fff"
                      />
                      <Text style={styles.marcarButtonText}>Desfazer</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.marcarButton}
                      onPress={() => {
                        marcarRealizada(selectedTarefa);
                        setDetailModalVisible(false);
                      }}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#fff"
                      />
                      <Text style={styles.marcarButtonText}>
                        Marcar como Realizada
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </>
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
    paddingBottom: 90,
  },
  /* Calendar styles */
  calendarContainer: {
    margin: 12,
    borderRadius: 12,
    padding: 10,
    boxShadow: "0px 1px 3px rgba(0,0,0,0.08)",
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  monthNavButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textTransform: "capitalize",
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  weekDay: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#8E8E93",
    fontSize: 12,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    marginBottom: 6,
  },
  dayText: { color: "#333" },
  dayCellToday: { borderWidth: 1, borderColor: "#FFB300" },
  dayCellSelected: { backgroundColor: "#FFB300", borderRadius: 6 },
  dayCellSelectedText: { color: "#fff" },
  tarefaCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    boxShadow: "0px 1px 2px rgba(0,0,0,0.1)",
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tarefaCardSelected: {
    opacity: 0.8,
  },
  selectionCheckbox: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderRadius: 12,
  },
  tarefaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  tarefaInfo: {
    flex: 1,
  },
  tituloRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  tarefaTitulo: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  frequenciaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  frequenciaText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  deleteButton: {
    padding: 4,
  },
  tarefaDescricao: {
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.8,
  },
  tarefaFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ultimaRealizacao: {
    fontSize: 13,
  },
  realizarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  realizarText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  selectionButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  selectionButtonActive: {
    opacity: 0.8,
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
    opacity: 0.7,
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
    maxHeight: "90%",
  },
  modalScrollView: {
    flexGrow: 0,
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
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  frequenciaContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  frequenciaOption: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E5EA",
  },
  frequenciaOptionActive: {
    backgroundColor: "#F5F5F5",
  },
  frequenciaOptionText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
    fontWeight: "600",
  },
  frequenciaOptionTextActive: {
    color: "#333",
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
    marginBottom: 20,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
    opacity: 0.7,
  },
  detailText: {
    fontSize: 16,
  },
  marcarButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 20,
  },
  marcarButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
