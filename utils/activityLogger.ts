import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

export type ActivityType =
  | "task_created"
  | "task_completed"
  | "task_uncompleted"
  | "task_deleted"
  | "member_joined"
  | "member_left"
  | "vote_created"
  | "vote_completed"
  | "expense_added";

interface ActivityLogParams {
  colmeiaId: string;
  type: ActivityType;
  metadata?: any;
}

export async function addActivityLog({
  colmeiaId,
  type,
  metadata = {},
}: ActivityLogParams) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const activitiesRef = collection(db, "colmeias", colmeiaId, "activities");
    await addDoc(activitiesRef, {
      type,
      userId: user.uid,
      userName: user.email?.split("@")[0] || "Usuário",
      timestamp: serverTimestamp(),
      metadata,
    });
  } catch (error) {
    console.error("Erro ao registrar atividade:", error);
  }
}

export function getActivityMessage(activity: any): string {
  const userName = activity.userName || "Alguém";

  switch (activity.type) {
    case "task_created":
      return `${userName} criou a tarefa "${activity.metadata?.taskTitle}"`;
    case "task_completed":
      return `${userName} completou a tarefa "${activity.metadata?.taskTitle}"`;
    case "task_uncompleted":
      return `${userName} reabriu a tarefa "${activity.metadata?.taskTitle}"`;
    case "task_deleted":
      return `${userName} deletou a tarefa "${activity.metadata?.taskTitle}"`;
    case "member_joined":
      return `${userName} entrou na colmeia`;
    case "member_left":
      return `${userName} saiu da colmeia`;
    case "vote_created":
      return `${userName} iniciou uma votação`;
    case "vote_completed":
      return `Uma votação foi concluída`;
    case "expense_added":
      return `${userName} adicionou uma despesa de R$ ${activity.metadata?.valor?.toFixed(
        2
      )}`;
    default:
      return `${userName} realizou uma ação`;
  }
}
