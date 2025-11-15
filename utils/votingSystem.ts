import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { addActivityLog } from "./activityLogger";

export type VoteType = "delete_task" | "remove_member" | "delete_colmeia";

interface VoteData {
  type: VoteType;
  targetId: string; // ID da tarefa, membro ou colmeia
  targetName: string; // Nome para exibição
  createdBy: string;
  createdAt: any;
  votes: string[]; // Array de userId que votaram a favor
  status: "pending" | "approved" | "rejected";
  requiredVotes: number;
}

/**
 * Verifica se uma colmeia precisa de votação (3 ou mais membros)
 */
export async function needsVoting(colmeiaId: string): Promise<boolean> {
  const membersRef = collection(db, "colmeias", colmeiaId, "members");
  const membersSnapshot = await getDocs(membersRef);
  return membersSnapshot.size >= 3;
}

/**
 * Calcula quantos votos são necessários baseado no número de membros
 * - Menos de 3 membros: não precisa votação
 * - 3 membros (deletar colmeia): unanimidade (3/3)
 * - 3 membros (deletar tarefa/remover membro): maioria simples (2/3)
 * - 4 ou mais membros (para colmeia): todos menos 1
 * - 4 ou mais membros (para tarefa/membro): maioria simples (50% + 1)
 */
export async function calculateRequiredVotes(
  colmeiaId: string,
  voteType: VoteType
): Promise<{ required: number; total: number }> {
  const membersRef = collection(db, "colmeias", colmeiaId, "members");
  const membersSnapshot = await getDocs(membersRef);
  const totalMembers = membersSnapshot.size;

  let requiredVotes: number;

  if (totalMembers === 3) {
    // Para 3 membros
    if (voteType === "delete_colmeia") {
      // Deletar colmeia: unanimidade (3/3)
      requiredVotes = 3;
    } else {
      // Deletar tarefa ou remover membro: maioria simples (2/3)
      requiredVotes = 2;
    }
  } else if (totalMembers >= 4) {
    if (voteType === "delete_colmeia") {
      // Deletar colmeia: todos menos 1
      requiredVotes = totalMembers - 1;
    } else {
      // Deletar tarefa ou remover membro: maioria simples
      requiredVotes = Math.ceil(totalMembers / 2);
    }
  } else {
    // 1 ou 2 membros: não precisa votação, mas define como 1 para compatibilidade
    requiredVotes = 1;
  }

  return { required: requiredVotes, total: totalMembers };
}

/**
 * Cria uma nova votação
 */
export async function createVote(
  colmeiaId: string,
  voteType: VoteType,
  targetId: string,
  targetName: string
): Promise<string> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado");

  // Verifica se já existe uma votação pendente para este target
  const votesRef = collection(db, "colmeias", colmeiaId, "votes");
  const existingVoteQuery = query(
    votesRef,
    where("targetId", "==", targetId),
    where("status", "==", "pending")
  );
  const existingVotes = await getDocs(existingVoteQuery);

  if (!existingVotes.empty) {
    throw new Error("Já existe uma votação pendente para este item");
  }

  const { required } = await calculateRequiredVotes(colmeiaId, voteType);

  // Cria a votação com o voto do criador
  const voteData: VoteData = {
    type: voteType,
    targetId,
    targetName,
    createdBy: userId,
    createdAt: serverTimestamp(),
    votes: [userId], // Criador já vota automaticamente
    status: "pending",
    requiredVotes: required,
  };

  const voteDoc = await addDoc(votesRef, voteData);

  // Registra atividade
  await addActivityLog({
    colmeiaId,
    type: "vote_created",
    metadata: {
      voteType,
      targetName,
      voteId: voteDoc.id,
    },
  });

  // Verifica se já atingiu os votos necessários (caso de 1 membro apenas)
  if (voteData.votes.length >= required) {
    await executeVote(colmeiaId, voteDoc.id);
  }

  return voteDoc.id;
}

/**
 * Adiciona um voto a uma votação existente
 */
export async function addVote(
  colmeiaId: string,
  voteId: string
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado");

  const voteRef = doc(db, "colmeias", colmeiaId, "votes", voteId);
  const voteDoc = await getDoc(voteRef);

  if (!voteDoc.exists()) {
    throw new Error("Votação não encontrada");
  }

  const voteData = voteDoc.data() as VoteData;

  if (voteData.status !== "pending") {
    throw new Error("Esta votação já foi concluída");
  }

  if (voteData.votes.includes(userId)) {
    throw new Error("Você já votou nesta votação");
  }

  // Adiciona o voto
  const updatedVotes = [...voteData.votes, userId];
  await updateDoc(voteRef, {
    votes: updatedVotes,
  });

  // Verifica se atingiu os votos necessários
  if (updatedVotes.length >= voteData.requiredVotes) {
    await executeVote(colmeiaId, voteId);
  }
}

/**
 * Remove um voto (permite que usuário mude de ideia)
 */
export async function removeVote(
  colmeiaId: string,
  voteId: string
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado");

  const voteRef = doc(db, "colmeias", colmeiaId, "votes", voteId);
  const voteDoc = await getDoc(voteRef);

  if (!voteDoc.exists()) {
    throw new Error("Votação não encontrada");
  }

  const voteData = voteDoc.data() as VoteData;

  if (voteData.status !== "pending") {
    throw new Error("Esta votação já foi concluída");
  }

  if (voteData.createdBy === userId) {
    throw new Error("O criador da votação não pode remover seu voto");
  }

  if (!voteData.votes.includes(userId)) {
    throw new Error("Você não votou nesta votação");
  }

  // Remove o voto
  const updatedVotes = voteData.votes.filter((id) => id !== userId);
  await updateDoc(voteRef, {
    votes: updatedVotes,
  });
}

/**
 * Executa a ação quando a votação atinge os votos necessários
 */
async function executeVote(colmeiaId: string, voteId: string): Promise<void> {
  const voteRef = doc(db, "colmeias", colmeiaId, "votes", voteId);
  const voteDoc = await getDoc(voteRef);

  if (!voteDoc.exists()) return;

  const voteData = voteDoc.data() as VoteData;

  try {
    switch (voteData.type) {
      case "delete_task":
        await deleteTask(colmeiaId, voteData.targetId, voteData.targetName);
        break;
      case "remove_member":
        await removeMember(colmeiaId, voteData.targetId, voteData.targetName);
        break;
      case "delete_colmeia":
        await deleteColmeia(colmeiaId);
        break;
    }

    // Marca votação como aprovada
    await updateDoc(voteRef, {
      status: "approved",
    });

    // Registra atividade
    await addActivityLog({
      colmeiaId,
      type: "vote_completed",
      metadata: {
        voteType: voteData.type,
        targetName: voteData.targetName,
        result: "approved",
      },
    });
  } catch (error) {
    console.error("Erro ao executar votação:", error);
    await updateDoc(voteRef, {
      status: "rejected",
    });
  }
}

/**
 * Deleta uma tarefa após votação aprovada
 */
async function deleteTask(
  colmeiaId: string,
  taskId: string,
  taskName: string
): Promise<void> {
  const taskRef = doc(db, "colmeias", colmeiaId, "tasks", taskId);
  await deleteDoc(taskRef);

  await addActivityLog({
    colmeiaId,
    type: "task_deleted",
    metadata: { taskTitle: taskName },
  });
}

/**
 * Remove um membro após votação aprovada
 */
async function removeMember(
  colmeiaId: string,
  memberId: string,
  memberName: string
): Promise<void> {
  const memberRef = doc(db, "colmeias", colmeiaId, "members", memberId);
  await deleteDoc(memberRef);

  await addActivityLog({
    colmeiaId,
    type: "member_left",
    metadata: { memberName },
  });
}

/**
 * Deleta uma colmeia após votação aprovada
 */
async function deleteColmeia(colmeiaId: string): Promise<void> {
  // Deleta todas as subcoleções primeiro
  const collections = ["members", "tasks", "activities", "votes"];

  for (const collectionName of collections) {
    const collectionRef = collection(db, "colmeias", colmeiaId, collectionName);
    const snapshot = await getDocs(collectionRef);
    const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  // Deleta a colmeia
  const colmeiaRef = doc(db, "colmeias", colmeiaId);
  await deleteDoc(colmeiaRef);
}

/**
 * Busca todas as votações pendentes de uma colmeia
 */
export async function getPendingVotes(
  colmeiaId: string
): Promise<Array<VoteData & { id: string }>> {
  const votesRef = collection(db, "colmeias", colmeiaId, "votes");
  const q = query(votesRef, where("status", "==", "pending"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as VoteData),
  }));
}

/**
 * Cancela uma votação (apenas o criador pode cancelar)
 */
export async function cancelVote(
  colmeiaId: string,
  voteId: string
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error("Usuário não autenticado");

  const voteRef = doc(db, "colmeias", colmeiaId, "votes", voteId);
  const voteDoc = await getDoc(voteRef);

  if (!voteDoc.exists()) {
    throw new Error("Votação não encontrada");
  }

  const voteData = voteDoc.data() as VoteData;

  if (voteData.createdBy !== userId) {
    throw new Error("Apenas o criador pode cancelar a votação");
  }

  if (voteData.status !== "pending") {
    throw new Error("Esta votação já foi concluída");
  }

  await updateDoc(voteRef, {
    status: "rejected",
  });
}

/**
 * Deleta uma tarefa diretamente (sem votação) - para colmeias com menos de 3 membros
 */
export async function deleteTaskDirect(
  colmeiaId: string,
  taskId: string,
  taskName: string
): Promise<void> {
  const taskRef = doc(db, "colmeias", colmeiaId, "tasks", taskId);
  await deleteDoc(taskRef);

  await addActivityLog({
    colmeiaId,
    type: "task_deleted",
    metadata: { taskTitle: taskName },
  });
}

/**
 * Deleta uma tarefa doméstica diretamente (sem votação) - para colmeias com menos de 3 membros
 */
export async function deleteTarefaDomesticaDirect(
  colmeiaId: string,
  tarefaId: string,
  tarefaName: string
): Promise<void> {
  const tarefaRef = doc(db, "colmeias", colmeiaId, "rotinas", tarefaId);
  await deleteDoc(tarefaRef);

  await addActivityLog({
    colmeiaId,
    type: "task_deleted",
    metadata: { taskTitle: tarefaName },
  });
}

/**
 * Remove um membro diretamente (sem votação) - para colmeias com menos de 3 membros
 */
export async function removeMemberDirect(
  colmeiaId: string,
  memberId: string,
  memberName: string
): Promise<void> {
  const memberRef = doc(db, "colmeias", colmeiaId, "members", memberId);
  await deleteDoc(memberRef);

  await addActivityLog({
    colmeiaId,
    type: "member_left",
    metadata: { memberName },
  });
}

/**
 * Deleta uma colmeia diretamente (sem votação) - para colmeias com menos de 3 membros
 */
export async function deleteColmeiaDirect(colmeiaId: string): Promise<void> {
  // Deleta todas as subcoleções primeiro
  const collections = ["members", "tasks", "activities", "votes"];

  for (const collectionName of collections) {
    const collectionRef = collection(db, "colmeias", colmeiaId, collectionName);
    const snapshot = await getDocs(collectionRef);
    const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  // Deleta a colmeia
  const colmeiaRef = doc(db, "colmeias", colmeiaId);
  await deleteDoc(colmeiaRef);
}
